import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { scheduleLabel } from "@/lib/schedule";
import { currentOperationId } from "@/lib/operation";
import { NewSchoolForm, NewClassForm } from "./class-forms";

export default async function ClassesPage() {
  const user = await requireRole("admin", "teacher");
  const isAdmin = user.role === "admin";
  const operationId = await currentOperationId();

  const [schools, classes] = await Promise.all([
    prisma.school.findMany({
      where: { operationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.class.findMany({
      where: { operationId },
      orderBy: [{ school: { name: "asc" } }, { name: "asc" }],
      include: { school: { select: { name: true } }, _count: { select: { students: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="page-title">Classes</h1>
        <p className="page-subtitle">Schools, classes, schedules and rosters.</p>
      </div>

      {isAdmin && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="section-title mb-3">New school</h2>
            <NewSchoolForm />
          </div>
          <div className="card p-5">
            <h2 className="section-title mb-3">New class</h2>
            <NewClassForm schools={schools} />
          </div>
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">All classes ({classes.length})</h2>
        </div>
        {classes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No classes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>School</th>
                  <th>Year</th>
                  <th>Schedule</th>
                  <th>Students</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/classes/${c.id}`} className="link">{c.name}</Link>
                    </td>
                    <td className="text-muted">{c.school.name}</td>
                    <td>{c.yearGroup}</td>
                    <td className="text-muted">{scheduleLabel(c.schedule as object)}</td>
                    <td>{c._count.students}</td>
                    <td>
                      {c.active ? (
                        <span className="badge-success">Active</span>
                      ) : (
                        <span className="badge-neutral">Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
