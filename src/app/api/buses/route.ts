import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { BusesService } from "@/services/buses.service";

const busesService = new BusesService();

export async function GET(request: NextRequest) {
  const session = await requireApiModuleAccess("buses");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const statusRaw = request.nextUrl.searchParams.get("status");
  const status =
    statusRaw === "active" || statusRaw === "maintenance" || statusRaw === "inactive"
      ? statusRaw
      : undefined;

  const data = await busesService.listBuses(q, status);
  return NextResponse.json(data);
}
