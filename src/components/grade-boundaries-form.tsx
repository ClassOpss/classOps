"use client";

import { useActionState } from "react";
import { setGradeBoundaries, type FormState } from "@/actions/assessments";
import { GRADES, type Boundary } from "@/lib/grade-boundaries";

// Per-assessment grade boundaries in RAW marks (Cambridge papers shift, so no fixed table).
// Collapsed by default; shows the current set in the summary.
export function GradeBoundariesForm({
  assessmentId,
  maxMark,
  current,
}: {
  assessmentId: string;
  maxMark: number | null;
  current: Boundary[] | null;
}) {
  const action = setGradeBoundaries.bind(null, assessmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const byGrade = new Map((current ?? []).map((b) => [b.grade, b.min]));

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted">
        {current ? (
          <>Boundaries: {current.map((b) => `${b.grade} ${b.min}`).join(" · ")}</>
        ) : (
          <span className="link">Set grade boundaries</span>
        )}
      </summary>
      {maxMark == null ? (
        <p className="mt-2 text-xs text-muted">Set the max mark first.</p>
      ) : (
        <form action={formAction} className="mt-2 flex flex-col gap-2">
          <p className="text-xs text-muted">Minimum RAW mark for each grade (out of {maxMark}). Leave a grade blank to skip it.</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {GRADES.map((g) => (
              <label key={g} className="flex flex-col gap-0.5 text-xs text-muted">
                {g}
                <input
                  name={`g_${g}`}
                  type="number"
                  min={0}
                  max={maxMark}
                  step="any"
                  defaultValue={byGrade.get(g) ?? ""}
                  className="input !py-1.5 text-sm"
                />
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={pending} className="btn-secondary btn-sm">
              {pending ? "Saving…" : "Save boundaries"}
            </button>
            {state?.ok && <span className="text-xs text-success">Saved</span>}
            {state?.error && <span className="text-xs text-danger">{state.error}</span>}
          </div>
        </form>
      )}
    </details>
  );
}
