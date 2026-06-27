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
    if (p === null || classAverage === null) return "text-faint";
    if (p > classAverage) return "text-success";
    if (p < classAverage) return "text-danger";
    return "text-muted";
  }

  return (
    <form action={submitGrades.bind(null, assessmentId)} className="card overflow-hidden">
      <p className="border-b border-border px-4 py-3 text-xs text-muted">
        Reviewed {reviewed} of {students.length}
        {classAverage !== null ? ` · class average ${classAverage.toFixed(1)}%` : ""}
      </p>
      {students.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted">No students assigned to you in this class.</p>
      ) : (
        <ul className="divide-y divide-border">
          {students.map((s) => {
            const isAbsent = absent[s.id] ?? false;
            const val = marks[s.id] ?? "";
            const p = pct(val);
            const reviewedRow = isAbsent || val.trim() !== "";
            return (
              <li
                key={s.id}
                className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${reviewedRow ? "" : "border-l-2 border-l-warn"}`}
              >
                <span className="flex-1 font-medium">{s.name}</span>
                <input
                  type="number"
                  name={`mark_${s.id}`}
                  value={isAbsent ? "" : val}
                  disabled={isAbsent}
                  min={0}
                  max={maxMark}
                  step="0.5"
                  onChange={(e) => setMarks((m) => ({ ...m, [s.id]: e.target.value }))}
                  className="input w-20 !py-1.5 disabled:opacity-40"
                />
                <span className="text-xs text-faint">/ {maxMark}</span>
                <span className={`w-14 text-right text-sm font-medium ${colorFor(isAbsent ? null : p)}`}>
                  {isAbsent ? "absent" : p === null ? "—" : `${p}%`}
                </span>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    name={`absent_${s.id}`}
                    checked={isAbsent}
                    onChange={(e) => setAbsent((a) => ({ ...a, [s.id]: e.target.checked }))}
                    className="accent-brand"
                  />
                  Absent
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {students.length > 0 && (
        <div className="border-t border-border p-3">
          <button type="submit" className="btn-primary w-full">Save grades</button>
        </div>
      )}
    </form>
  );
}
