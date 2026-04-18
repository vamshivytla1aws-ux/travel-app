import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { DashboardService } from "@/services/dashboard.service";

const dashboardService = new DashboardService();

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await dashboardService.getSummary();
  return NextResponse.json(data);
}
