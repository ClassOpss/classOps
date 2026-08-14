"use client";

import { useActionState } from "react";
import { setAssistantEmail, type SalaryState } from "@/actions/assistants";

export function AssistantEmail({ assistantId, value }: { assistantId: string; value: string }) {
  const [state, action, pending] = useActionState<SalaryState, FormData>(
    setAssistantEmail.bind(null, assistantId),
    undefined,
  );
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input name="email" type="email" defaultValue={value} className="input !w-48 !py-1.5 text-sm" />
      <button type="submit" disabled={pending} className="link text-sm">{pending ? "…" : "Save"}</button>
      {state?.ok && <span className="text-xs text-success">✓</span>}
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
