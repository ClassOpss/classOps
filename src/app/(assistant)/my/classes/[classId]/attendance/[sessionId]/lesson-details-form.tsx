"use client";

import { useActionState } from "react";
import { saveLessonDetails, type FormState } from "@/actions/lesson-details";

const inputCls = "input";

export type LessonDetails = {
  topicId: string;
  homework: string;
  deadline: string; // yyyy-mm-dd
  noHomework: boolean;
  notes: string;
};

export function LessonDetailsForm({
  sessionId,
  topics,
  current,
}: {
  sessionId: string;
  topics: { id: string; title: string }[];
  current: LessonDetails;
}) {
  const action = saveLessonDetails.bind(null, sessionId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="block">
        <span className="label">Topic covered</span>
        <select name="topicId" defaultValue={current.topicId} className={inputCls}>
          <option value="">—</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="label">Homework</span>
        <input name="homework" defaultValue={current.homework} placeholder="e.g. Exercise 4B, Q1–10" className={inputCls} />
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label">Due date</span>
          <input type="date" name="homeworkDeadline" defaultValue={current.deadline} className={inputCls} />
        </label>
        <label className="flex items-center gap-2 py-2 text-sm">
          <input type="checkbox" name="noHomework" defaultChecked={current.noHomework} className="h-4 w-4 accent-brand" />
          No homework given
        </label>
      </div>

      <label className="block">
        <span className="label">Quiz / announcement / notes</span>
        <textarea name="notes" rows={2} defaultValue={current.notes} placeholder="e.g. Quiz next session on Indices" className={inputCls} />
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-secondary">
          {pending ? "Saving…" : "Save lesson details"}
        </button>
        {state?.ok ? <span className="text-sm text-success">Saved.</span> : null}
        {state?.error ? <span className="text-sm text-danger">{state.error}</span> : null}
      </div>
    </form>
  );
}
