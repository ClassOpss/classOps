import { requireRole } from "@/lib/auth-guards";

export default async function MyClassesPage() {
  const user = await requireRole("assistant", "admin");

  return (
    <div>
      <h1 className="text-lg font-semibold">My Classes</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        Signed in as {user.email} ({user.role}).
      </p>
      <p className="mt-4 text-sm text-black/40 dark:text-white/40">
        Your assigned classes and today&apos;s tasks land here in a later step.
      </p>
    </div>
  );
}
