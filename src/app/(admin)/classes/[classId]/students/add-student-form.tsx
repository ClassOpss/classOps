"use client";

import { useActionState } from "react";
import { addStudent, type FormState } from "@/actions/students";

export function AddStudentForm({ classId, suggestedCode }: { classId: string; suggestedCode: string }) {
  const action = addStudent.bind(null, classId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  const inputCls = "input";

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="flex-1">
        <label className="label">Name</label>
        <input name="name" required placeholder="Full name" className={inputCls} />
      </div>
      <div>
        <label className="label">Code</label>
        <input name="code" required defaultValue={suggestedCode} className={`${inputCls} w-24`} />
      </div>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Adding…" : "Add"}
      </button>
      {state?.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="w-full text-sm text-success">Student added.</p> : null}
    </form>
  );
}
