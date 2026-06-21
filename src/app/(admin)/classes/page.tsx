import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { scheduleLabel } from "@/lib/schedule";
import { NewSchoolForm, NewClassForm } from "./class-forms";

export default async function ClassesPage() {
  const user = await requireRole("admin", "teacher");
  const isAdmin = user.role === "admin";

  const [schools, classes] = await Promise.all([
    prisma.school.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.class.findMany({
      orderBy: [{ school: { name: "asc" } }, { name: "asc" }],
      include: { school: { select: { name: true } }, _count: { select: { students: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Classes</h1>

      {isAdmin && (
        <div className="flex flex-col gap-6 rounded-md border border-black/10 p-4 dark:border-white/10">
          <NewSchoolForm />
          <div>
            <h2 className="mb-3 font-medium">New class</h2>
            <NewClassForm schools={schools} />
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-3 font-medium">All classes ({classes.length})</h2>
        {classes.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">No classes yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
              <tr>
                <th className="py-2">Class</th>
                <th className="py-2">School</th>
                <th className="py-2">Year</th>
                <th className="py-2">Schedule</th>
                <th className="py-2">Students</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => {
                return (
                  <tr key={c.id} className="border-b border-black/5 dark:border-white/5">
                    <td className="py-2">
                      <Link href={`/classes/${c.id}`} className="text-blue-600 hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-2">{c.school.name}</td>
                    <td className="py-2">{c.yearGroup}</td>
                    <td className="py-2">{scheduleLabel(c.schedule as object)}</td>
                    <td className="py-2">{c._count.students}</td>
                    <td className="py-2">
                      {c.active ? (
                        <span className="text-green-600">Active</span>
                      ) : (
                        <span className="text-black/40">Inactive</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
