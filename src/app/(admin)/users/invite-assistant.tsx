"use client";

import { useActionState } from "react";
import {
  inviteAssistantAction,
  bulkInviteAction,
  type InviteState,
} from "@/actions/assistants";

function LinksPanel({ state }: { state: InviteState }) {
  if (!state) return null;
  if (!state.ok) return <p className="mt-3 text-sm text-danger">{state.error}</p>;
  return (
    <div className="mt-4 rounded-lg border border-success/20 bg-success-soft p-4 text-sm">
      <p className="mb-2 font-medium text-success">
        Invite link(s) created — send each to the assistant:
      </p>
      <ul className="flex flex-col gap-2">
        {state.links.map((l) => (
          <li key={l.email} className="break-all">
            <span className="font-medium">{l.email}</span>
            <br />
            <code className="text-xs text-muted">{l.url}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InviteAssistant() {
  const [single, singleAction, singlePending] = useActionState<InviteState, FormData>(
    inviteAssistantAction,
    undefined,
  );
  const [bulk, bulkAction, bulkPending] = useActionState<InviteState, FormData>(
    bulkInviteAction,
    undefined,
  );

  const inputCls = "input";
  const btnCls = "btn-primary self-start";

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <section className="card p-5">
        <h2 className="section-title mb-3">Invite one assistant</h2>
        <form action={singleAction} className="flex flex-col gap-3">
          <input name="name" placeholder="Full name" required className={inputCls} />
          <input name="email" type="email" placeholder="email@example.com" required className={inputCls} />
          <button type="submit" disabled={singlePending} className={btnCls}>
            {singlePending ? "Inviting…" : "Invite"}
          </button>
        </form>
        <LinksPanel state={single} />
      </section>

      <section className="card p-5">
        <h2 className="section-title mb-3">Bulk invite (paste emails)</h2>
        <form action={bulkAction} className="flex flex-col gap-3">
          <textarea
            name="emails"
            rows={5}
            placeholder={"one@example.com\ntwo@example.com"}
            required
            className={inputCls}
          />
          <button type="submit" disabled={bulkPending} className={btnCls}>
            {bulkPending ? "Inviting…" : "Invite all"}
          </button>
        </form>
        <LinksPanel state={bulk} />
      </section>
    </div>
  );
}
