import { requireRole } from "@/lib/auth-guards";

export default async function LessonPlanPage() {
  await requireRole("admin", "teacher");
  return (
    <div>
      <h1 className="text-xl font-semibold">Lesson Plan</h1>
      <p className="mt-2 text-sm text-black/40 dark:text-white/40">
        Year-group lesson plans and the day-off cascade land here in a later step.
      </p>
    </div>
  );
}
