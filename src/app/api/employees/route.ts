import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { query } from "@/lib/db";
import { EmployeesService } from "@/services/employees.service";

const employeesService = new EmployeesService();

export async function GET(request: NextRequest) {
  const session = await requireApiModuleAccess("employees");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const department = request.nextUrl.searchParams.get("department") ?? undefined;
  const q = String(request.nextUrl.searchParams.get("search") ?? "").trim().toLowerCase();
  const company = String(request.nextUrl.searchParams.get("company") ?? "").trim().toLowerCase();
  const data = await employeesService.listEmployees(department);
  const filtered = data.filter((employee) => {
    const matchesSearch =
      !q ||
      employee.fullName.toLowerCase().includes(q) ||
      employee.employeeCode.toLowerCase().includes(q) ||
      (employee.phone ?? "").toLowerCase().includes(q) ||
      employee.department.toLowerCase().includes(q);
    const matchesCompany = !company || (employee.companyName ?? "").trim().toLowerCase() === company;
    return matchesSearch && matchesCompany;
  });
  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const session = await requireApiModuleAccess("employees");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const employeeCode = String(body?.employeeCode ?? "").trim();
  const fullName = String(body?.fullName ?? "").trim();
  const phone = String(body?.phone ?? "").trim() || null;
  const companyName = String(body?.companyName ?? "").trim() || null;
  const department = String(body?.department ?? "").trim() || "Operations";
  const pickupAddress = String(body?.pickupAddress ?? "").trim() || "-";
  const dropAddress = String(body?.dropAddress ?? "").trim() || "-";
  const email = String(body?.email ?? "").trim() || null;

  if (!employeeCode || !fullName) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const existing = await query<{ id: number }>(
    `SELECT id FROM employees
     WHERE employee_code = $1
       OR ($2::varchar IS NOT NULL AND email IS NOT NULL AND lower(email) = lower($2::varchar))
     LIMIT 1`,
    [employeeCode, email],
  );
  if ((existing.rowCount ?? 0) > 0) {
    return NextResponse.json({ error: "Duplicate employee" }, { status: 409 });
  }

  const result = await query<{ id: number }>(
    `INSERT INTO employees(
      employee_code, full_name, phone, email, company_name, department, shift_start, shift_end, pickup_address, drop_address
    )
     VALUES($1,$2,$3,$4,$5,$6,'09:00:00','18:00:00',$7,$8)
     RETURNING id`,
    [employeeCode, fullName, phone, email, companyName, department, pickupAddress, dropAddress],
  );
  return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
}
