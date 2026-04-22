import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  await requireSession();

  const [buses, drivers, routes] = await Promise.all([
    query<{ id: number; bus_number: string; registration_number: string; odometer_km: string }>(
      `SELECT id, bus_number, registration_number, odometer_km::text
       FROM buses
       WHERE status = 'active'
       ORDER BY registration_number`,
    ),
    query<{ id: number; full_name: string; company_name: string | null }>(
      `SELECT id, full_name, company_name
       FROM drivers
       WHERE is_active = true
       ORDER BY full_name`,
    ),
    query<{ id: number; route_name: string }>(
      `SELECT id, route_name
       FROM routes
       WHERE is_active = true
       ORDER BY route_name`,
    ),
  ]);

  return NextResponse.json({
    buses: buses.rows.map((b) => ({
      id: b.id,
      busNumber: b.bus_number,
      registrationNumber: b.registration_number,
      odometerKm: Number(b.odometer_km),
    })),
    drivers: drivers.rows.map((d) => ({ id: d.id, fullName: d.full_name, companyName: d.company_name })),
    routes: routes.rows,
  });
}
