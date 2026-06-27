"use client";

import { useActionState } from "react";
import { createAssessment, type FormState } from "@/actions/assessments";

const inputCls = "input";

export function AssessmentForm({ classId }: { classId: string }) {
  const action = createAssessment.bind(null, classId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="label">Type</span>
        <select name="type" required defaultValue="quiz" className={inputCls}>
          <option value="quiz">Quiz</option>
          <option value="midterm">Midterm</option>
          <option value="past_paper">Past paper (diagnostic)</option>
          <option value="exam">Exam</option>
        </select>
      </label>
      <label className="block">
        <span className="label">Label</span>
        <input name="label" required placeholder="e.g. Quiz 3" className={inputCls} />
      </label>
      <label className="block">
        <span className="label">Max mark</span>
        <input name="maxMark" type="number" min={1} required defaultValue={20} className={inputCls} />
      </label>
      <label className="block">
        <span className="label">Date</span>
        <input name="date" type="date" required className={inputCls} />
      </label>
      <label className="block">
        <span className="label">Time (optional)</span>
        <input name="time" type="time" className={inputCls} />
      </label>
      <label className="block">
        <span className="label">Topics (optional)</span>
        <input name="topicNotes" placeholder="e.g. Indices & Standard Form" className={inputCls} />
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="isDiagnostic" className="h-4 w-4 accent-brand" />
        Diagnostic (exclude from averages)
      </label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Creating…" : "Create assessment"}
        </button>
        {state?.error ? <p className="mt-2 text-sm text-danger">{state.error}</p> : null}
        {state?.ok ? <p className="mt-2 text-sm text-success">Assessment created.</p> : null}
      </div>
    </form>
  );
}
