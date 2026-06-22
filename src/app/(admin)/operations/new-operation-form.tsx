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

  const input =
    "rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent";
  const label = "flex flex-col gap-1 text-sm";
  const hint = "text-xs text-black/50 dark:text-white/50";

  return (
    <form action={action} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-medium">Teacher &amp; operation</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            Operation name
            <input name="name" required placeholder="Math by Mo" className={input} />
          </label>
          <label className={label}>
            Teacher full name
            <input name="teacherName" required placeholder="Mohamed …" className={input} />
          </label>
          <label className={label}>
            Teacher email (invite link)
            <input name="teacherEmail" type="email" required placeholder="teacher@example.com" className={input} />
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-medium">Branding</legend>
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
        <legend className="mb-1 font-medium">Deadlines (Cairo time)</legend>
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
        <legend className="mb-1 font-medium">Pay ({defaults.currency})</legend>
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
        <legend className="mb-1 font-medium">Schools (optional)</legend>
        <label className={label}>
          One per line — can also be added later.
          <textarea name="schools" rows={4} placeholder={"Citadel\nNoon"} className={input} />
        </label>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create operation + invite teacher"}
      </button>

      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      {state && state.ok && (
        <div className="rounded-md border border-green-600/30 bg-green-50 p-3 text-sm dark:bg-green-950/20">
          <p className="mb-1 font-medium text-green-800 dark:text-green-300">
            Operation created. Send this setup link to {state.teacherEmail}:
          </p>
          <code className="break-all text-xs text-black/70 dark:text-white/70">{state.setupUrl}</code>
        </div>
      )}
    </form>
  );
}
