"use client";

import { useBuses } from "@/hooks/use-buses";

export function BusesLiveCount() {
  const { data, isLoading } = useBuses();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Refreshing fleet count...</p>;
  }

  return (
    <p className="text-sm text-muted-foreground">
      Live fleet count: <span className="font-medium text-foreground">{data?.length ?? 0}</span>
    </p>
  );
}
