import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { query } from "@/lib/db";
import { DriversService } from "@/services/drivers.service";

const driversService = new DriversService();

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("drivers");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const detail = await driversService.getDriverProfile(id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("drivers");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await query<{
    id: number;
    full_name: string;
    phone: string;
    company_name: string | null;
    license_number: string;
    license_expiry: string;
    experience_years: number;
  }>(
    `SELECT id, full_name, phone, company_name, license_number, license_expiry::text, experience_years
     FROM drivers WHERE id = $1`,
    [id],
  );
  const row = existing.rows[0];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const fullName = String(body?.fullName ?? row.full_name).trim();
  const phone = String(body?.phone ?? row.phone).trim();
  const companyNameRaw = body?.companyName;
  const companyName = companyNameRaw === undefined ? row.company_name : String(companyNameRaw).trim() || null;
  const licenseNumber = String(body?.licenseNumber ?? row.license_number).trim();
  const licenseExpiry = String(body?.licenseExpiry ?? row.license_expiry).trim();
  const experienceYears = Number(body?.experienceYears ?? row.experience_years);

  await query(
    `UPDATE drivers
     SET full_name = $1, phone = $2, company_name = $3, license_number = $4, license_expiry = $5, experience_years = $6, updated_at = NOW()
     WHERE id = $7`,
    [fullName, phone, companyName, licenseNumber, licenseExpiry, Number.isFinite(experienceYears) ? experienceYears : row.experience_years, id],
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("drivers");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  await query(`UPDATE drivers SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
  return NextResponse.json({ success: true });
}
