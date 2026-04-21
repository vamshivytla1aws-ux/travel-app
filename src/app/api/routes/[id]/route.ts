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

function parseId(params: { id: string }) {
  const id = Number(params.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("routes");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await ensureTransportEnhancements();

  const id = parseId(params);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

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
    `UPDATE route_planner_entries
     SET bus_id = $1,
         driver_id = $2,
         company_name = $3,
         route_name = $4,
         shift = $5,
         assignment_date = $6,
         updated_by = $7,
         updated_at = NOW()
     WHERE id = $8 AND is_active = true
     RETURNING id`,
    [busId, driverId, companyName || null, routeName, shift, assignmentDate, session.id, id],
  );

  if (!result.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("routes");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await ensureTransportEnhancements();

  const id = parseId(params);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await query(
    `UPDATE route_planner_entries
     SET is_active = false, updated_by = $1, updated_at = NOW()
     WHERE id = $2`,
    [session.id, id],
  );

  return NextResponse.json({ success: true });
}
