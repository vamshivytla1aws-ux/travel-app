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
    <p className="text-sm text-muted-foreground">
      Live: {data.activeAssignments.total} active assignments, {Number(data.fuelToday.liters).toFixed(2)} L fuel
      logged today, {data.tripStats.in_progress} trips in progress.
    </p>
  );
}
