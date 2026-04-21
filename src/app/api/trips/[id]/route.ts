import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { TripsService } from "@/services/trips.service";

const tripsService = new TripsService();

function parseId(params: { id: string }) {
  const id = Number(params.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("trips");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseId(params);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const busId = Number(body?.busId);
  const driverId = Number(body?.driverId);
  const routeId = Number(body?.routeId);
  const shiftLabel = String(body?.shiftLabel ?? "").trim();
  if (!busId || !driverId || !routeId || !shiftLabel) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  await tripsService.updateTripPlan({
    tripId: id,
    busId,
    driverId,
    routeId,
    shiftLabel,
    companyName: String(body?.companyName ?? "").trim() || undefined,
    remarks: String(body?.remarks ?? "").trim() || undefined,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("trips");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseId(params);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await tripsService.cancelTrip(id);
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("trips");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseId(params);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "").trim().toLowerCase();

  if (action === "start") {
    const odometerStartKm = Number(body?.odometerStartKm);
    if (!Number.isFinite(odometerStartKm) || odometerStartKm < 0) {
      return NextResponse.json({ error: "Invalid odometer start value" }, { status: 400 });
    }
    await tripsService.startTrip({ tripId: id, odometerStartKm });
    return NextResponse.json({ success: true });
  }

  if (action === "complete") {
    const odometerEndKm = Number(body?.odometerEndKm);
    const litersFilled = Number(body?.litersFilled);
    if (!Number.isFinite(odometerEndKm) || odometerEndKm < 0 || !Number.isFinite(litersFilled) || litersFilled < 0) {
      return NextResponse.json({ error: "Invalid completion values" }, { status: 400 });
    }
    await tripsService.completeTrip({
      tripId: id,
      odometerEndKm,
      litersFilled,
      remarks: String(body?.remarks ?? "").trim() || undefined,
    });
    return NextResponse.json({ success: true });
  }

  if (action === "cancel") {
    await tripsService.cancelTrip(id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
