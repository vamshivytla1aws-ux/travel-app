"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CarFront, ChevronDown, ClipboardList, Gauge, KeyRound, MapPinned, Route, Timer, Truck, Users, Fuel } from "lucide-react";
import { cn } from "@/lib/ui-core";
import { AppModule } from "@/lib/auth";

const navGroups = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Gauge, module: "dashboard" as AppModule },
      { href: "/buses", label: "Buses", icon: Truck, module: "buses" as AppModule },
      { href: "/trips", label: "Trips", icon: Timer, module: "trips" as AppModule },
      { href: "/drivers", label: "Drivers", icon: CarFront, module: "drivers" as AppModule },
      { href: "/employees", label: "Employees", icon: Users, module: "employees" as AppModule },
      { href: "/routes", label: "Routes", icon: Route, module: "routes" as AppModule },
      { href: "/tracking", label: "Tracking", icon: MapPinned, module: "tracking" as AppModule },
    ],
  },
  {
    label: "Fuel",
    items: [
      { href: "/fuel-entry", label: "Fuel Entry", icon: Fuel, module: "fuel-entry" as AppModule },
      { href: "/fuel-trucks", label: "Fuel Tankers", icon: Fuel, module: "fuel-truck" as AppModule },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/admin/users", label: "Users", icon: KeyRound, module: "user-admin" as AppModule },
      { href: "/logs", label: "Logs", icon: ClipboardList, module: "logs" as AppModule },
    ],
  },
];

export function EnterpriseNav({ allowedModules }: { allowedModules: AppModule[] }) {
  const pathname = usePathname();
  const filteredGroups = navGroups
    .map((group) => ({
      label: group.label,
      items: group.items.filter((item) => allowedModules.includes(item.module)),
    }))
    .filter((group) => group.items.length > 0);

  const adminGroup = filteredGroups.find((group) => group.label === "Admin");
  const nonAdminGroups = filteredGroups.filter((group) => group.label !== "Admin");

  const flatItems = nonAdminGroups.flatMap((group, groupIndex) =>
    group.items.map((item, itemIndex) => ({
      ...item,
      groupLabel: group.label,
      showGroupLabel: itemIndex === 0,
      key: `${group.label}-${item.href}`,
      dividerBefore: groupIndex > 0 && itemIndex === 0,
    })),
  );

  const adminActive = Boolean(adminGroup?.items.some((item) => pathname.startsWith(item.href)));

  return (
    <nav className="rounded border border-slate-700 bg-[#101422]">
      <div className="flex items-center gap-1 px-1 py-1 md:flex-nowrap">
        {flatItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <div key={item.key} className="flex items-center">
              {item.dividerBefore ? (
                <div className="mx-1 h-6 w-px bg-slate-700" aria-hidden />
              ) : null}
              {item.showGroupLabel ? (
                <span className="mr-1 rounded bg-slate-800 px-2 py-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  {item.groupLabel}
                </span>
              ) : null}
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-[#1a1f31] text-yellow-300"
                    : "text-slate-200 hover:bg-[#151b2b] hover:text-yellow-200",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            </div>
          );
        })}
        {adminGroup ? (
          <div className="ml-auto flex items-center">
            <div className="mx-1 h-6 w-px bg-slate-700" aria-hidden />
            <details className="group relative">
              <summary
                className={cn(
                  "flex cursor-pointer list-none items-center gap-2 rounded px-3 py-2 text-sm font-medium transition-colors marker:content-none",
                  adminActive
                    ? "bg-[#1a1f31] text-yellow-300"
                    : "text-slate-200 hover:bg-[#151b2b] hover:text-yellow-200",
                )}
              >
                <span className="rounded bg-slate-800 px-2 py-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  Admin
                </span>
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 z-40 mt-1 w-48 rounded border border-slate-700 bg-[#0f1627] p-1 shadow-xl">
                {adminGroup.items.map((item) => {
                  const ItemIcon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-[#1a1f31] text-yellow-300"
                          : "text-slate-200 hover:bg-[#151b2b] hover:text-yellow-200",
                      )}
                    >
                      <ItemIcon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </details>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
