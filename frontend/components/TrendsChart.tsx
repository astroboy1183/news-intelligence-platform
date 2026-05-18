"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TrendSeries } from "@/lib/types";

const COLORS = [
  "#22d3ee", "#a78bfa", "#34d399", "#f97316", "#facc15",
  "#f472b6", "#60a5fa", "#fbbf24", "#fb7185", "#94a3b8",
];

export default function TrendsChart({ series }: { series: TrendSeries[] }) {
  const allBuckets = new Set<string>();
  series.forEach((s) => s.points.forEach((p) => allBuckets.add(p.bucket)));
  const sorted = [...allBuckets].sort();
  const data = sorted.map((bucket) => {
    const row: Record<string, string | number> = { bucket: bucket.slice(0, 10) };
    series.forEach((s) => {
      const point = s.points.find((p) => p.bucket === bucket);
      row[s.name] = point ? point.count : 0;
    });
    return row;
  });

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis dataKey="bucket" stroke="#64748b" fontSize={11} />
          <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#e2e8f0" }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s, i) => (
            <Line
              key={s.slug}
              type="monotone"
              dataKey={s.name}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
