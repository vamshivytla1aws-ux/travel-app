import { AppShell } from "@/components/app-shell";
import { DashboardLiveStats } from "@/components/dashboard/dashboard-live-stats";
import { DashboardQuickActions } from "@/components/dashboard/dashboard-quick-actions";
import { EnterprisePageHeader } from "@/components/enterprise/enterprise-page-header";
import { ModuleExportLauncher } from "@/components/exports/module-export-launcher";
import { CarFront, Fuel, Gauge, Timer, TriangleAlert, Truck, Users, type LucideIcon } from "lucide-react";
import { FuelTrendChart } from "@/components/fuel-trend-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardService } from "@/services/dashboard.service";
import { FuelTruckService } from "@/services/fuel-truck.service";
import { APP_MODULES, requireSession } from "@/lib/auth";
import { requireModuleAccess } from "@/lib/auth";
import { formatDateTimeInAppTimeZone } from "@/lib/timezone";

const dashboardService = new DashboardService();
const fuelTruckService = new FuelTruckService();

function MetricCard({ label, value, icon: Icon, tone = "gold" }: { label: string; value: string | number; icon: LucideIcon; tone?: "gold" | "emerald" | "amber" }) {
  const toneClass = tone === "emerald" ? "text-emerald-300 bg-emerald-400/[0.08] border-emerald-400/15" : tone === "amber" ? "text-amber-300 bg-amber-400/[0.08] border-amber-400/15" : "text-[#dfbd6e] bg-[#d9b966]/[0.08] border-[#d9b966]/15";
  return (
    <Card className="group min-h-[132px] justify-between gap-2 overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <CardTitle className="max-w-[11rem] text-xs font-semibold leading-relaxed text-[#95a1af]">{label}</CardTitle>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${toneClass}`}><Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" /></span>
      </CardHeader>
      <CardContent className="flex items-end justify-between">
        <strong className="font-operational text-2xl font-semibold tracking-[-0.04em] text-[#f3eee5]">{value}</strong>
        <span className="mb-1 h-px w-8 bg-gradient-to-r from-[#d9b966]/50 to-transparent" aria-hidden />
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  await requireModuleAccess("dashboard");
  const allowedModules = session.role === "admin" ? [...APP_MODULES] : session.moduleAccess;
  const [data, fuelTruckSummary] = await Promise.all([
    dashboardService.getSummary(),
    fuelTruckService.getSummary(),
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <EnterprisePageHeader
          title="Operations Dashboard"
          subtitle="Fleet health, fuel trends, and recent transport activity"
          icon={Gauge}
          tag="Control Center"
          actions={
            <ModuleExportLauncher
              moduleKey="overall"
              moduleLabel="Overall"
              basePath="/dashboard"
              searchParams={{}}
            />
          }
        />
        <div className="-mt-5 px-1">
          <DashboardLiveStats />
        </div>
        <DashboardQuickActions allowedModules={allowedModules} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total Buses" value={data.fleet.total} icon={Truck} />
          <MetricCard label="Active Drivers" value={data.drivers.total} icon={CarFront} tone="emerald" />
          <MetricCard label="Active Buses" value={data.fleet.active} icon={Gauge} tone="emerald" />
          <MetricCard label="Employees Served" value={data.employees.total} icon={Users} />
          <MetricCard label="Fuel Today (L)" value={Number(data.fuelToday.liters).toFixed(2)} icon={Fuel} tone="amber" />
          <MetricCard label="Trips In Progress" value={data.tripStats.in_progress} icon={Timer} tone="emerald" />
          <MetricCard label="Fuel Tankers" value={fuelTruckSummary.truckStocks.length} icon={Truck} />
          <MetricCard label="Fuel Tanker Low Alerts" value={fuelTruckSummary.lowStock.length} icon={TriangleAlert} tone="amber" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <p className="text-[9px] font-bold tracking-[0.2em] text-[#b99a55] uppercase">Consumption Intelligence</p>
              <CardTitle className="font-display text-2xl text-[#f0e8d9]">Fuel Trend (Last 14 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <FuelTrendChart data={data.fuelTrend} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <p className="text-[9px] font-bold tracking-[0.2em] text-[#b99a55] uppercase">Live Schedule</p>
              <CardTitle className="font-display text-2xl text-[#f0e8d9]">Trip Snapshot Today</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                <span>Planned</span>
                <span className="font-semibold">{data.tripStats.planned}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                <span>In Progress</span>
                <span className="font-semibold">{data.tripStats.in_progress}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                <span>Completed</span>
                <span className="font-semibold">{data.tripStats.completed}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                <span>Cancelled</span>
                <span className="font-semibold">{data.tripStats.cancelled}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <p className="text-[9px] font-bold tracking-[0.2em] text-[#b99a55] uppercase">Operations Timeline</p>
            <CardTitle className="font-display text-2xl text-[#f0e8d9]">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentActivity.map((event, index) => (
              <div key={`${event.type}-${index}`} className="relative rounded-lg border border-white/[0.07] bg-white/[0.018] py-3 pl-9 pr-3 text-sm before:absolute before:left-4 before:top-[1.15rem] before:h-2 before:w-2 before:rounded-full before:bg-[#d9b966] before:shadow-[0_0_0_5px_rgba(217,185,102,.08)]">
                <p className="font-medium">{event.title}</p>
                <p className="mt-1 font-operational text-[10px] text-[#758496]">{formatDateTimeInAppTimeZone(event.at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl text-[#f0e8d9]">Fuel Tanker Stock Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {fuelTruckSummary.truckStocks.slice(0, 8).map((stock) => (
                <div key={stock.truckId} className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                  <span>{stock.truckCode}</span>
                  <span className="font-semibold">{stock.currentStock.toFixed(2)} L</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl text-[#f0e8d9]">Fuel Tanker Transactions Today</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                <span>Refilled Today</span>
                <span className="font-semibold">{fuelTruckSummary.today.refilledLiters.toFixed(2)} L</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                <span>Issued Today</span>
                <span className="font-semibold">{fuelTruckSummary.today.issuedLiters.toFixed(2)} L</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
