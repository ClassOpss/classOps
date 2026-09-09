"use client";

import { useActionState } from "react";
import { saveInviteTemplates, type TemplateState } from "@/actions/assistants";
import { INVITE_PLACEHOLDERS } from "@/lib/invites";

export function InviteTemplatesForm({
  defaults,
}: {
  defaults: { studentInviteTemplate: string; parentInviteTemplate: string };
}) {
  const [state, action, pending] = useActionState<TemplateState, FormData>(
    saveInviteTemplates,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        These are personal to you — other assistants keep their own. Leave a box empty to use the
        standard message. Use these placeholders and they&apos;ll be filled in per recipient:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {INVITE_PLACEHOLDERS.map((p) => (
          <code key={p} className="rounded bg-card-muted px-1.5 py-0.5 text-xs">{p}</code>
        ))}
      </div>

      <div>
        <label className="label" htmlFor="studentInviteTemplate">Student invite message</label>
        <textarea
          id="studentInviteTemplate"
          name="studentInviteTemplate"
          defaultValue={defaults.studentInviteTemplate}
          rows={10}
          placeholder="Leave empty to use the standard student invite."
          className="input font-mono text-sm"
        />
        <p className="field-hint">{"{link}"} becomes the class WhatsApp group link.</p>
      </div>

      <div>
        <label className="label" htmlFor="parentInviteTemplate">Parent invite message</label>
        <textarea
          id="parentInviteTemplate"
          name="parentInviteTemplate"
          defaultValue={defaults.parentInviteTemplate}
          rows={10}
          placeholder="Leave empty to use the standard parent invite."
          className="input font-mono text-sm"
        />
        <p className="field-hint">{"{link}"} becomes the parents community link. {"{parentSalutation}"} is e.g. &quot;Mr Ahmed&quot;.</p>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary btn-sm">
          {pending ? "Saving…" : "Save my messages"}
        </button>
        {state?.ok && <span className="text-sm text-success">Saved ✓</span>}
        {state?.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
