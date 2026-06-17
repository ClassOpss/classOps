"use client";

import { useActionState } from "react";
import { addStudent, type FormState } from "@/actions/students";

export function AddStudentForm({ classId, suggestedCode }: { classId: string; suggestedCode: string }) {
  const action = addStudent.bind(null, classId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  const inputCls =
    "rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent";

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-sm">Name</label>
        <input name="name" required placeholder="Full name" className={inputCls} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm">Code</label>
        <input name="code" required defaultValue={suggestedCode} className={`${inputCls} w-24`} />
      </div>
      <button type="submit" disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50">
        {pending ? "Adding…" : "Add"}
      </button>
      {state?.error ? <p className="w-full text-sm text-red-600">{state.error}</p> : null}
      {state?.ok ? <p className="w-full text-sm text-green-600">Student added.</p> : null}
    </form>
  );
}
