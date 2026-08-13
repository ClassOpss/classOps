"use client";

import { useActionState } from "react";
import { requestPasswordReset, type PwState } from "@/actions/account";

export function ForgotForm() {
  const [state, action, pending] = useActionState<PwState, FormData>(requestPasswordReset, undefined);

  if (state?.ok) {
    return (
      <p className="rounded-lg bg-success-soft px-3 py-3 text-sm text-success">
        If an account exists for that email, a reset link is on its way. Check your inbox (and spam).
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="input" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Sending…" : "Send reset link"}
      </button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
