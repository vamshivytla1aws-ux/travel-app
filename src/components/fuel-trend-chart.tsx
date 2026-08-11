"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function FuelTrendChart({ data }: { data: { day: string; liters: string }[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-72 w-full rounded-md bg-muted/50" />;
  }

  return (
    <div className="h-72 w-full min-h-[18rem] min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.map((d) => ({ day: d.day.slice(5), liters: Number(d.liters) }))}>
          <defs>
            <linearGradient id="fuelGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e4c36e" />
              <stop offset="100%" stopColor="#8e6b28" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: "#8290a1", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,.08)" }} tickLine={false} />
          <YAxis tick={{ fill: "#8290a1", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "rgba(217,185,102,.05)" }} contentStyle={{ background: "#091522", border: "1px solid rgba(217,185,102,.22)", borderRadius: 10, color: "#eee9dd" }} />
          <Bar dataKey="liters" fill="url(#fuelGold)" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
