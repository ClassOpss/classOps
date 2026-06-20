"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

export type TopicDatum = { topic: string; avg: number; n: number };

// Bar per topic; green above the overall average, red below (spec 5.14 colour rule).
export function TopicChart({ data, overallAvg }: { data: TopicDatum[]; overallAvg: number }) {
  if (data.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">No graded (non-diagnostic) assessments with a topic yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
        <YAxis type="category" dataKey="topic" width={150} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(v) => `${Number(v).toFixed(1)}%`}
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
        />
        <ReferenceLine x={overallAvg} stroke="#888" strokeDasharray="3 3" />
        <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.avg >= overallAvg ? "#16a34a" : "#dc2626"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
