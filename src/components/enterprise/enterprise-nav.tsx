"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CarFront, ChevronDown, ClipboardList, Fuel, Gauge, KeyRound, MapPinned, Menu, Route, Timer, Truck, Users } from "lucide-react";
import { cn } from "@/lib/ui-core";
import { AppModule } from "@/lib/auth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

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
  const [open, setOpen] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
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
  const [adminExpanded, setAdminExpanded] = useState(adminActive);
  useEffect(() => {
    if (adminActive) setAdminExpanded(true);
  }, [adminActive]);
  useEffect(() => {
    const maybeCapacitor = (globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    const nativeByBridge = maybeCapacitor?.isNativePlatform?.() === true;
    setIsNativeApp(nativeByBridge);
  }, []);

  if (isNativeApp) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-slate-200 hover:bg-[#151b2b] hover:text-yellow-200"
            />
          }
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open navigation</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-[85vw] max-w-[300px] border-slate-700 bg-[#101422] p-0 text-slate-200">
          <SheetHeader className="border-b border-slate-700 px-4 py-3">
            <SheetTitle className="text-sm text-slate-200">Navigation</SheetTitle>
          </SheetHeader>
          <nav className="space-y-4 p-3">
            {nonAdminGroups.map((group) => (
              <div key={group.label} className="space-y-1">
                <div className="px-2 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{group.label}</div>
                {group.items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-[#1a1f31] text-yellow-300" : "text-slate-200 hover:bg-[#151b2b] hover:text-yellow-200",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
            {adminGroup ? (
              <div className="space-y-1 border-t border-slate-700 pt-3">
                <button
                  type="button"
                  onClick={() => setAdminExpanded((value) => !value)}
                  className={cn(
                    "flex w-full items-center justify-between rounded px-3 py-2 text-sm font-medium transition-colors",
                    adminActive ? "bg-[#1a1f31] text-yellow-300" : "text-slate-200 hover:bg-[#151b2b] hover:text-yellow-200",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Admin
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", adminExpanded ? "rotate-180" : "")} />
                </button>
                {adminExpanded ? (
                  <div className="space-y-1 pl-2">
                    {adminGroup.items.map((item) => {
                      const ItemIcon = item.icon;
                      const active = pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors",
                            active ? "bg-[#1a1f31] text-yellow-300" : "text-slate-200 hover:bg-[#151b2b] hover:text-yellow-200",
                          )}
                        >
                          <ItemIcon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </nav>
        </SheetContent>
      </Sheet>
    );
  }

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
