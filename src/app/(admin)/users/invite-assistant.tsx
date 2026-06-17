"use client";

import { useActionState } from "react";
import {
  inviteAssistantAction,
  bulkInviteAction,
  type InviteState,
} from "@/actions/assistants";

function LinksPanel({ state }: { state: InviteState }) {
  if (!state) return null;
  if (!state.ok) return <p className="text-sm text-red-600">{state.error}</p>;
  return (
    <div className="mt-3 rounded-md border border-green-600/30 bg-green-50 p-3 text-sm dark:bg-green-950/20">
      <p className="mb-2 font-medium text-green-800 dark:text-green-300">
        Invite link(s) created — send each to the assistant:
      </p>
      <ul className="flex flex-col gap-2">
        {state.links.map((l) => (
          <li key={l.email} className="break-all">
            <span className="font-medium">{l.email}</span>
            <br />
            <code className="text-xs text-black/70 dark:text-white/70">{l.url}</code>
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

  const inputCls =
    "rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent";
  const btnCls =
    "rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50";

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section>
        <h2 className="mb-3 font-medium">Invite one assistant</h2>
        <form action={singleAction} className="flex flex-col gap-3">
          <input name="name" placeholder="Full name" required className={inputCls} />
          <input name="email" type="email" placeholder="email@example.com" required className={inputCls} />
          <button type="submit" disabled={singlePending} className={btnCls}>
            {singlePending ? "Inviting…" : "Invite"}
          </button>
        </form>
        <LinksPanel state={single} />
      </section>

      <section>
        <h2 className="mb-3 font-medium">Bulk invite (paste emails)</h2>
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
