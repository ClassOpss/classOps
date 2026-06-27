"use client";

import { useActionState } from "react";
import { createOperation, type OperationFormState } from "@/actions/operations";

export type OperationDefaults = {
  brandName: string;
  brandSignature: string;
  logoPath: string;
  currency: string;
  dailyDeadlineHour: number;
  weeklyDeadlineWeekday: number;
  weeklyDeadlineHour: number;
  perClassSalary: number;
  officeHourBonus: number;
  lateDeduction: number;
  coverageAdjustment: number;
  payMultiplier: number;
};

const WEEKDAYS = [
  { v: 0, label: "Sunday" },
  { v: 1, label: "Monday" },
  { v: 2, label: "Tuesday" },
  { v: 3, label: "Wednesday" },
  { v: 4, label: "Thursday" },
  { v: 5, label: "Friday" },
  { v: 6, label: "Saturday" },
];

export function NewOperationForm({ defaults }: { defaults: OperationDefaults }) {
  const [state, action, pending] = useActionState<OperationFormState, FormData>(
    createOperation,
    undefined,
  );

  const input = "input";
  const label = "flex flex-col gap-1.5 text-[0.8rem] font-medium text-muted";
  const hint = "text-xs font-normal text-faint";

  return (
    <form action={action} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="section-title mb-2">Teacher &amp; operation</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            Operation name
            <input name="name" required placeholder="Math by Mo" className={input} />
          </label>
          <label className={label}>
            Teacher full name
            <input name="teacherName" required placeholder="Omar Mowafek" className={input} />
          </label>
          <label className={label}>
            Teacher email (invite link)
            <input name="teacherEmail" type="email" required placeholder="teacher@example.com" className={input} />
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="section-title mb-2">Branding</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            Brand name
            <input name="brandName" defaultValue={defaults.brandName} required className={input} />
          </label>
          <label className={label}>
            Message signature
            <input name="brandSignature" defaultValue={defaults.brandSignature} required className={input} />
          </label>
          <label className={label}>
            Logo path
            <input name="logoPath" defaultValue={defaults.logoPath} required className={input} />
            <span className={hint}>File under /public, e.g. /logos/teacher1.png</span>
          </label>
          <label className={label}>
            Currency
            <input name="currency" defaultValue={defaults.currency} required className={input} />
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="section-title mb-2">Deadlines (Cairo time)</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={label}>
            Daily deadline hour (0–23)
            <input name="dailyDeadlineHour" type="number" min={0} max={23} defaultValue={defaults.dailyDeadlineHour} required className={input} />
          </label>
          <label className={label}>
            Weekly deadline day
            <select name="weeklyDeadlineWeekday" defaultValue={defaults.weeklyDeadlineWeekday} className={input}>
              {WEEKDAYS.map((d) => (
                <option key={d.v} value={d.v}>{d.label}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            Weekly deadline hour (0–23)
            <input name="weeklyDeadlineHour" type="number" min={0} max={23} defaultValue={defaults.weeklyDeadlineHour} required className={input} />
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="section-title mb-2">Pay ({defaults.currency})</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={label}>
            Per-class salary
            <input name="perClassSalary" type="number" step="any" min={0} defaultValue={defaults.perClassSalary} required className={input} />
          </label>
          <label className={label}>
            Office-hour bonus
            <input name="officeHourBonus" type="number" step="any" min={0} defaultValue={defaults.officeHourBonus} required className={input} />
          </label>
          <label className={label}>
            Late deduction
            <input name="lateDeduction" type="number" step="any" min={0} defaultValue={defaults.lateDeduction} required className={input} />
          </label>
          <label className={label}>
            Coverage adjustment
            <input name="coverageAdjustment" type="number" step="any" min={0} defaultValue={defaults.coverageAdjustment} required className={input} />
          </label>
          <label className={label}>
            Pay multiplier
            <input name="payMultiplier" type="number" step="any" min={0} defaultValue={defaults.payMultiplier} required className={input} />
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="section-title mb-2">Schools (optional)</legend>
        <label className={label}>
          One per line — can also be added later.
          <textarea name="schools" rows={4} placeholder={"Citadel\nNoon"} className={input} />
        </label>
      </fieldset>

      <button type="submit" disabled={pending} className="btn-primary self-start">
        {pending ? "Creating…" : "Create operation + invite teacher"}
      </button>

      {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
      {state && state.ok && (
        <div className="rounded-lg border border-success/20 bg-success-soft p-4 text-sm">
          <p className="mb-1.5 font-medium text-success">
            Operation created. Send this setup link to {state.teacherEmail}:
          </p>
          <code className="break-all text-xs text-fg">{state.setupUrl}</code>
        </div>
      )}
    </form>
  );
}
