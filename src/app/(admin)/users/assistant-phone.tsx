"use client";

import { useActionState } from "react";
import { setAssistantPhone, type SalaryState } from "@/actions/assistants";

export function AssistantPhone({ assistantId, value }: { assistantId: string; value: string | null }) {
  const [state, action, pending] = useActionState<SalaryState, FormData>(
    setAssistantPhone.bind(null, assistantId),
    undefined,
  );
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input name="phone" defaultValue={value ?? ""} placeholder="WhatsApp #" className="input !w-36 !py-1.5 text-sm" />
      <button type="submit" disabled={pending} className="link text-sm">{pending ? "…" : "Save"}</button>
      {state?.ok && <span className="text-xs text-success">✓</span>}
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
