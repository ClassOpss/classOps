"use client";

import { useActionState } from "react";
import { createAssessment, type FormState } from "@/actions/assessments";

const inputCls =
  "rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent";

export function AssessmentForm({ classId }: { classId: string }) {
  const action = createAssessment.bind(null, classId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm">
        Type
        <select name="type" required defaultValue="quiz" className={inputCls}>
          <option value="quiz">Quiz</option>
          <option value="midterm">Midterm</option>
          <option value="past_paper">Past paper (diagnostic)</option>
          <option value="exam">Exam</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Label
        <input name="label" required placeholder="e.g. Quiz 3" className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Max mark
        <input name="maxMark" type="number" min={1} required defaultValue={20} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Date
        <input name="date" type="date" required className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Time (optional)
        <input name="time" type="time" className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Topics (optional)
        <input name="topicNotes" placeholder="e.g. Indices & Standard Form" className={inputCls} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDiagnostic" className="h-4 w-4" />
        Diagnostic (exclude from averages)
      </label>
      <div className="sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create assessment"}
        </button>
        {state?.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
        {state?.ok ? <p className="mt-2 text-sm text-green-600">Assessment created.</p> : null}
      </div>
    </form>
  );
}
