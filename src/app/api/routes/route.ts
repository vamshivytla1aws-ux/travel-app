import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureTransportEnhancements } from "@/lib/schema-ensure";

const SHIFTS = ["general", "morning", "afternoon", "night", "unknown"] as const;

type Shift = (typeof SHIFTS)[number];

function normalizeShift(value: string): Shift {
  const shift = value.trim().toLowerCase() as Shift;
  return SHIFTS.includes(shift) ? shift : "general";
}

export async function GET(request: NextRequest) {
  const session = await requireApiModuleAccess("routes");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await ensureTransportEnhancements();

  const q = String(request.nextUrl.searchParams.get("search") ?? "").trim().toLowerCase();
  const shiftRaw = String(request.nextUrl.searchParams.get("shift") ?? "").trim().toLowerCase();
  const validShift = SHIFTS.includes(shiftRaw as Shift) ? shiftRaw : "";

  const result = await query<{
    id: number;
    bus_id: number;
    driver_id: number;
    assignment_date: string;
    bus_registration_number: string;
    driver_name: string;
    company_name: string | null;
    route_name: string;
    shift: string;
    updated_at: string;
  }>(
    `SELECT rp.id, rp.bus_id, rp.driver_id, rp.assignment_date::text, rp.company_name, rp.route_name, rp.shift::text, rp.updated_at::text,
            b.registration_number AS bus_registration_number,
            d.full_name AS driver_name
     FROM route_planner_entries rp
     JOIN buses b ON b.id = rp.bus_id
     JOIN drivers d ON d.id = rp.driver_id
     WHERE rp.is_active = true
     ORDER BY rp.id DESC`,
  );

  const filtered = result.rows.filter((entry) => {
    const matchesSearch =
      !q ||
      entry.bus_registration_number.toLowerCase().includes(q) ||
      entry.driver_name.toLowerCase().includes(q) ||
      (entry.company_name ?? "").toLowerCase().includes(q) ||
      entry.route_name.toLowerCase().includes(q) ||
      entry.assignment_date.includes(q);
    const matchesShift = !validShift || entry.shift === validShift;
    return matchesSearch && matchesShift;
  });
  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const session = await requireApiModuleAccess("routes");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await ensureTransportEnhancements();

  const body = await request.json().catch(() => null);
  const busId = Number(body?.busId);
  const driverId = Number(body?.driverId);
  const routeName = String(body?.routeName ?? "").trim();
  const assignmentDate = String(body?.assignmentDate ?? "").trim();
  const companyName = String(body?.companyName ?? "").trim();
  const shift = normalizeShift(String(body?.shift ?? "general"));

  if (!busId || !driverId || !routeName || !assignmentDate) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const result = await query<{ id: number }>(
    `INSERT INTO route_planner_entries(
      bus_id, driver_id, company_name, route_name, shift, assignment_date, created_by, updated_by
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$7)
    RETURNING id`,
    [busId, driverId, companyName || null, routeName, shift, assignmentDate, session.id],
  );

  return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
}
