"use client";

import { useActionState, useState } from "react";
import { archiveAllClasses, type ArchiveState } from "@/actions/classes";

export function NewYear() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ArchiveState, FormData>(archiveAllClasses, undefined);

  if (state?.ok) {
    return (
      <p className="text-sm text-success">
        Archived {state.archived} class{state.archived === 1 ? "" : "es"}. Create this year&apos;s classes below.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm">
        Start a new year — archive current classes
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2 rounded-lg border border-warn/30 bg-warn-soft p-3">
      <p className="text-xs text-warn">
        Deactivates <b>all active classes</b> and ends their assistant assignments (history is kept —
        pay for past months is unaffected). You&apos;ll then create fresh classes for the new year.
        Type <b>ARCHIVE</b> to confirm.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input name="confirm" placeholder="ARCHIVE" className="input max-w-[12rem] !py-1.5 text-sm" autoFocus />
        <button type="submit" disabled={pending} className="btn-danger btn-sm">
          {pending ? "Archiving…" : "Archive all classes"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">Cancel</button>
      </div>
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
