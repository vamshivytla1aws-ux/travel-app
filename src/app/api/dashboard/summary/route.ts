import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/auth";
import { DashboardService } from "@/services/dashboard.service";

const dashboardService = new DashboardService();

export async function GET() {
  const session = await requireApiModuleAccess("dashboard");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await dashboardService.getSummary();
  return NextResponse.json(data);
}
