"use client";

import { useActionState } from "react";
import { createPayPeriod, type FormState } from "@/actions/pay";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CreatePeriodForm({ defaultMonth, defaultYear }: { defaultMonth: number; defaultYear: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createPayPeriod, undefined);
  const inputCls =
    "rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent";

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm">
        Month
        <select name="month" defaultValue={defaultMonth} className={inputCls}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Year
        <input name="year" type="number" defaultValue={defaultYear} className={`${inputCls} w-24`} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Opening…" : "Open pay period"}
      </button>
      {state?.error ? <p className="w-full text-sm text-red-600">{state.error}</p> : null}
      {state?.ok ? <p className="w-full text-sm text-green-600">Pay period opened.</p> : null}
    </form>
  );
}
