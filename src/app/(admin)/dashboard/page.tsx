import { requireRole } from "@/lib/auth-guards";

export default async function DashboardPage() {
  const user = await requireRole("admin", "teacher");

  return (
    <div>
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        Signed in as {user.email} ({user.role}).
      </p>
      <p className="mt-4 text-sm text-black/40 dark:text-white/40">
        Stat cards, alerts, and the class status table land here in a later step.
      </p>
    </div>
  );
}
