"use client";

import { useActionState, useState } from "react";
import { deleteOperation, type DeleteState } from "@/actions/operations";

export function DeleteOperation({ operationId, name }: { operationId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<DeleteState, FormData>(
    deleteOperation.bind(null, operationId),
    undefined,
  );

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-danger hover:underline">
        Delete
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3">
      <p className="text-xs text-danger">
        This permanently deletes <b>{name}</b> and all its schools, classes, students, assistants and
        pay. Type the name to confirm.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input name="confirm" placeholder={name} className="input max-w-[16rem] !py-1.5 text-sm" autoFocus />
        <button type="submit" disabled={pending} className="btn-danger btn-sm">
          {pending ? "Deleting…" : "Delete permanently"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">
          Cancel
        </button>
      </div>
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
