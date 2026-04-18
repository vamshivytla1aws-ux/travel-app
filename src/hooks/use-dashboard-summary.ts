"use client";

import useSWR from "swr";
import { apiFetchJson } from "@/lib/api-fetch-json";

export type DashboardSummaryResponse = {
  fleet: { total: string; active: string; maintenance: string };
  drivers: { total: string };
  employees: { total: string };
  activeAssignments: { total: string };
  fuelToday: { liters: string; amount: string };
  tripStats: { planned: string; in_progress: string; completed: string; cancelled: string };
  fuelTrend: { day: string; liters: string }[];
  recentActivity: { type: string; title: string; at: string }[];
};

export function useDashboardSummary() {
  return useSWR<DashboardSummaryResponse>("/api/dashboard/summary", apiFetchJson, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });
}
