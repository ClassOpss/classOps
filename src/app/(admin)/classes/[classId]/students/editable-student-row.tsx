"use client";

import { useActionState, useEffect, useState } from "react";
import { updateStudentContacts, deactivateStudent, type FormState } from "@/actions/students";

export type StudentRow = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  parentName: string | null;
  parentPhone: string | null;
};

export function EditableStudentRow({ student, canRemove }: { student: StudentRow; canRemove: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateStudentContacts.bind(null, student.id),
    undefined,
  );

  // Collapse the editor once a save succeeds.
  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state?.ok]);

  if (editing) {
    return (
      <tr>
        <td className="align-top"><span className="badge-neutral">{student.code}</span></td>
        <td className="align-top font-medium">{student.name}</td>
        <td colSpan={2}>
          <form action={action} className="flex flex-col gap-2 py-1">
            <div className="grid gap-2 sm:grid-cols-2">
              <input name="email" type="email" defaultValue={student.email ?? ""} placeholder="Email" className="input !py-1.5 text-sm" />
              <input name="phone" defaultValue={student.phone ?? ""} placeholder="Student phone" className="input !py-1.5 text-sm" />
              <input name="parentName" defaultValue={student.parentName ?? ""} placeholder="Parent name" className="input !py-1.5 text-sm" />
              <input name="parentPhone" defaultValue={student.parentPhone ?? ""} placeholder="Parent phone" className="input !py-1.5 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={pending} className="btn-primary btn-sm">{pending ? "Saving…" : "Save"}</button>
              <button type="button" onClick={() => setEditing(false)} className="btn-ghost btn-sm">Cancel</button>
              {state?.error && <span className="text-xs text-danger">{state.error}</span>}
            </div>
          </form>
        </td>
        <td className="align-top"></td>
      </tr>
    );
  }

  return (
    <tr>
      <td><span className="badge-neutral">{student.code}</span></td>
      <td className="font-medium">{student.name}</td>
      <td className="text-muted">{student.email ?? "—"}</td>
      <td className="text-muted">
        {student.parentName ?? "—"}
        {student.parentPhone ? <span className="text-faint"> · {student.parentPhone}</span> : null}
      </td>
      <td>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setEditing(true)} className="link">Edit</button>
          {canRemove && (
            <form action={deactivateStudent.bind(null, student.id)}>
              <button type="submit" className="font-medium text-danger hover:underline">Remove</button>
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}
