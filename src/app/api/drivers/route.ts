import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { query } from "@/lib/db";
import { DriversService } from "@/services/drivers.service";

const driversService = new DriversService();

export async function GET(request: NextRequest) {
  const session = await requireApiModuleAccess("drivers");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = String(request.nextUrl.searchParams.get("search") ?? "").trim().toLowerCase();
  const company = String(request.nextUrl.searchParams.get("company") ?? "").trim().toLowerCase();
  const data = await driversService.listDrivers();
  const filtered = data.filter((driver) => {
    const matchesSearch =
      !q ||
      driver.fullName.toLowerCase().includes(q) ||
      driver.phone.toLowerCase().includes(q) ||
      driver.licenseNumber.toLowerCase().includes(q);
    const matchesCompany = !company || (driver.companyName ?? "").trim().toLowerCase() === company;
    return matchesSearch && matchesCompany;
  });
  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const session = await requireApiModuleAccess("drivers");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const fullName = String(body?.fullName ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const companyName = String(body?.companyName ?? "").trim() || null;
  const licenseNumber = String(body?.licenseNumber ?? "").trim();
  const licenseExpiry = String(body?.licenseExpiry ?? "").trim() || "2030-01-01";
  const experienceYears = Number(body?.experienceYears ?? 0);

  if (!fullName || !phone || !licenseNumber) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const existing = await query<{ id: number }>(
    `SELECT id FROM drivers WHERE phone = $1 OR license_number = $2 LIMIT 1`,
    [phone, licenseNumber],
  );
  if ((existing.rowCount ?? 0) > 0) {
    return NextResponse.json({ error: "Duplicate driver" }, { status: 409 });
  }

  const result = await query<{ id: number }>(
    `INSERT INTO drivers(
      full_name, phone, company_name, license_number, license_expiry, experience_years
    )
     VALUES($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [fullName, phone, companyName, licenseNumber, licenseExpiry, Number.isFinite(experienceYears) ? experienceYears : 0],
  );
  return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
}
