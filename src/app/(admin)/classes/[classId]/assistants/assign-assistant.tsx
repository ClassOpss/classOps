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
    return <p className="text-sm text-black/50 dark:text-white/50">No more assistants available to assign.</p>;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm">
        Assistant
        <select
          name="assistantId"
          required
          defaultValue=""
          className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent"
        >
          <option value="" disabled>Select…</option>
          {available.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Assigning…" : "Assign"}
      </button>
      {state?.error ? <p className="w-full text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
