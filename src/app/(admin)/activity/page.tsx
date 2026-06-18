import { requireRole } from "@/lib/auth-guards";

export default async function ActivityPage() {
  await requireRole("admin");
  return (
    <div>
      <h1 className="text-xl font-semibold">Activity</h1>
      <p className="mt-2 text-sm text-black/40 dark:text-white/40">
        The cross-class activity feed lands here in a later step.
      </p>
    </div>
  );
}
