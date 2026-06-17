"use client";

import { useActionState } from "react";
import { updateClass, type FormState } from "@/actions/classes";
import { DAYS } from "@/lib/constants";

const inputCls =
  "rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent";

export type ClassDefaults = {
  schoolId: string;
  yearGroup: string;
  name: string;
  day: string;
  time: string;
  planStartDate: string; // yyyy-mm-dd or ""
  notes: string;
};

export function EditClassForm({
  classId,
  schools,
  defaults,
}: {
  classId: string;
  schools: { id: string; name: string }[];
  defaults: ClassDefaults;
}) {
  const action = updateClass.bind(null, classId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm">
        School
        <select name="schoolId" required className={inputCls} defaultValue={defaults.schoolId}>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Year group
        <select name="yearGroup" required className={inputCls} defaultValue={defaults.yearGroup}>
          <option value="Y9">Y9</option>
          <option value="Y10">Y10</option>
          <option value="S1">S1</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Class name
        <input name="name" required className={inputCls} defaultValue={defaults.name} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Day
        <select name="day" required className={inputCls} defaultValue={defaults.day || "Sunday"}>
          {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Start time
        <input name="time" type="time" required className={inputCls} defaultValue={defaults.time || "16:00"} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Plan start date
        <input name="planStartDate" type="date" className={inputCls} defaultValue={defaults.planStartDate} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-3">
        Notes
        <input name="notes" className={inputCls} defaultValue={defaults.notes} />
      </label>
      <div className="sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={pending}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50">
          {pending ? "Saving…" : "Save changes"}
        </button>
        {state?.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
        {state?.ok ? <p className="mt-2 text-sm text-green-600">Saved.</p> : null}
      </div>
    </form>
  );
}
