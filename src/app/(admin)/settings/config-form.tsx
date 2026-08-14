"use client";

import { useActionState } from "react";
import { updateOperationConfig, type ConfigState } from "@/actions/operation-config";

export type ConfigDefaults = {
  brandName: string;
  brandSignature: string;
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

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Num({ name, label, value, step = "1" }: { name: string; label: string; value: number; step?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input name={name} type="number" step={step} min="0" defaultValue={value} className="input" />
    </label>
  );
}

export function ConfigForm({ defaults }: { defaults: ConfigDefaults }) {
  const [state, action, pending] = useActionState<ConfigState, FormData>(updateOperationConfig, undefined);

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Brand name</span>
          <input name="brandName" defaultValue={defaults.brandName} className="input" />
        </label>
        <label className="block">
          <span className="label">Message signature</span>
          <input name="brandSignature" defaultValue={defaults.brandSignature} className="input" />
        </label>
        <label className="block">
          <span className="label">Currency</span>
          <input name="currency" defaultValue={defaults.currency} className="input" />
        </label>
      </div>

      <fieldset>
        <legend className="label">Pay ({defaults.currency})</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Num name="perClassSalary" label="Per-class salary" value={defaults.perClassSalary} />
          <Num name="officeHourBonus" label="Office-hour bonus" value={defaults.officeHourBonus} />
          <Num name="lateDeduction" label="Late deduction" value={defaults.lateDeduction} />
          <Num name="coverageAdjustment" label="Coverage adjustment" value={defaults.coverageAdjustment} />
          <Num name="payMultiplier" label="Pay multiplier" value={defaults.payMultiplier} step="0.1" />
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Deadlines (Cairo time)</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Num name="dailyDeadlineHour" label="Daily deadline hour (0–23)" value={defaults.dailyDeadlineHour} />
          <label className="block">
            <span className="label">Weekly deadline day</span>
            <select name="weeklyDeadlineWeekday" defaultValue={defaults.weeklyDeadlineWeekday} className="input">
              {DAYS.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </label>
          <Num name="weeklyDeadlineHour" label="Weekly deadline hour (0–23)" value={defaults.weeklyDeadlineHour} />
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary btn-sm">
          {pending ? "Saving…" : "Save configuration"}
        </button>
        {state?.ok && <span className="text-sm text-success">Saved ✓</span>}
        {state?.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
      <p className="field-hint">
        Pay changes apply to future runs and any open pay period on recalculation. Already-sent
        periods keep their figures.
      </p>
    </form>
  );
}
