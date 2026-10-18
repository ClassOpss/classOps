"use client";

import { useActionState, useEffect, useState } from "react";
import { renameAssessment, type FormState } from "@/actions/assessments";

// The assessment's name with a small "Rename" toggle that swaps in an inline editor.
export function RenameAssessment({ assessmentId, label }: { assessmentId: string; label: string }) {
  const [editing, setEditing] = useState(false);
  const action = renameAssessment.bind(null, assessmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);

  if (!editing) {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-2">
        <span>{label}</span>
        <button type="button" onClick={() => setEditing(true)} className="text-xs font-normal text-muted hover:underline">
          Rename
        </button>
      </span>
    );
  }

  return (
    <form action={formAction} className="inline-flex flex-wrap items-center gap-2">
      <input
        name="label"
        defaultValue={label}
        required
        maxLength={150}
        autoFocus
        aria-label="Assessment name"
        className="input !w-56 !py-1.5 text-sm font-normal"
      />
      <button type="submit" disabled={pending} className="btn-secondary btn-sm">
        {pending ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="btn-ghost btn-sm">
        Cancel
      </button>
      {state?.error ? <p className="w-full text-xs font-normal text-danger">{state.error}</p> : null}
    </form>
  );
}
