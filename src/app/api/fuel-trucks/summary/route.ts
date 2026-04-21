import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { FuelTruckService } from "@/services/fuel-truck.service";

const fuelTruckService = new FuelTruckService();

export async function GET() {
  const session = await requireApiModuleAccess("fuel-truck");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const summary = await fuelTruckService.getSummary();
  return NextResponse.json(summary);
}
