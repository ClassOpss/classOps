"use client";

import Link from "next/link";
import { useActionState } from "react";
import { authenticate, type LoginState } from "@/actions/auth";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    authenticate,
    undefined,
  );

  // TEMP EMOJI DIAGNOSTIC — remove after diagnosis. Puts emoji (3 ways) into the
  // PUBLIC login client chunk so we can hexdump the Railway-built bundle bytes.
  const _fc = String.fromCodePoint;
  const _emojiDiag =
    "DIAG1 litL:✅ fcL:" + _fc(0x2705) + " decL:" + decodeURIComponent("%E2%9C%85") +
    " litH:💗 fcH:" + _fc(0x1f497) + " decH:" + decodeURIComponent("%F0%9F%92%97");

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/"} />
      <input type="hidden" name="_diag" data-diag={_emojiDiag} />

      {state?.error ? (
        <p
          className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger"
          role="alert"
          aria-live="assertive"
        >
          {state.error}
        </p>
      ) : null}

      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>

      <div>
        <label htmlFor="password" className="label">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="input"
        />
      </div>

      <button type="submit" disabled={isPending} className="btn-primary mt-1 w-full">
        {isPending ? "Signing in…" : "Sign in"}
      </button>

      <Link href="/forgot-password" className="text-center text-sm text-muted hover:text-brand">
        Forgot password?
      </Link>
    </form>
  );
}
