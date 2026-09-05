"use client";

import { useActionState } from "react";
import { setAssistantName, type SalaryState } from "@/actions/assistants";

export function AssistantName({ assistantId, value }: { assistantId: string; value: string }) {
  const [state, action, pending] = useActionState<SalaryState, FormData>(
    setAssistantName.bind(null, assistantId),
    undefined,
  );
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input name="name" defaultValue={value} placeholder="Full name" required className="input !w-40 !py-1.5 text-sm" />
      <button type="submit" disabled={pending} className="link text-sm">{pending ? "…" : "Save"}</button>
      {state?.ok && <span className="text-xs text-success">✓</span>}
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
