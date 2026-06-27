"use client";

import { useActionState } from "react";
import { createPayPeriod, type FormState } from "@/actions/pay";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CreatePeriodForm({ defaultMonth, defaultYear }: { defaultMonth: number; defaultYear: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createPayPeriod, undefined);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="label">Month</span>
        <select name="month" defaultValue={defaultMonth} className="select">
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Year</span>
        <input name="year" type="number" defaultValue={defaultYear} className="input w-28" />
      </label>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Opening…" : "Open pay period"}
      </button>
      {state?.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="w-full text-sm text-success">Pay period opened.</p> : null}
    </form>
  );
}
