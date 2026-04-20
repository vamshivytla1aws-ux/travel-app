"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CarFront, ClipboardList, Gauge, KeyRound, MapPinned, Route, Timer, Truck, Users, Fuel } from "lucide-react";
import { cn } from "@/lib/ui-core";
import { AppModule } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge, module: "dashboard" as AppModule },
  { href: "/buses", label: "Buses", icon: Truck, module: "buses" as AppModule },
  { href: "/trips", label: "Trips", icon: Timer, module: "trips" as AppModule },
  { href: "/drivers", label: "Drivers", icon: CarFront, module: "drivers" as AppModule },
  { href: "/employees", label: "Employees", icon: Users, module: "employees" as AppModule },
  { href: "/routes", label: "Routes", icon: Route, module: "routes" as AppModule },
  { href: "/tracking", label: "Tracking", icon: MapPinned, module: "tracking" as AppModule },
  { href: "/fuel-entry", label: "Fuel Entry", icon: Fuel, module: "fuel-entry" as AppModule },
  { href: "/fuel-trucks", label: "Fuel Tankers", icon: Fuel, module: "fuel-truck" as AppModule },
  { href: "/admin/users", label: "Users", icon: KeyRound, module: "user-admin" as AppModule },
  { href: "/logs", label: "Logs", icon: ClipboardList, module: "logs" as AppModule },
];

export function EnterpriseNav({ allowedModules }: { allowedModules: AppModule[] }) {
  const pathname = usePathname();
  const filteredItems = navItems.filter((item) => allowedModules.includes(item.module));

  return (
    <nav className="flex flex-wrap items-center overflow-hidden rounded border border-slate-700 bg-[#101422]">
      {filteredItems.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 border-r border-slate-700 px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-[#1a1f31] text-yellow-300"
                : "text-slate-200 hover:bg-[#151b2b] hover:text-yellow-200",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
