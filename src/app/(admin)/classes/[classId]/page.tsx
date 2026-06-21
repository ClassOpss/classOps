import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { setClassActive } from "@/actions/classes";
import { scheduleDays, scheduleTime, scheduleLabel } from "@/lib/schedule";
import { EditClassForm, type ClassDefaults } from "./edit-class-form";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDateInput(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function ClassOverviewPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const user = await requireRole("admin", "teacher");
  const { classId } = await params;

  const [klass, schools] = await Promise.all([
    prisma.class.findUnique({
      where: { id: classId },
      include: { school: { select: { name: true } }, _count: { select: { students: true } } },
    }),
    prisma.school.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!klass) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Class not found</h1>
        <Link href="/classes" className="text-sm text-blue-600 hover:underline">← Back to classes</Link>
      </div>
    );
  }

  const days = scheduleDays(klass.schedule as object);
  const defaults: ClassDefaults = {
    schoolId: klass.schoolId,
    yearGroup: klass.yearGroup,
    name: klass.name,
    days: days.length ? days : ["Sunday"],
    time: scheduleTime(klass.schedule as object) ?? "16:00",
    planStartDate: toDateInput(klass.planStartDate),
    notes: klass.notes ?? "",
  };
  const isAdmin = user.role === "admin";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/classes" className="text-sm text-blue-600 hover:underline">← Classes</Link>
        <h1 className="mt-1 text-xl font-semibold">{klass.name}</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          {klass.school.name} · {klass.yearGroup} · {scheduleLabel(klass.schedule as object)} ·{" "}
          {klass._count.students} students · {klass.active ? "Active" : "Inactive"}
        </p>
      </div>

      <div className="flex gap-4 text-sm">
        <Link href={`/classes/${classId}/students`} className="text-blue-600 hover:underline">
          Manage students →
        </Link>
        <Link href={`/classes/${classId}/assistants`} className="text-blue-600 hover:underline">
          Assistants &amp; sub-groups →
        </Link>
        <Link href={`/classes/${classId}/sessions`} className="text-blue-600 hover:underline">
          Sessions &amp; day-offs →
        </Link>
        <Link href={`/classes/${classId}/assessments`} className="text-blue-600 hover:underline">
          Assessments →
        </Link>
      </div>

      <section>
        <h2 className="mb-2 font-medium">Monthly report (PDF)</h2>
        <form
          action={`/api/reports/class/${classId}`}
          method="get"
          target="_blank"
          className="flex flex-wrap items-end gap-2"
        >
          <select
            name="month"
            defaultValue={new Date().getUTCMonth() + 1}
            className="rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <input
            name="year"
            type="number"
            defaultValue={new Date().getUTCFullYear()}
            className="w-24 rounded-md border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent"
          />
          <button
            type="submit"
            className="rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Download PDF
          </button>
        </form>
      </section>

      {isAdmin && (
        <>
          <section>
            <h2 className="mb-3 font-medium">Edit class</h2>
            <EditClassForm classId={classId} schools={schools} defaults={defaults} />
          </section>

          <section>
            <form action={setClassActive.bind(null, classId, !klass.active)}>
              <button
                type="submit"
                className="rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                {klass.active ? "Deactivate class" : "Reactivate class"}
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
