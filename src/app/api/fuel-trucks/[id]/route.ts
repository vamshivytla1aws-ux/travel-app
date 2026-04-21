import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { FuelTruckService } from "@/services/fuel-truck.service";

const fuelTruckService = new FuelTruckService();

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("fuel-truck");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const detail = await fuelTruckService.getFuelTruckDetail(id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("fuel-truck");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "fuel_manager", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const existing = await fuelTruckService.getFuelTruck(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  await fuelTruckService.updateFuelTruck({
    id,
    truckCode: String(body?.truckCode ?? existing.truckCode),
    truckName: String(body?.truckName ?? existing.truckName),
    registrationNumber: String(body?.registrationNumber ?? existing.registrationNumber),
    tankCapacityLiters: Number(body?.tankCapacityLiters ?? existing.tankCapacityLiters),
    currentAvailableLiters: Number(body?.currentAvailableLiters ?? existing.currentAvailableLiters),
    lowStockThresholdLiters: Number(body?.lowStockThresholdLiters ?? existing.lowStockThresholdLiters),
    status: String(body?.status ?? existing.status) === "inactive" ? "inactive" : "active",
    notes: String(body?.notes ?? existing.notes ?? ""),
    userId: session.id,
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireApiModuleAccess("fuel-truck");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "fuel_manager", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const existing = await fuelTruckService.getFuelTruck(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await fuelTruckService.updateFuelTruck({
    id,
    truckCode: existing.truckCode,
    truckName: existing.truckName,
    registrationNumber: existing.registrationNumber,
    tankCapacityLiters: existing.tankCapacityLiters,
    currentAvailableLiters: existing.currentAvailableLiters,
    lowStockThresholdLiters: existing.lowStockThresholdLiters,
    status: "inactive",
    notes: existing.notes ?? "",
    userId: session.id,
  });
  return NextResponse.json({ success: true });
}
