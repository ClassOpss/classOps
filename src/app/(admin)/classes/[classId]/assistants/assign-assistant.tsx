"use client";

import { useActionState } from "react";
import { assignAssistant, type FormState } from "@/actions/assignments";

export function AssignAssistant({
  classId,
  available,
}: {
  classId: string;
  available: { id: string; name: string }[];
}) {
  const action = assignAssistant.bind(null, classId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  if (available.length === 0) {
    return <p className="text-sm text-muted">No more assistants available to assign.</p>;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="label">Assistant</span>
        <select name="assistantId" required defaultValue="" className="select">
          <option value="" disabled>Select…</option>
          {available.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Assigning…" : "Assign"}
      </button>
      {state?.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
