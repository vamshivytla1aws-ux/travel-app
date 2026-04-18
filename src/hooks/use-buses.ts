"use client";

import useSWR from "swr";
import { apiFetchJson } from "@/lib/api-fetch-json";
import { Bus } from "@/lib/types";

type BusStatus = "active" | "maintenance" | "inactive";

export function useBuses(params?: { q?: string; status?: BusStatus }) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.status) search.set("status", params.status);
  const query = search.toString();
  const key = `/api/buses${query ? `?${query}` : ""}`;

  return useSWR<Bus[]>(key, apiFetchJson, {
    refreshInterval: 20_000,
    revalidateOnFocus: true,
  });
}
