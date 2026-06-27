import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { setClassActive } from "@/actions/classes";
import { scheduleSlots, scheduleLabel } from "@/lib/schedule";
import { currentOperationId } from "@/lib/operation";
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
  const operationId = await currentOperationId();

  const [klass, schools] = await Promise.all([
    prisma.class.findFirst({
      where: { id: classId, operationId },
      include: { school: { select: { name: true } }, _count: { select: { students: true } } },
    }),
    prisma.school.findMany({ where: { operationId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!klass) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Class not found</h1>
        <Link href="/classes" className="link text-sm">← Back to classes</Link>
      </div>
    );
  }

  const slots = scheduleSlots(klass.schedule as object);
  const defaults: ClassDefaults = {
    schoolId: klass.schoolId,
    yearGroup: klass.yearGroup,
    name: klass.name,
    times: Object.fromEntries(slots.map((s) => [s.day, s.time || "16:00"])),
    planStartDate: toDateInput(klass.planStartDate),
    notes: klass.notes ?? "",
  };
  const isAdmin = user.role === "admin";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/classes" className="link text-sm">← Classes</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="page-title">{klass.name}</h1>
          <span className={klass.active ? "badge-success" : "badge-neutral"}>
            {klass.active ? "Active" : "Inactive"}
          </span>
        </div>
        <p className="page-subtitle">
          {klass.school.name} · {klass.yearGroup} · {scheduleLabel(klass.schedule as object)} ·{" "}
          {klass._count.students} students
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: `/classes/${classId}/students`, label: "Manage students" },
          { href: `/classes/${classId}/assistants`, label: "Assistants & sub-groups" },
          { href: `/classes/${classId}/sessions`, label: "Sessions & day-offs" },
          { href: `/classes/${classId}/assessments`, label: "Assessments" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="card flex items-center justify-between px-4 py-3 text-sm font-medium text-fg transition-colors hover:border-border-strong">
            {l.label}
            <span className="text-faint">→</span>
          </Link>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="section-title mb-3">Monthly report (PDF)</h2>
        <form
          action={`/api/reports/class/${classId}`}
          method="get"
          target="_blank"
          className="flex flex-wrap items-end gap-2"
        >
          <select name="month" defaultValue={new Date().getUTCMonth() + 1} className="select w-auto">
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <input name="year" type="number" defaultValue={new Date().getUTCFullYear()} className="input w-24" />
          <button type="submit" className="btn-secondary">Download PDF</button>
        </form>
      </section>

      {isAdmin && (
        <>
          <section className="card p-5">
            <h2 className="section-title mb-3">Edit class</h2>
            <EditClassForm classId={classId} schools={schools} defaults={defaults} />
          </section>

          <section>
            <form action={setClassActive.bind(null, classId, !klass.active)}>
              <button type="submit" className="btn-secondary">
                {klass.active ? "Deactivate class" : "Reactivate class"}
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
