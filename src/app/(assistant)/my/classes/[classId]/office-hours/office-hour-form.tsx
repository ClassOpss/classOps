"use client";

import { useActionState } from "react";
import { logOfficeHour, type FormState } from "@/actions/office-hours";

const inputCls =
  "rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent";

export function OfficeHourForm({
  classId,
  students,
  topics,
}: {
  classId: string;
  students: { id: string; name: string }[];
  topics: { id: string; title: string }[];
}) {
  const action = logOfficeHour.bind(null, classId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  if (students.length === 0) {
    return <p className="text-sm text-black/60 dark:text-white/60">No students assigned to you yet.</p>;
  }

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Student
        <select name="studentId" required defaultValue="" className={inputCls}>
          <option value="" disabled>Select…</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Date
        <input name="date" type="date" required className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Topic (optional)
        <select name="topicId" defaultValue="" className={inputCls}>
          <option value="">—</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Or note a topic
        <input name="topicNotes" placeholder="free text (optional)" className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Duration (min, optional)
        <input name="durationMin" type="number" min={0} className={`${inputCls} w-32`} />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Logging…" : "Log office hour (+100 EGP)"}
        </button>
        {state?.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
        {state?.ok ? <p className="mt-2 text-sm text-green-600">Logged.</p> : null}
      </div>
    </form>
  );
}
