"use client";

import { useActionState } from "react";
import { saveLessonDetails, type FormState } from "@/actions/lesson-details";

const inputCls =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent";

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
      <label className="flex flex-col gap-1 text-sm">
        Topic covered
        <select name="topicId" defaultValue={current.topicId} className={inputCls}>
          <option value="">—</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Homework
        <input name="homework" defaultValue={current.homework} placeholder="e.g. Exercise 4B, Q1–10" className={inputCls} />
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Due date
          <input type="date" name="homeworkDeadline" defaultValue={current.deadline} className={inputCls} />
        </label>
        <label className="flex items-center gap-2 py-2 text-sm">
          <input type="checkbox" name="noHomework" defaultChecked={current.noHomework} className="h-4 w-4" />
          No homework given
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Quiz / announcement / notes
        <textarea name="notes" rows={2} defaultValue={current.notes} placeholder="e.g. Quiz next session on Indices" className={inputCls} />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md border border-black/15 px-4 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          {pending ? "Saving…" : "Save lesson details"}
        </button>
        {state?.ok ? <span className="text-sm text-green-600">Saved.</span> : null}
        {state?.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
      </div>
    </form>
  );
}
