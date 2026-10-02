"use client";

import { useActionState } from "react";
import { saveDayOwners, type FormState } from "@/actions/assignments";

// Pick which assistant logs each class day (attendance, parent update, classroom upload).
export function DayOwners({
  classId,
  days,
  assistants,
}: {
  classId: string;
  days: { weekday: number; label: string; ownerId: string | null }[];
  assistants: { id: string; name: string }[];
}) {
  const action = saveDayOwners.bind(null, classId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const canPick = assistants.length >= 2 && days.length >= 2;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {canPick ? (
        <div className="flex flex-wrap gap-4">
          {days.map((d) => (
            <label key={d.weekday} className="block">
              <span className="label">{d.label}</span>
              <select name={`day:${d.weekday}`} defaultValue={d.ownerId ?? ""} className="select">
                {assistants.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">
          {assistants.length === 0
            ? "No assistants assigned."
            : assistants.length === 1
              ? `${assistants[0].name} logs every lesson.`
              : "This class meets once a week, so the two assistants alternate weeks."}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || assistants.length === 0} className="btn-primary">
          {pending ? "Saving…" : canPick ? "Save day owners" : "Recalculate owners"}
        </button>
        {state?.ok ? <span className="text-sm text-success">Saved — upcoming lessons updated.</span> : null}
        {state?.error ? <span className="text-sm text-danger">{state.error}</span> : null}
      </div>
    </form>
  );
}
