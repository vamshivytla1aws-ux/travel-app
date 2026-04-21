import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await requireApiModuleAccess("tracking");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = String(request.nextUrl.searchParams.get("search") ?? "").trim().toLowerCase();
  const logs = await query<{
    id: number;
    bus_id: number;
    bus_number: string;
    driver_id: number | null;
    driver_name: string | null;
    logged_at: string;
    latitude: string;
    longitude: string;
    speed_kmph: string;
  }>(
    `SELECT g.id, g.bus_id, b.bus_number, g.driver_id, d.full_name as driver_name, g.logged_at::text, g.latitude::text, g.longitude::text, g.speed_kmph::text
     FROM gps_logs g
     JOIN buses b ON b.id = g.bus_id
     LEFT JOIN drivers d ON d.id = g.driver_id
     ORDER BY g.logged_at DESC
     LIMIT 500`,
  );
  const filtered = logs.rows.filter((log) => !q || log.bus_number.toLowerCase().includes(q));
  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const session = await requireApiModuleAccess("tracking");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const busId = Number(body?.busId);
  const driverId = body?.driverId != null ? Number(body.driverId) : null;
  const latitude = Number(body?.latitude);
  const longitude = Number(body?.longitude);
  const speedKmph = Number(body?.speedKmph ?? 0);

  if (!busId || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(speedKmph)) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  await query(
    `INSERT INTO gps_logs (bus_id, driver_id, logged_at, latitude, longitude, speed_kmph)
     VALUES($1,$2,NOW(),$3,$4,$5)`,
    [busId, Number.isFinite(driverId as number) ? driverId : null, latitude, longitude, speedKmph],
  );

  return NextResponse.json({ success: true }, { status: 201 });
}
