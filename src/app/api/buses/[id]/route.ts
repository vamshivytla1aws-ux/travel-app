import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit";
import { requireApiModuleAccess } from "@/lib/auth";
import { BusesService } from "@/services/buses.service";

const busesService = new BusesService();

function parseId(params: { id: string }) {
  const id = Number(params.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("buses");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = parseId(params);
  if (!id) return NextResponse.json({ error: "Invalid bus id" }, { status: 400 });

  const detail = await busesService.getBusDetail(id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("buses");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!["admin", "dispatcher"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseId(params);
  if (!id) return NextResponse.json({ error: "Invalid bus id" }, { status: 400 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const busNumber = String(body.busNumber ?? "").trim();
  const registrationNumber = String(body.registrationNumber ?? "").trim();
  const make = String(body.make ?? "").trim();
  const model = String(body.model ?? "").trim();
  const seater = Number(body.seater);
  const odometerKm = Number(body.odometerKm);
  const statusRaw = String(body.status ?? "active");
  const status =
    statusRaw === "active" || statusRaw === "maintenance" || statusRaw === "inactive"
      ? statusRaw
      : "active";

  if (
    !busNumber ||
    !registrationNumber ||
    !make ||
    !model ||
    !Number.isFinite(seater) ||
    seater <= 0 ||
    !Number.isFinite(odometerKm) ||
    odometerKm < 0
  ) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const result = await busesService.updateBus(id, {
    busNumber,
    registrationNumber,
    make,
    model,
    seater,
    odometerKm,
    status,
  });
  if ("error" in result && result.error === "duplicate") {
    return NextResponse.json({ error: "Duplicate bus number or registration" }, { status: 409 });
  }
  if ("error" in result && result.error === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await logAuditEvent({
    session,
    action: "update",
    entityType: "bus",
    entityId: id,
    details: { busNumber, registrationNumber, status },
  });
  return NextResponse.json(result.bus);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("buses");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!["admin", "dispatcher"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = parseId(params);
  if (!id) return NextResponse.json({ error: "Invalid bus id" }, { status: 400 });

  const result = await busesService.deleteBus(id);
  if ("error" in result && result.error === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await logAuditEvent({
    session,
    action: "delete",
    entityType: "bus",
    entityId: id,
  });
  return NextResponse.json({ success: true });
}

