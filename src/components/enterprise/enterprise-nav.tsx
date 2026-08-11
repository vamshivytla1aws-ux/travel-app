"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CarFront,
  ClipboardList,
  Fuel,
  Gauge,
  Info,
  KeyRound,
  Landmark,
  LogOut,
  MapPinned,
  Menu,
  Route,
  Timer,
  Truck,
  Users,
} from "lucide-react";
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
    label: "Fuel & Finance",
    items: [
      { href: "/fuel-trucks", label: "Fuel Tankers", icon: Fuel, module: "fuel-truck" as AppModule },
      { href: "/finance", label: "Finance", icon: Landmark, module: "finance" as AppModule },
    ],
  },
  {
    label: "Administration",
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

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatRoleLabel(role?: EnterpriseNavProps["userRole"]) {
  if (!role) return "Guest";
  return role.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function EnterpriseNav({ allowedModules, userFullName, userRole }: EnterpriseNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const filteredGroups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => allowedModules.includes(item.module)) }))
    .filter((group) => group.items.length > 0);

  const navigation = (mobile = false) => (
    <nav
      aria-label="Main navigation"
      className={cn(
        "space-y-5",
        mobile ? "px-3 py-4" : "sidebar-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-5 xl:px-3",
      )}
    >
      {filteredGroups.map((group) => (
        <div key={group.label} className="space-y-1.5">
          <p className={cn("px-3 text-[9px] font-bold tracking-[0.2em] text-[#687789] uppercase", mobile ? "" : "hidden xl:block")}>
            {group.label}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={!mobile ? item.label : undefined}
                onClick={() => mobile && setMobileOpen(false)}
                className={cn(
                  "group relative flex min-h-11 items-center rounded-lg text-sm font-semibold transition-[background-color,color,border-color,transform] duration-200",
                  mobile ? "gap-3 px-3" : "justify-center px-2 xl:justify-start xl:gap-3 xl:px-3",
                  active
                    ? "border border-[#d9b966]/25 bg-[#d9b966]/10 text-[#eccf85] shadow-[inset_3px_0_0_#d9b966]"
                    : "border border-transparent text-[#93a0af] hover:border-white/[0.06] hover:bg-white/[0.035] hover:text-[#f0e7d5]",
                )}
              >
                <Icon className={cn("h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105", active && "text-[#d9b966]")} />
                <span className={cn(mobile ? "" : "hidden xl:inline")}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[76px] flex-col overflow-hidden border-r border-white/[0.07] bg-[#050c15]/96 shadow-[20px_0_70px_rgba(0,0,0,.24)] backdrop-blur-xl lg:flex xl:w-[248px]">
        <div className="flex h-[88px] items-center justify-center border-b border-white/[0.07] px-3 xl:justify-start xl:px-5">
          <Image src="/brand/jbt-mark.webp" alt="Jai Bhavani Travels" width={46} height={46} className="h-11 w-11 object-contain mix-blend-screen xl:hidden" priority />
          <Image src="/brand/jai-bhavani-logo-horizontal.webp" alt="Jai Bhavani Travels" width={210} height={58} className="hidden h-auto w-[198px] object-contain mix-blend-screen xl:block" priority />
        </div>
        {navigation(false)}
        <div className="border-t border-white/[0.07] p-2 xl:p-3">
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="flex min-h-10 w-full items-center justify-center gap-3 rounded-lg text-[#788697] transition-colors hover:bg-white/[0.035] hover:text-[#e3c477] xl:justify-start xl:px-3"
            title="About"
          >
            <Info className="h-4 w-4" />
            <span className="hidden text-xs font-semibold xl:inline">About System</span>
          </button>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger render={<Button size="icon" variant="ghost" className="fixed left-3 top-3 z-50 lg:hidden" />}>
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open navigation</span>
        </SheetTrigger>
        <SheetContent side="left" overlayClassName="bg-black/65 backdrop-blur-sm" className="w-[86vw] max-w-[350px] border-r border-[#d9b966]/20 bg-[#060e18] p-0 text-[#eee9dd]">
          <SheetHeader className="border-b border-white/[0.07] px-5 py-5 text-left">
            <Image src="/brand/jai-bhavani-logo-horizontal.webp" alt="Jai Bhavani Travels" width={205} height={56} className="h-auto w-[190px] object-contain mix-blend-screen" priority />
            <SheetTitle className="sr-only">Jai Bhavani Travels Navigation</SheetTitle>
            <p className="pt-2 text-[10px] tracking-[0.14em] text-[#8290a1] uppercase">
              {formatRoleLabel(userRole)}{userFullName ? ` · ${userFullName}` : ""}
            </p>
          </SheetHeader>
          <div className="sidebar-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto">{navigation(true)}</div>
          <div className="space-y-1 border-t border-white/[0.07] p-3">
            <button type="button" onClick={() => { setMobileOpen(false); setAboutOpen(true); }} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-[#a0abb8] hover:bg-white/[0.04] hover:text-[#e4c578]">
              <Info className="h-4 w-4" /> About System
            </button>
            {userRole ? (
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-[#e49494] hover:bg-red-950/30">
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </form>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="max-w-xl border-[#d9b966]/20 bg-[#0a1624] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl text-[#f0e8d9]">About AASTHIX</DialogTitle>
            <DialogDescription>Product information and company contact details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 text-sm text-[#b7c0ca]">
            <p><span className="font-semibold text-[#eee9dd]">Developed by:</span> aasthix talent pvt ltd</p>
            <p><span className="font-semibold text-[#eee9dd]">Company Name:</span> AASTHIX</p>
            <p><span className="font-semibold text-[#eee9dd]">URL:</span> <a href="https://www.aasthix.com" target="_blank" rel="noreferrer" className="text-[#dfbd6e] underline underline-offset-2">www.aasthix.com</a></p>
            <p><span className="font-semibold text-[#eee9dd]">Reachout to:</span> <a href="mailto:contact@aasthix.com" className="text-[#dfbd6e] underline underline-offset-2">contact@aasthix.com</a></p>
            <p><span className="font-semibold text-[#eee9dd]">Author:</span> Vamshi Vytla</p>
            <p className="leading-relaxed"><span className="font-semibold text-[#eee9dd]">Address:</span> Unit.No. 114, Manjeera Trinity Corporate, JNTU - Hitech Road, beside LuLu Mall, Ashok Nagar, Kukatpally Housing Board Colony, Kukatpally, Hyderabad, Telangana 500072.</p>
            <p><span className="font-semibold text-[#eee9dd]">Tel:</span> <a href="tel:+919573543933" className="text-[#dfbd6e] underline underline-offset-2">+91 9573543933</a></p>
          </div>
          <DialogFooter><DialogClose render={<Button variant="outline" />}>Close</DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
