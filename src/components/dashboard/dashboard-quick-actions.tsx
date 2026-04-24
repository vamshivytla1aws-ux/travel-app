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
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {visibleActions.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium hover:bg-slate-50"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
