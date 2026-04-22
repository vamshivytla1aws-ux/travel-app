import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { BusesService } from "@/services/buses.service";
import { logAuditEvent } from "@/lib/audit";

const busesService = new BusesService();

export async function GET(request: NextRequest) {
  const session = await requireApiModuleAccess("buses");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q") ?? request.nextUrl.searchParams.get("search") ?? "";
  const statusRaw = request.nextUrl.searchParams.get("status");
  const status =
    statusRaw === "active" || statusRaw === "maintenance" || statusRaw === "inactive"
      ? statusRaw
      : undefined;
  const pageRaw = Number(request.nextUrl.searchParams.get("page"));
  const limitRaw = Number(request.nextUrl.searchParams.get("limit"));
  const hasPaging =
    request.nextUrl.searchParams.has("page") || request.nextUrl.searchParams.has("limit");

  if (hasPaging) {
    const data = await busesService.listBusesPaged({
      search: q,
      status,
      page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
      limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 20,
    });
    return NextResponse.json(data);
  }

  const data = await busesService.listBuses(q, status);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const session = await requireApiModuleAccess("buses");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!["admin", "dispatcher", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  if (!busNumber || !registrationNumber || !make || !model || !Number.isFinite(seater) || seater <= 0 || !Number.isFinite(odometerKm) || odometerKm < 0) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const result = await busesService.createBus({
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

  await logAuditEvent({
    session,
    action: "create",
    entityType: "bus",
    entityId: result.bus.id,
    details: { busNumber, registrationNumber },
  });
  return NextResponse.json(result.bus, { status: 201 });
}
