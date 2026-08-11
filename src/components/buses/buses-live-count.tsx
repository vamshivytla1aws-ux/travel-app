"use client";

import { useBuses } from "@/hooks/use-buses";

export function BusesLiveCount() {
  const { data, isLoading } = useBuses();

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Refreshing fleet count...</p>;
  }

  return (
    <p className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-xs text-[#9ba8b6]">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,.08)]" aria-hidden />
      Live fleet <span className="font-mono font-semibold text-[#e8edeb]">{data?.length ?? 0}</span>
    </p>
  );
}
