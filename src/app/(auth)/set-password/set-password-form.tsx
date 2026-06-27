"use client";

import { useActionState } from "react";
import { setPassword, type SetPasswordState } from "@/actions/account";

export function SetPasswordForm({ email, token }: { email: string; token: string }) {
  const [state, formAction, isPending] = useActionState<SetPasswordState, FormData>(
    setPassword,
    undefined,
  );

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="token" value={token} />

      <p className="text-sm text-muted">
        Setting up: <span className="font-medium text-fg">{email}</span>
      </p>

      <div>
        <label htmlFor="password" className="label">New password</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>

      <div>
        <label htmlFor="confirm" className="label">Confirm password</label>
        <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>

      {state?.error ? (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{state.error}</p>
      ) : null}

      <button type="submit" disabled={isPending} className="btn-primary mt-1 w-full">
        {isPending ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}
