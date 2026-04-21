import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { FuelTruckService } from "@/services/fuel-truck.service";

const fuelTruckService = new FuelTruckService();

export async function GET(request: NextRequest) {
  const session = await requireApiModuleAccess("fuel-truck");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const search = String(request.nextUrl.searchParams.get("search") ?? "");
  const statusRaw = String(request.nextUrl.searchParams.get("status") ?? "");
  const status = statusRaw === "active" || statusRaw === "inactive" ? statusRaw : undefined;
  const trucks = await fuelTruckService.listFuelTrucks(search, status);
  return NextResponse.json(trucks);
}

export async function POST(request: NextRequest) {
  const session = await requireApiModuleAccess("fuel-truck");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "dispatcher", "fuel_manager", "updater"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const truckCode = String(body?.truckCode ?? "").trim();
  const truckName = String(body?.truckName ?? "").trim();
  const registrationNumber = String(body?.registrationNumber ?? "").trim();
  const tankCapacityLiters = Number(body?.tankCapacityLiters ?? 0);
  const currentAvailableLiters = Number(body?.currentAvailableLiters ?? 0);
  const lowStockThresholdLiters = Number(body?.lowStockThresholdLiters ?? 0);
  const status = String(body?.status ?? "active");

  if (!truckCode || !truckName || !registrationNumber) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const id = await fuelTruckService.createFuelTruck({
    truckCode,
    truckName,
    registrationNumber,
    tankCapacityLiters,
    currentAvailableLiters,
    lowStockThresholdLiters,
    status: status === "inactive" ? "inactive" : "active",
    notes: String(body?.notes ?? ""),
    userId: session.id,
  });
  return NextResponse.json({ id }, { status: 201 });
}
