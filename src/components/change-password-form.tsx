"use client";

import { useActionState } from "react";
import { changePassword, type PwState } from "@/actions/account";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<PwState, FormData>(changePassword, undefined);
  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      <div>
        <label className="label" htmlFor="current">Current password</label>
        <input id="current" name="current" type="password" required autoComplete="current-password" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="next">New password</label>
        <input id="next" name="next" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary btn-sm">
          {pending ? "Updating…" : "Update password"}
        </button>
        {state?.ok && <span className="text-sm text-success">Password updated ✓</span>}
        {state?.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
