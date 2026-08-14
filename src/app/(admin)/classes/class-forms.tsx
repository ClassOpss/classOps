"use client";

import { useActionState, useEffect, useState } from "react";
import { createSchool, type FormState } from "@/actions/schools";
import { createClass } from "@/actions/classes";
import { DAYS } from "@/lib/constants";

const inputCls = "input";
const btnCls = "btn-primary";

export function NewSchoolForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createSchool, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input name="name" placeholder="School name" required className="input flex-1" />
      <button type="submit" disabled={pending} className={btnCls}>
        {pending ? "Adding…" : "Add school"}
      </button>
      {state?.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="w-full text-sm text-success">School added.</p> : null}
    </form>
  );
}

export function NewClassForm({ schools }: { schools: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createClass, undefined);
  const [schoolId, setSchoolId] = useState("");
  const [year, setYear] = useState("Y9");
  const [name, setName] = useState("");
  const [edited, setEdited] = useState(false);

  const schoolName = schools.find((s) => s.id === schoolId)?.name ?? "";
  // Default the class name to "<School> <Year>" until the admin types their own.
  useEffect(() => {
    if (!edited) setName(schoolName ? `${schoolName} ${year}` : "");
  }, [schoolName, year, edited]);

  if (schools.length === 0) {
    return <p className="text-sm text-muted">Add a school first.</p>;
  }

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="label">School</span>
        <select name="schoolId" required className={inputCls} value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
          <option value="" disabled>Select…</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Year group</span>
        <select name="yearGroup" required className={inputCls} value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="Y9">Y9</option>
          <option value="Y10">Y10</option>
          <option value="S1">S1</option>
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className="label">Class name</span>
        <input
          name="name"
          placeholder="e.g. Citadel Y9"
          required
          className={inputCls}
          value={name}
          onChange={(e) => { setName(e.target.value); setEdited(true); }}
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="label">Platform</span>
        <select name="lmsType" required className={inputCls} defaultValue="google_classroom">
          <option value="google_classroom">Google Classroom</option>
          <option value="ie_learn">IE Learn (no Classroom invites)</option>
        </select>
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="label">Days &amp; start times</legend>
        <p className="field-hint mb-2 mt-0">Tick each day this class meets and set its start time.</p>
        <div className="flex flex-col gap-1.5">
          {DAYS.map((d) => (
            <div key={d} className="flex items-center gap-3">
              <label className="flex w-36 cursor-pointer items-center gap-2 rounded-lg border border-border-strong bg-card px-2.5 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand-softfg">
                <input type="checkbox" name={`day_${d}`} defaultChecked={d === "Sunday"} className="accent-brand" />
                {d}
              </label>
              <input type="time" name={`time_${d}`} defaultValue="16:00" className="input w-auto" />
            </div>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="label">Plan start date</span>
        <input name="planStartDate" type="date" className={inputCls} />
      </label>
      <label className="block">
        <span className="label">Notes (optional)</span>
        <input name="notes" className={inputCls} />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={btnCls}>
          {pending ? "Creating…" : "Create class"}
        </button>
        {state?.error ? <p className="mt-2 text-sm text-danger">{state.error}</p> : null}
        {state?.ok ? <p className="mt-2 text-sm text-success">Class created.</p> : null}
      </div>
    </form>
  );
}
