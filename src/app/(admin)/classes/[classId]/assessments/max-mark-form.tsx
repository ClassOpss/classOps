"use client";

import { useActionState } from "react";
import { setMaxMark, type FormState } from "@/actions/assessments";

// Inline max-mark editor. Auto-created quiz assessments start without a max mark;
// grade entry unlocks once it's set.
export function MaxMarkForm({ assessmentId, current }: { assessmentId: string; current: number | null }) {
  const action = setMaxMark.bind(null, assessmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        name="maxMark"
        type="number"
        min={1}
        required
        defaultValue={current ?? undefined}
        placeholder="Max"
        aria-label="Max mark"
        className="input !w-20 !py-1.5 text-sm"
      />
      <button type="submit" disabled={pending} className="btn-secondary btn-sm">
        {pending ? "Saving…" : current == null ? "Set max mark" : "Save"}
      </button>
      {state?.error ? <p className="w-full text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
