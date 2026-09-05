"use client";

import { useActionState } from "react";
import { createVacation, type FormState } from "@/actions/vacations";

export function VacationForm({ schools }: { schools: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createVacation, undefined);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">School</span>
        <select name="schoolId" required className="input" defaultValue="">
          <option value="" disabled>
            Pick a school…
          </option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Break name</span>
        <input name="label" placeholder="Easter, Mid-year…" required className="input" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Start date</span>
        <input name="startDate" type="date" required className="input" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">End date (inclusive)</span>
        <input name="endDate" type="date" required className="input" />
      </label>

      <div className="sm:col-span-2 flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Adding…" : "Add break"}
        </button>
        {state?.ok && <span className="text-sm text-success">Added ✓</span>}
        {state?.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
