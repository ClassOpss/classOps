"use client";

import { useActionState } from "react";
import { setPassword, type SetPasswordState } from "@/actions/account";

export function SetPasswordForm({ email, token }: { email: string; token: string }) {
  const [state, formAction, isPending] = useActionState<SetPasswordState, FormData>(
    setPassword,
    undefined,
  );

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="token" value={token} />

      <p className="text-sm text-black/60 dark:text-white/60">
        Setting up: <span className="font-medium">{email}</span>
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">New password</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password"
          className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent" />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="confirm" className="text-sm font-medium">Confirm password</label>
        <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password"
          className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent" />
      </div>

      {state?.error ? <p className="text-sm text-red-600" role="alert">{state.error}</p> : null}

      <button type="submit" disabled={isPending}
        className="mt-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50">
        {isPending ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}
