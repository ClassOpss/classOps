"use client";

import { useActionState } from "react";
import { generateSessions, type FormState } from "@/actions/sessions";

export function GenerateSessions({ classId, label }: { classId: string; label: string }) {
  const action = generateSessions.bind(null, classId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button type="submit" disabled={pending} className="btn-secondary self-start">
        {pending ? "Generating…" : label}
      </button>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-success">Sessions generated.</p> : null}
    </form>
  );
}
