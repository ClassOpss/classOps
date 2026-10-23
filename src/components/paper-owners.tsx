"use client";

import { useState } from "react";
import { claimPapers } from "@/actions/paper-owners";
import type { PaperRow } from "@/lib/paper-owners";

// Per-assistant tally for one assessment: "Bee · 6 papers · 4 graded", with the full list
// (who corrected / who still owes each paper) folded underneath.
export function PaperOwnersSummary({ rows, meId }: { rows: PaperRow[]; meId?: string | null }) {
  const groups = new Map<string, { name: string; total: number; graded: number }>();
  for (const r of rows) {
    const key = r.ownerId ?? r.ownerName;
    const g = groups.get(key) ?? { name: r.ownerId && r.ownerId === meId ? "You" : r.ownerName, total: 0, graded: 0 };
    g.total += 1;
    if (r.graded) g.graded += 1;
    groups.set(key, g);
  }
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-2 text-sm">
        {[...groups.values()].map((g) => (
          <li key={g.name} className={g.graded === g.total ? "badge-success" : "badge-warn"}>
            {g.name} · {g.graded}/{g.total} graded
          </li>
        ))}
      </ul>
      <details>
        <summary className="cursor-pointer text-xs text-muted">Every paper</summary>
        <ul className="mt-2 divide-y divide-border text-sm">
          {rows.map((r) => (
            <li key={r.studentId} className="flex items-center justify-between gap-2 py-1.5">
              <span>{r.name}</span>
              <span className="text-xs text-muted">
                {r.graded ? "Corrected by " : "To do · "}
                {r.ownerId && r.ownerId === meId ? "you" : r.ownerName}
                {r.claimed ? " (took over)" : ""}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

// Take over a colleague's ungraded papers for THIS assessment only (whole class, or just
// the ones who sat with you). Only moves work to you, so it needs no colleague's say-so.
export function ClaimPapersForm({
  assessmentId,
  papers,
}: {
  assessmentId: string;
  papers: { studentId: string; name: string; ownerName: string }[];
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  if (papers.length === 0) return null;
  const toggle = (id: string, on: boolean) =>
    setPicked((p) => {
      const n = new Set(p);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <details className="card p-4">
      <summary className="section-title cursor-pointer">Correcting papers that aren&apos;t yours?</summary>
      <form
        action={claimPapers.bind(null, assessmentId)}
        onSubmit={(e) => {
          if (!window.confirm(`Take over ${picked.size} paper${picked.size === 1 ? "" : "s"}? They become your responsibility for this assessment (including the deadline). Only an admin can move them back.`)) {
            e.preventDefault();
          }
        }}
        className="mt-3 flex flex-col gap-3"
      >
        <p className="text-xs text-muted">
          Tick the papers you&apos;re correcting for this assessment. Your colleague is no longer responsible for them.
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={() => setPicked(new Set(papers.map((p) => p.studentId)))}>
            Select all ({papers.length})
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setPicked(new Set())}>
            Clear
          </button>
        </div>
        <ul className="divide-y divide-border text-sm">
          {papers.map((p) => (
            <li key={p.studentId}>
              <label className="flex items-center gap-2 py-1.5">
                <input
                  type="checkbox"
                  name="student"
                  value={p.studentId}
                  checked={picked.has(p.studentId)}
                  onChange={(e) => toggle(p.studentId, e.target.checked)}
                  className="accent-brand"
                />
                <span className="flex-1">{p.name}</span>
                <span className="text-xs text-muted">{p.ownerName}</span>
              </label>
            </li>
          ))}
        </ul>
        <button type="submit" disabled={picked.size === 0} className="btn-primary disabled:opacity-50">
          Take {picked.size || ""} paper{picked.size === 1 ? "" : "s"}
        </button>
      </form>
    </details>
  );
}
