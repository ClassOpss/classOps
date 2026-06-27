"use client";

import { useActionState } from "react";
import { logOfficeHour, type FormState } from "@/actions/office-hours";

const inputCls = "input";

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
    return <p className="text-sm text-muted">No students assigned to you yet.</p>;
  }

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="label">Student</span>
        <select name="studentId" required defaultValue="" className={inputCls}>
          <option value="" disabled>Select…</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Date</span>
        <input name="date" type="date" required className={inputCls} />
      </label>
      <label className="block">
        <span className="label">Topic (optional)</span>
        <select name="topicId" defaultValue="" className={inputCls}>
          <option value="">—</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Or note a topic</span>
        <input name="topicNotes" placeholder="free text (optional)" className={inputCls} />
      </label>
      <label className="block">
        <span className="label">Duration (min, optional)</span>
        <input name="durationMin" type="number" min={0} className={inputCls} />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Logging…" : "Log office hour (+100 EGP)"}
        </button>
        {state?.error ? <p className="mt-2 text-sm text-danger">{state.error}</p> : null}
        {state?.ok ? <p className="mt-2 text-sm text-success">Logged.</p> : null}
      </div>
    </form>
  );
}
