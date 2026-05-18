"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { StateRollup } from "@/lib/types";

export default function StateBarChart({ rows }: { rows: StateRollup[] }) {
  const sorted = [...rows].sort((a, b) => b.story_count - a.story_count).slice(0, 15);
  const max = sorted[0]?.story_count ?? 1;
  return (
    <div className="h-96 w-full">
      <ResponsiveContainer>
        <BarChart data={sorted} layout="vertical" margin={{ top: 10, right: 20, left: 80, bottom: 0 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis type="number" stroke="#64748b" fontSize={11} allowDecimals={false} />
          <YAxis dataKey="state" type="category" stroke="#64748b" fontSize={11} width={120} />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#e2e8f0" }}
          />
          <Bar dataKey="story_count" radius={[0, 6, 6, 0]}>
            {sorted.map((r) => {
              const intensity = Math.round(80 + (r.story_count / max) * 175);
              return <Cell key={r.state} fill={`rgb(34, ${intensity}, 211)`} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
