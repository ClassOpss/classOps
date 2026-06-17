import { SetPasswordForm } from "./set-password-form";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const { email, token } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Welcome to ClassOps</h1>
        <p className="text-sm text-black/60 dark:text-white/60">Set a password to activate your account</p>
      </div>
      {email && token ? (
        <SetPasswordForm email={email} token={token} />
      ) : (
        <p className="text-sm text-red-600">
          This link is missing its setup details. Ask the admin to resend your invite.
        </p>
      )}
    </main>
  );
}
