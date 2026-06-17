import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">ClassOps</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Sign in to continue
        </p>
      </div>
      <LoginForm callbackUrl={callbackUrl} />
    </main>
  );
}
