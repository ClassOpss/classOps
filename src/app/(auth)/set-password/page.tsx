import { SetPasswordForm } from "./set-password-form";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const { email, token } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-brand text-brand-fg shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
              <path
                d="M3 8l9-4 9 4-9 4-9-4Z M7 11v4c0 1 2.2 2 5 2s5-1 5-2v-4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to ClassOps</h1>
          <p className="page-subtitle">Set a password to activate your account.</p>
        </div>
        <div className="card p-6">
          {email && token ? (
            <SetPasswordForm email={email} token={token} />
          ) : (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              This link is missing its setup details. Ask the admin to resend your invite.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
