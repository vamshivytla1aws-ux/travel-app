import Link from "next/link";
import { CarFront, Fuel, type LucideIcon, Route, Timer, Truck } from "lucide-react";
import { AppModule } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  allowedModules: AppModule[];
};

const QUICK_ACTIONS: Array<{
  label: string;
  href: string;
  module: AppModule;
  icon: LucideIcon;
}> = [
  { label: "Create Trip", href: "/trips", module: "trips", icon: Timer },
  { label: "Diesel Issue", href: "/fuel-trucks?action=issue", module: "fuel-truck", icon: Fuel },
  { label: "Add Driver", href: "/drivers?create=1", module: "drivers", icon: CarFront },
  { label: "Add Bus", href: "/buses?create=1", module: "buses", icon: Truck },
  { label: "Route Assignment", href: "/routes?create=1", module: "routes", icon: Route },
];

export function DashboardQuickActions({ allowedModules }: Props) {
  const visibleActions = QUICK_ACTIONS.filter((item) => allowedModules.includes(item.module));
  if (visibleActions.length === 0) return null;

  return (
    <Card className="gap-3">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <p className="text-[9px] font-bold tracking-[0.2em] text-[#b99a55] uppercase">Command Deck</p>
          <CardTitle className="mt-1 font-display text-2xl text-[#f0e8d9]">Quick Actions</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {visibleActions.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex min-h-12 items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm font-semibold text-[#b8c1cb] transition-all duration-200 hover:border-[#d9b966]/25 hover:bg-[#d9b966]/[0.07] hover:text-[#f0e7d5]"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-[#d9b966]/15 bg-[#d9b966]/[0.07] text-[#d9b966] transition-transform group-hover:scale-105"><Icon className="h-4 w-4" /></span>
              {item.label}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
