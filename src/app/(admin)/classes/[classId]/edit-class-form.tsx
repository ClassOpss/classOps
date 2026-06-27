"use client";

import { useActionState } from "react";
import { updateClass, type FormState } from "@/actions/classes";
import { DAYS } from "@/lib/constants";

const inputCls = "input";

export type ClassDefaults = {
  schoolId: string;
  yearGroup: string;
  name: string;
  // Per-day start times, keyed by weekday name; absent day = not scheduled.
  times: Record<string, string>;
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
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="label">School</span>
        <select name="schoolId" required className={inputCls} defaultValue={defaults.schoolId}>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">Year group</span>
        <select name="yearGroup" required className={inputCls} defaultValue={defaults.yearGroup}>
          <option value="Y9">Y9</option>
          <option value="Y10">Y10</option>
          <option value="S1">S1</option>
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className="label">Class name</span>
        <input name="name" required className={inputCls} defaultValue={defaults.name} />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="label">Days &amp; start times</legend>
        <p className="field-hint mb-2 mt-0">Tick each day this class meets and set its start time.</p>
        <div className="flex flex-col gap-1.5">
          {DAYS.map((d) => (
            <div key={d} className="flex items-center gap-3">
              <label className="flex w-36 cursor-pointer items-center gap-2 rounded-lg border border-border-strong bg-card px-2.5 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand-softfg">
                <input type="checkbox" name={`day_${d}`} defaultChecked={d in defaults.times} className="accent-brand" />
                {d}
              </label>
              <input type="time" name={`time_${d}`} defaultValue={defaults.times[d] || "16:00"} className="input w-auto" />
            </div>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="label">Plan start date</span>
        <input name="planStartDate" type="date" className={inputCls} defaultValue={defaults.planStartDate} />
      </label>
      <label className="block">
        <span className="label">Notes</span>
        <input name="notes" className={inputCls} defaultValue={defaults.notes} />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save changes"}
        </button>
        {state?.error ? <p className="mt-2 text-sm text-danger">{state.error}</p> : null}
        {state?.ok ? <p className="mt-2 text-sm text-success">Saved.</p> : null}
      </div>
    </form>
  );
}
