"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export type GradePoint = { label: string; date: string; student: number; classAvg: number };

// Student % vs class average per assessment, oldest -> newest.
export function GradeTrendChart({ data }: { data: GradePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
        <Tooltip
          formatter={(v) => `${Math.round(Number(v))}%`}
          labelFormatter={(_, p) => (p?.[0]?.payload as GradePoint | undefined)?.label ?? ""}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="classAvg" name="Class average" stroke="#9ca3af" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="student" name="Student" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
