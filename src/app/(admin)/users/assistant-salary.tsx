"use client";

import { useActionState } from "react";
import { setAssistantSalary, type SalaryState } from "@/actions/assistants";

export function AssistantSalary({
  assistantId,
  value,
  defaultRate,
  currency,
}: {
  assistantId: string;
  value: number | null;
  defaultRate: number;
  currency: string;
}) {
  const [state, action, pending] = useActionState<SalaryState, FormData>(
    setAssistantSalary.bind(null, assistantId),
    undefined,
  );
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input
        name="perClassSalary"
        type="number"
        step="1"
        min="0"
        defaultValue={value ?? ""}
        placeholder={`${defaultRate} (default)`}
        className="input !w-28 !py-1.5 text-sm"
      />
      <span className="text-xs text-faint">{currency}</span>
      <button type="submit" disabled={pending} className="link text-sm">
        {pending ? "…" : "Save"}
      </button>
      {state?.ok && <span className="text-xs text-success">✓</span>}
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
