"use client";

import { useState } from "react";
import { submitGrades } from "@/actions/assessment-grades";

export type GradeRow = { id: string; name: string; mark: string; absent: boolean };

export function GradeEntryForm({
  assessmentId,
  maxMark,
  classAverage,
  students,
}: {
  assessmentId: string;
  maxMark: number;
  classAverage: number | null;
  students: GradeRow[];
}) {
  const [marks, setMarks] = useState<Record<string, string>>(
    Object.fromEntries(students.map((s) => [s.id, s.mark])),
  );
  const [absent, setAbsent] = useState<Record<string, boolean>>(
    Object.fromEntries(students.map((s) => [s.id, s.absent])),
  );

  const reviewed = students.filter((s) => absent[s.id] || (marks[s.id] ?? "").trim() !== "").length;

  function pct(raw: string): number | null {
    const n = Number(raw);
    if (raw.trim() === "" || Number.isNaN(n)) return null;
    return Math.round((Math.min(maxMark, Math.max(0, n)) / maxMark) * 1000) / 10;
  }
  function colorFor(p: number | null): string {
    if (p === null || classAverage === null) return "text-black/40";
    if (p > classAverage) return "text-green-600";
    if (p < classAverage) return "text-red-600";
    return "text-black/50";
  }

  return (
    <form action={submitGrades.bind(null, assessmentId)} className="flex flex-col gap-3">
      <p className="text-xs text-black/50 dark:text-white/50">
        Reviewed {reviewed} of {students.length}
        {classAverage !== null ? ` · class average ${classAverage.toFixed(1)}%` : ""}
      </p>
      {students.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">No students assigned to you in this class.</p>
      ) : (
        <ul className="flex flex-col">
          {students.map((s) => {
            const isAbsent = absent[s.id] ?? false;
            const val = marks[s.id] ?? "";
            const p = pct(val);
            const reviewedRow = isAbsent || val.trim() !== "";
            return (
              <li
                key={s.id}
                className={`flex flex-wrap items-center gap-3 border-b border-black/5 py-2 dark:border-white/5 ${
                  reviewedRow ? "" : "border-l-2 border-l-amber-400 pl-2"
                }`}
              >
                <span className="flex-1">{s.name}</span>
                <input
                  type="number"
                  name={`mark_${s.id}`}
                  value={isAbsent ? "" : val}
                  disabled={isAbsent}
                  min={0}
                  max={maxMark}
                  step="0.5"
                  onChange={(e) => setMarks((m) => ({ ...m, [s.id]: e.target.value }))}
                  className="w-20 rounded-md border border-black/15 bg-white px-2 py-1 text-sm outline-none focus:border-black/40 disabled:opacity-40 dark:border-white/20 dark:bg-transparent"
                />
                <span className="text-xs text-black/40">/ {maxMark}</span>
                <span className={`w-14 text-right text-sm ${colorFor(isAbsent ? null : p)}`}>
                  {isAbsent ? "absent" : p === null ? "—" : `${p}%`}
                </span>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    name={`absent_${s.id}`}
                    checked={isAbsent}
                    onChange={(e) => setAbsent((a) => ({ ...a, [s.id]: e.target.checked }))}
                  />
                  Absent
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {students.length > 0 && (
        <button
          type="submit"
          className="mt-1 self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Save grades
        </button>
      )}
    </form>
  );
}
