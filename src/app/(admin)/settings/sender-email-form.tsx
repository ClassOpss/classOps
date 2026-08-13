"use client";

import { useActionState } from "react";
import { setSenderEmail, type BrandingState } from "@/actions/branding";

export function SenderEmailForm({ defaultValue }: { defaultValue: string }) {
  const [state, action, pending] = useActionState<BrandingState, FormData>(setSenderEmail, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="senderEmail"
          type="email"
          defaultValue={defaultValue}
          placeholder="teacher@example.com"
          className="input max-w-xs"
        />
        <button type="submit" disabled={pending} className="btn-primary btn-sm">
          {pending ? "Saving…" : "Save"}
        </button>
        {state?.ok && <span className="text-sm text-success">Saved ✓</span>}
        {state?.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
      <p className="field-hint">
        Invites are sent from this address if you verify it in your email provider; otherwise they
        come from the platform address with your brand name and this set as Reply-To.
      </p>
    </form>
  );
}
