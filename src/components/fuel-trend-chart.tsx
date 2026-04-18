"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="liters" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
