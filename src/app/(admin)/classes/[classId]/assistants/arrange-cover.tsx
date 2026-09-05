"use client";

import Link from "next/link";
import { useActionState } from "react";
import { arrangeCover, type FormState } from "@/actions/assignments";

// Admin grants a temporary, auto-expiring cover of this class to an assistant who
// isn't on its permanent roster. Access lasts only for the chosen Cairo day(s).
export function ArrangeCover({
  classId,
  available,
  today,
}: {
  classId: string;
  available: { id: string; name: string }[];
  today: string; // yyyy-mm-dd (Cairo), default for the date inputs
}) {
  const action = arrangeCover.bind(null, classId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  if (available.length === 0) {
    return (
      <p className="text-sm text-muted">
        No assistants available to cover. Invite them on the{" "}
        <Link href="/users" className="link">Users</Link> page first.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="label">Assistant</span>
        <select name="assistantId" required defaultValue="" className="select">
          <option value="" disabled>Select…</option>
          {available.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">From</span>
        <input type="date" name="fromDate" required defaultValue={today} className="input" />
      </label>
      <label className="block">
        <span className="label">To</span>
        <input type="date" name="toDate" defaultValue={today} className="input" />
      </label>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Arranging…" : "Arrange cover"}
      </button>
      {state?.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
