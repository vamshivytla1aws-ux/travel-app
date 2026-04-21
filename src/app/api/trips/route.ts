import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { TripsService } from "@/services/trips.service";

const tripsService = new TripsService();

export async function GET(request: NextRequest) {
  const session = await requireApiModuleAccess("trips");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = String(request.nextUrl.searchParams.get("search") ?? "").trim().toLowerCase();
  const data = await tripsService.listTodayTrips();
  const filtered = data.filter((trip) => {
    return (
      !q ||
      trip.bus_number.toLowerCase().includes(q) ||
      trip.driver_name.toLowerCase().includes(q) ||
      trip.route_name.toLowerCase().includes(q) ||
      (trip.company_name ?? "").toLowerCase().includes(q)
    );
  });
  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const session = await requireApiModuleAccess("trips");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const busId = Number(body?.busId);
  const driverId = Number(body?.driverId);
  const routeId = Number(body?.routeId);
  const shiftLabel = String(body?.shiftLabel ?? "").trim();

  if (!busId || !driverId || !routeId || !shiftLabel) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  await tripsService.createTrip({
    busId,
    driverId,
    routeId,
    shiftLabel,
    companyName: String(body?.companyName ?? "").trim() || undefined,
    remarks: String(body?.remarks ?? "").trim() || undefined,
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
