"use client";

import { useActionState } from "react";
import { generateSessions, type FormState } from "@/actions/sessions";

export function GenerateSessions({ classId, label }: { classId: string; label: string }) {
  const action = generateSessions.bind(null, classId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
      >
        {pending ? "Generating…" : label}
      </button>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-green-600">Sessions generated.</p> : null}
    </form>
  );
}
