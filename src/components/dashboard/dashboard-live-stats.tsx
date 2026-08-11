"use client";

import { useDashboardSummary } from "@/hooks/use-dashboard-summary";

export function DashboardLiveStats() {
  const { data, isLoading, error } = useDashboardSummary();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Refreshing dashboard metrics...</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-destructive">Unable to refresh dashboard metrics.</p>;
  }

  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-xs text-[#9ba8b6]">
      <span className="relative flex h-2 w-2 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
      <span className="truncate"><span className="font-semibold text-emerald-300">Live</span> · {data.activeAssignments.total} active assignments · {Number(data.fuelToday.liters).toFixed(2)} L fuel today · {data.tripStats.in_progress} trips in progress</span>
    </div>
  );
}
