"use client";

import { useActionState, useState } from "react";
import type { IncidentType } from "@prisma/client";
import { saveTaskToggles, type ToggleState } from "@/actions/task-toggles";
import { TASKS } from "@/lib/task-toggles";

export function TaskToggles({
  classId,
  disabledTasks,
  assignments,
  noLms,
}: {
  classId: string;
  disabledTasks: IncidentType[];
  assignments: { id: string; name: string; exemptTasks: IncidentType[] }[];
  noLms: boolean;
}) {
  const action = saveTaskToggles.bind(null, classId);
  const [state, formAction, pending] = useActionState<ToggleState, FormData>(action, undefined);
  // Class-level state drives dimming of the per-assistant boxes (they still submit).
  const [classOn, setClassOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(TASKS.map((t) => [t.type, !disabledTasks.includes(t.type)])),
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2 pr-3 font-medium">Task</th>
              <th className="px-3 py-2 text-center font-medium">Whole class</th>
              {assignments.map((a) => (
                <th key={a.id} className="px-3 py-2 text-center font-medium">{a.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {TASKS.map((t) => {
              const lmsOff = t.type === "classroom_upload" && noLms;
              return (
                <tr key={t.type}>
                  <td className="py-2 pr-3">
                    {t.label}
                    {lmsOff && <span className="ml-1 text-xs text-faint">(no LMS — never required)</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      name={`class:${t.type}`}
                      defaultChecked={!disabledTasks.includes(t.type)}
                      onChange={(e) => setClassOn((s) => ({ ...s, [t.type]: e.target.checked }))}
                      className="h-4 w-4 accent-brand"
                      aria-label={`${t.label} — whole class`}
                    />
                  </td>
                  {assignments.map((a) => (
                    <td key={a.id} className={`px-3 py-2 text-center ${classOn[t.type] ? "" : "opacity-30"}`}>
                      <input
                        type="checkbox"
                        name={`a:${a.id}:${t.type}`}
                        defaultChecked={!a.exemptTasks.includes(t.type)}
                        className="h-4 w-4 accent-brand"
                        aria-label={`${t.label} — ${a.name}`}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="waivePast" defaultChecked className="h-4 w-4 accent-brand" />
        Also waive existing fines for any task I’m turning off
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save tasks"}
        </button>
        {state?.ok && (
          <p className="text-sm text-success">
            Saved{state.waived ? ` — ${state.waived} fine${state.waived === 1 ? "" : "s"} waived` : ""}.
          </p>
        )}
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      </div>
    </form>
  );
}
