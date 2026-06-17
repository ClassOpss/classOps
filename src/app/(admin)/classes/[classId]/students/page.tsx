import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { ImportStudents } from "./import-students";

// Next suggested code: max numeric suffix of existing "C<n>" codes + 1.
function nextCodeNumber(codes: string[]): number {
  let max = 0;
  for (const c of codes) {
    const m = /^C(\d+)$/.exec(c.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

export default async function StudentsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const user = await requireRole("admin", "teacher");
  const { classId } = await params;

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      school: { select: { name: true } },
      students: { orderBy: { name: "asc" } },
    },
  });

  if (!klass) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Class not found</h1>
        <Link href="/classes" className="text-sm text-blue-600 hover:underline">← Back to classes</Link>
      </div>
    );
  }

  const startNumber = nextCodeNumber(klass.students.map((s) => s.code));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">
          {klass.name} — Students ({klass.students.length})
        </h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          {klass.school.name} · {klass.yearGroup}
        </p>
      </div>

      {user.role === "admin" && (
        <section>
          <h2 className="mb-3 font-medium">Import students from PDF</h2>
          <ImportStudents classId={classId} startNumber={startNumber} />
        </section>
      )}

      <section>
        <h2 className="mb-3 font-medium">Roster</h2>
        {klass.students.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">No students yet.</p>
        ) : (
          <table className="w-full max-w-md text-left text-sm">
            <thead className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
              <tr>
                <th className="w-20 py-2">Code</th>
                <th className="py-2">Name</th>
              </tr>
            </thead>
            <tbody>
              {klass.students.map((s) => (
                <tr key={s.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2">{s.code}</td>
                  <td className="py-2">{s.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
