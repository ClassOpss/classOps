import { requireRole } from "@/lib/auth-guards";

export default async function InsightsPage() {
  await requireRole("admin", "teacher");
  return (
    <div>
      <h1 className="text-xl font-semibold">Insights</h1>
      <p className="mt-2 text-sm text-black/40 dark:text-white/40">
        Cross-school topic performance, weak points, and attendance trends land here later.
      </p>
    </div>
  );
}
