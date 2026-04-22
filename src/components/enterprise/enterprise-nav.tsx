"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CarFront, ChevronDown, ClipboardList, Fuel, Gauge, Info, KeyRound, Landmark, LogOut, MapPinned, Menu, Route, Timer, Truck, Users } from "lucide-react";
import { cn } from "@/lib/ui-core";
import { AppModule } from "@/lib/auth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
      { href: "/finance", label: "Finance", icon: Landmark, module: "finance" as AppModule },
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

type EnterpriseNavProps = {
  allowedModules: AppModule[];
  userFullName?: string;
  userRole?: "admin" | "dispatcher" | "fuel_manager" | "viewer" | "updater";
};

function formatRoleLabel(role?: EnterpriseNavProps["userRole"]) {
  if (!role) return "Guest";
  if (role === "fuel_manager") return "Fuel Manager";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function EnterpriseNav({ allowedModules, userFullName, userRole }: EnterpriseNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const filteredGroups = navGroups
    .map((group) => ({
      label: group.label,
      items: group.items.filter((item) => allowedModules.includes(item.module)),
    }))
    .filter((group) => group.items.length > 0);

  const adminGroup = filteredGroups.find((group) => group.label === "Admin");
  const adminItems = adminGroup?.items ?? [];
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

  const adminActive = Boolean(adminItems.some((item) => pathname.startsWith(item.href)));
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
        <SheetContent
          side="left"
          overlayClassName="bg-black/55 supports-backdrop-filter:backdrop-blur-sm"
          className="w-[82vw] max-w-[340px] border-slate-700 bg-[#101422] p-0 text-slate-200"
        >
          <SheetHeader className="border-b border-slate-700 bg-[#141a2a] px-4 py-4">
            <SheetTitle className="text-base text-white">Jai Bhavani Travels</SheetTitle>
            <p className="text-xs text-slate-400">
              {formatRoleLabel(userRole)}
              {userFullName ? ` • ${userFullName}` : ""}
            </p>
          </SheetHeader>
          <nav className="space-y-3 p-3">
            {nonAdminGroups.map((group) => (
              <div key={group.label} className="space-y-1.5">
                <div className="px-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{group.label}</div>
                {group.items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-[#1f2942] text-yellow-300 shadow-[inset_0_0_0_1px_rgba(250,204,21,0.35)]"
                          : "text-slate-200 hover:bg-[#151b2b] hover:text-yellow-200",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
            {userRole ? (
              <div className="space-y-1.5 border-t border-slate-700 pt-3">
                <div className="px-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Admin</div>
                <button
                  type="button"
                  onClick={() => setAdminExpanded((value) => !value)}
                  aria-expanded={adminExpanded}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    adminExpanded || adminActive
                      ? "border-slate-500 bg-[#1a243d] text-yellow-300"
                      : "border-slate-700 text-slate-200 hover:bg-[#151b2b] hover:text-yellow-200",
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
                    {adminItems.map((item) => {
                      const ItemIcon = item.icon;
                      const active = pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                            active
                              ? "bg-[#1f2942] text-yellow-300 shadow-[inset_0_0_0_1px_rgba(250,204,21,0.35)]"
                              : "text-slate-200 hover:bg-[#151b2b] hover:text-yellow-200",
                          )}
                        >
                          <ItemIcon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setAboutOpen(true);
                      }}
                      className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-[#151b2b] hover:text-yellow-200"
                    >
                      <Info className="h-4 w-4" />
                      About
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {userRole ? (
              <div className="space-y-1.5 border-t border-slate-700 pt-3">
                <Link
                  href="/api/auth/logout"
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-rose-200 transition-colors hover:bg-rose-900/30 hover:text-rose-100"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Link>
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
        {userRole ? (
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
                {adminItems.map((item) => {
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
                {userRole ? (
                  <button
                    type="button"
                    onClick={() => setAboutOpen(true)}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-[#151b2b] hover:text-yellow-200"
                  >
                    <Info className="h-4 w-4" />
                    About
                  </button>
                ) : null}
              </div>
            </details>
          </div>
        ) : null}
      </div>
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="max-w-xl rounded-2xl border border-white/40 bg-white/65 shadow-2xl backdrop-blur-md">
          <DialogHeader>
            <DialogTitle>About AASTHIX</DialogTitle>
            <DialogDescription>
              Product information and company contact details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 text-sm text-slate-900">
            <p><span className="font-semibold">Developed by:</span> aasthix talent pvt ltd</p>
            <p><span className="font-semibold">Company Name:</span> AASTHIX</p>
            <p>
              <span className="font-semibold">URL:</span>{" "}
              <a href="https://www.aasthix.com" target="_blank" rel="noreferrer" className="text-blue-700 underline underline-offset-2">
                www.aasthix.com
              </a>
            </p>
            <p>
              <span className="font-semibold">Reachout to:</span>{" "}
              <a href="mailto:contact@aasthix.com" className="text-blue-700 underline underline-offset-2">
                contact@aasthix.com
              </a>
            </p>
            <p><span className="font-semibold">Author:</span> Vamshi Vytla</p>
            <p className="leading-relaxed">
              <span className="font-semibold">Address:</span> Unit.No. 114, Manjeera Trinity Corporate, JNTU - Hitech Road, beside LuLu Mall, Ashok Nagar, Kukatpally Housing Board Colony, Kukatpally, Hyderabad, Telangana 500072.
            </p>
            <p>
              <span className="font-semibold">Tel:</span>{" "}
              <a href="tel:+919573543933" className="text-blue-700 underline underline-offset-2">
                +91 9573543933
              </a>
            </p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
