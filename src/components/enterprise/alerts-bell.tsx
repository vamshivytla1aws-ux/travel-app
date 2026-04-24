"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, X } from "lucide-react";
import type { DashboardExceptionAlert } from "@/services/dashboard.service";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeInAppTimeZone } from "@/lib/timezone";
import { cn } from "@/lib/ui-core";

type AlertsResponse = {
  alerts: DashboardExceptionAlert[];
};

const DISMISSED_ALERTS_STORAGE_KEY = "etms:dismissed-alerts";

function readDismissedAlertIds() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DISMISSED_ALERTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((value) => String(value));
  } catch {
    return [];
  }
}

function writeDismissedAlertIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DISMISSED_ALERTS_STORAGE_KEY, JSON.stringify(ids));
}

function severityBadgeVariant(severity: DashboardExceptionAlert["severity"]) {
  if (severity === "critical") return "destructive";
  if (severity === "warning") return "secondary";
  return "outline";
}

export function AlertsBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<DashboardExceptionAlert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    setDismissedIds(readDismissedAlertIds());
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadAlerts() {
      try {
        setLoading(true);
        const response = await fetch("/api/alerts", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load alerts");
        const payload = (await response.json()) as AlertsResponse;
        if (!mounted) return;
        setAlerts(payload.alerts ?? []);
      } catch {
        if (!mounted) return;
        setAlerts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAlerts();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleAlerts = useMemo(
    () => alerts.filter((alert) => !dismissedIds.includes(alert.id)),
    [alerts, dismissedIds],
  );

  function dismissAlert(alertId: string) {
    const next = Array.from(new Set([...dismissedIds, alertId]));
    setDismissedIds(next);
    writeDismissedAlertIds(next);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "relative inline-flex h-9 items-center justify-center rounded px-2 text-slate-200 transition-colors hover:bg-[#151b2b] hover:text-yellow-200",
          open ? "bg-[#151b2b] text-yellow-200" : "",
        )}
        aria-label="Alerts"
        title="Alerts"
      >
        <Bell className="h-4 w-4" />
        {visibleAlerts.length > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {visibleAlerts.length > 99 ? "99+" : visibleAlerts.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[360px] max-w-[90vw] rounded border border-slate-700 bg-[#0f1627] p-2 shadow-2xl">
          <div className="mb-2 flex items-center justify-between border-b border-slate-700 pb-2">
            <p className="text-sm font-semibold text-slate-100">Alerts</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-slate-300 transition-colors hover:bg-[#151b2b] hover:text-white"
              aria-label="Close alerts panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {loading ? (
              <p className="px-1 py-2 text-xs text-slate-300">Loading alerts...</p>
            ) : visibleAlerts.length === 0 ? (
              <p className="px-1 py-2 text-xs text-emerald-300">No active alerts.</p>
            ) : (
              visibleAlerts.map((alert) => (
                <div key={alert.id} className="rounded border border-slate-700 bg-[#111a2d] p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold text-slate-100">{alert.title}</p>
                        <Badge variant={severityBadgeVariant(alert.severity)}>{alert.severity}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-300">{alert.description}</p>
                      {alert.at ? (
                        <p className="text-[10px] text-slate-400">
                          {formatDateTimeInAppTimeZone(alert.at)}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissAlert(alert.id)}
                      className="rounded p-1 text-slate-300 transition-colors hover:bg-[#1c2b4a] hover:text-white"
                      aria-label={`Dismiss alert ${alert.title}`}
                      title="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

