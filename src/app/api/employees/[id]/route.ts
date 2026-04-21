import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { query } from "@/lib/db";
import { EmployeesService } from "@/services/employees.service";

const employeesService = new EmployeesService();

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("employees");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const employee = await employeesService.getEmployee(id);
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(employee);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("employees");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await query<{
    id: number;
    employee_code: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    company_name: string | null;
    department: string;
    pickup_address: string;
    drop_address: string;
  }>(
    `SELECT id, employee_code, full_name, phone, email, company_name, department, pickup_address, drop_address
     FROM employees WHERE id = $1`,
    [id],
  );
  const row = existing.rows[0];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const employeeCode = String(body?.employeeCode ?? row.employee_code).trim();
  const fullName = String(body?.fullName ?? row.full_name).trim();
  const phone = body?.phone === undefined ? row.phone : String(body.phone).trim() || null;
  const email = body?.email === undefined ? row.email : String(body.email).trim() || null;
  const companyName = body?.companyName === undefined ? row.company_name : String(body.companyName).trim() || null;
  const department = String(body?.department ?? row.department).trim();
  const pickupAddress = String(body?.pickupAddress ?? row.pickup_address).trim();
  const dropAddress = String(body?.dropAddress ?? row.drop_address).trim();

  await query(
    `UPDATE employees
     SET employee_code = $1, full_name = $2, phone = $3, email = $4, company_name = $5,
         department = $6, pickup_address = $7, drop_address = $8, updated_at = NOW()
     WHERE id = $9`,
    [employeeCode, fullName, phone, email, companyName, department, pickupAddress, dropAddress, id],
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("employees");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  await query(`UPDATE employees SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
  return NextResponse.json({ success: true });
}
