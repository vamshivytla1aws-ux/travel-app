import { NextResponse } from "next/server";
import { APP_MODULES, getSession, hasModuleAccess } from "@/lib/auth";
import { DashboardService } from "@/services/dashboard.service";

const dashboardService = new DashboardService();

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alerts = await dashboardService.getExceptions();
  const filtered = alerts.filter((alert) => {
    return APP_MODULES.includes(alert.moduleKey) && hasModuleAccess(session, alert.moduleKey);
  });

  return NextResponse.json({ alerts: filtered });
}

