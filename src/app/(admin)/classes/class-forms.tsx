"use client";

import { useActionState } from "react";
import { createSchool, type FormState } from "@/actions/schools";
import { createClass } from "@/actions/classes";
import { DAYS } from "@/lib/constants";

const inputCls =
  "rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent";
const btnCls =
  "rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50";

export function NewSchoolForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createSchool, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">New school</label>
        <input name="name" placeholder="School name" required className={inputCls} />
      </div>
      <button type="submit" disabled={pending} className={btnCls}>
        {pending ? "Adding…" : "Add school"}
      </button>
      {state?.error ? <p className="w-full text-sm text-red-600">{state.error}</p> : null}
      {state?.ok ? <p className="w-full text-sm text-green-600">School added.</p> : null}
    </form>
  );
}

export function NewClassForm({ schools }: { schools: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createClass, undefined);

  if (schools.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">Add a school first.</p>;
  }

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm">
        School
        <select name="schoolId" required className={inputCls} defaultValue="">
          <option value="" disabled>Select…</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Year group
        <select name="yearGroup" required className={inputCls} defaultValue="Y9">
          <option value="Y9">Y9</option>
          <option value="Y10">Y10</option>
          <option value="S1">S1</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Class name
        <input name="name" placeholder="e.g. Y9-Citadel" required className={inputCls} />
      </label>
      <fieldset className="flex flex-col gap-1 text-sm sm:col-span-2">
        <legend>Days</legend>
        <div className="flex flex-wrap gap-3">
          {DAYS.map((d) => (
            <label key={d} className="flex items-center gap-1">
              <input type="checkbox" name="days" value={d} defaultChecked={d === "Sunday"} />
              {d.slice(0, 3)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm">
        Start time
        <input name="time" type="time" required className={inputCls} defaultValue="16:00" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Plan start date
        <input name="planStartDate" type="date" className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-3">
        Notes (optional)
        <input name="notes" className={inputCls} />
      </label>
      <div className="sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={pending} className={btnCls}>
          {pending ? "Creating…" : "Create class"}
        </button>
        {state?.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
        {state?.ok ? <p className="mt-2 text-sm text-green-600">Class created.</p> : null}
      </div>
    </form>
  );
}
