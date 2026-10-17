"use client";

import { useActionState } from "react";
import { setGradeBoundaries, type FormState } from "@/actions/assessments";
import { GRADES, LOWEST_GRADE, type Boundary } from "@/lib/grade-boundaries";

const summarize = (bs: Boundary[]) =>
  bs.map((b) => (b.grade === LOWEST_GRADE && b.min === 0 ? `${b.grade} below` : `${b.grade} ${b.min}`)).join(" · ");

// Per-assessment grade boundaries in RAW marks. Automatic by default (Edexcel-style, from
// the class's marks — see lib/grade-boundaries); a saved set overrides them until reset.
// Collapsed by default; shows the set in force in the summary.
export function GradeBoundariesForm({
  assessmentId,
  maxMark,
  manual,
  auto,
}: {
  assessmentId: string;
  maxMark: number | null;
  manual: Boundary[] | null;
  auto: Boundary[] | null;
}) {
  const action = setGradeBoundaries.bind(null, assessmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const shown = manual ?? auto;
  const byGrade = new Map((shown ?? []).map((b) => [b.grade, b.min]));
  const editable = GRADES.filter((g) => g !== LOWEST_GRADE);

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted">
        {shown ? (
          <>
            Boundaries ({manual ? "manual" : "auto"}): {summarize(shown)}
          </>
        ) : (
          <span className="link">Grade boundaries</span>
        )}
      </summary>
      {maxMark == null ? (
        <p className="mt-2 text-xs text-muted">Set the max mark first.</p>
      ) : (
        <form action={formAction} className="mt-2 flex flex-col gap-2">
          <p className="text-xs text-muted">
            {manual
              ? "Manual boundaries are in use. "
              : "Set automatically the Edexcel way: A and C from the typical paper position blended with this class's marks, B/A*/D spaced evenly around them. They update as marks come in. "}
            Lowest grade is D. Change a mark below to override (RAW marks out of {maxMark}).
          </p>
          <div className="grid grid-cols-4 gap-2">
            {editable.map((g) => (
              <label key={g} className="flex flex-col gap-0.5 text-xs text-muted">
                {g}
                <input
                  key={`${g}-${byGrade.get(g) ?? ""}`}
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
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={pending} className="btn-secondary btn-sm">
              {pending ? "Saving…" : "Save override"}
            </button>
            {manual && (
              <button type="submit" name="reset" value="1" disabled={pending} className="btn-secondary btn-sm">
                Use automatic
              </button>
            )}
            {state?.ok && <span className="text-xs text-success">Saved</span>}
            {state?.error && <span className="text-xs text-danger">{state.error}</span>}
          </div>
        </form>
      )}
    </details>
  );
}
