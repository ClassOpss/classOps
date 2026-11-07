"use client";

import { useState } from "react";
import { submitGrades } from "@/actions/assessment-grades";
import { letterFor, type Boundary } from "@/lib/grade-boundaries";

export type GradeRow = { id: string; name: string; mark: string; absent: boolean };
export type InheritedGradeRow = GradeRow & { by: string }; // by = the assistant who corrected it

export function GradeEntryForm({
  assessmentId,
  maxMark,
  classAverage,
  students,
  inherited = [],
  boundaries = null,
}: {
  assessmentId: string;
  maxMark: number;
  classAverage: number | null;
  students: GradeRow[];
  // Corrected by an assistant who has left the class: editable, but not counted as yours.
  inherited?: InheritedGradeRow[];
  boundaries?: Boundary[] | null;
}) {
  const all = [...students, ...inherited];
  const [marks, setMarks] = useState<Record<string, string>>(
    Object.fromEntries(all.map((s) => [s.id, s.mark])),
  );
  const [absent, setAbsent] = useState<Record<string, boolean>>(
    Object.fromEntries(all.map((s) => [s.id, s.absent])),
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

  function row(s: GradeRow, opts: { by?: string; flagBlank: boolean }) {
    const isAbsent = absent[s.id] ?? false;
    const val = marks[s.id] ?? "";
    const p = pct(val);
    const reviewedRow = isAbsent || val.trim() !== "";
    const letter =
      opts.by !== undefined && boundaries && !isAbsent && p !== null
        ? letterFor(Math.min(maxMark, Math.max(0, Number(val))), boundaries)
        : null;
    return (
      <li
        key={s.id}
        className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${reviewedRow || !opts.flagBlank ? "" : "border-l-2 border-l-warn"}`}
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
        {opts.by !== undefined && <span className="w-8 text-center text-sm font-semibold">{letter ?? "—"}</span>}
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
        {opts.by !== undefined && <span className="w-full text-xs text-muted sm:w-auto">by {opts.by}</span>}
      </li>
    );
  }

  return (
    <form action={submitGrades.bind(null, assessmentId)} className="card overflow-hidden">
      <p className="border-b border-border px-4 py-3 text-xs text-muted">
        Reviewed {reviewed} of {students.length}
        {classAverage !== null ? ` · class average ${classAverage.toFixed(1)}%` : ""}
      </p>
      {students.length === 0 ? (
        inherited.length === 0 && (
          <p className="px-4 py-5 text-sm text-muted">No papers are yours on this assessment.</p>
        )
      ) : (
        <ul className="divide-y divide-border">{students.map((s) => row(s, { flagBlank: true }))}</ul>
      )}
      {inherited.length > 0 && (
        <div className={students.length > 0 ? "border-t border-border" : ""}>
          <p className="bg-card-muted px-4 py-2 text-xs text-muted">
            Corrected before you joined — you can fix a mark; it stays credited to who corrected it
          </p>
          <ul className="divide-y divide-border">
            {inherited.map((s) => row(s, { by: s.by, flagBlank: false }))}
          </ul>
        </div>
      )}
      {all.length > 0 && (
        <div className="border-t border-border p-3">
          <button type="submit" className="btn-primary w-full">Save grades</button>
        </div>
      )}
    </form>
  );
}
