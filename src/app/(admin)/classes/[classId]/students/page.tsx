import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { deactivateStudent } from "@/actions/students";
import { schoolPrefix, uniqueStudentCode } from "@/lib/code";
import { currentOperationId } from "@/lib/operation";
import { ImportStudents } from "./import-students";
import { AddStudentForm } from "./add-student-form";

export default async function StudentsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const user = await requireRole("admin", "teacher");
  const { classId } = await params;
  const operationId = await currentOperationId();

  const klass = await prisma.class.findFirst({
    where: { id: classId, operationId },
    include: {
      school: { select: { name: true } },
      students: { where: { active: true }, orderBy: { name: "asc" } },
    },
  });

  if (!klass) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Class not found</h1>
        <Link href="/classes" className="link text-sm">← Back to classes</Link>
      </div>
    );
  }

  const existingCodes = klass.students.map((s) => s.code);
  const prefix = schoolPrefix(klass.school.name);
  const suggestedCode = uniqueStudentCode(prefix, new Set(existingCodes));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/classes/${classId}`} className="link text-sm">← {klass.name}</Link>
        <h1 className="page-title mt-1">Students ({klass.students.length})</h1>
        <p className="page-subtitle">{klass.school.name} · {klass.yearGroup}</p>
      </div>

      {user.role === "admin" && (
        <section className="card p-5">
          <h2 className="section-title mb-3">Import students from PDF</h2>
          <ImportStudents classId={classId} prefix={prefix} existingCodes={existingCodes} />
        </section>
      )}

      {user.role === "admin" && (
        <section className="card p-5">
          <h2 className="section-title mb-3">Add a student manually</h2>
          <AddStudentForm classId={classId} suggestedCode={suggestedCode} />
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">Roster</h2>
        </div>
        {klass.students.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No students yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="w-20">Code</th>
                <th>Name</th>
                {user.role === "admin" && <th className="w-20"></th>}
              </tr>
            </thead>
            <tbody>
              {klass.students.map((s) => (
                <tr key={s.id}>
                  <td><span className="badge-neutral">{s.code}</span></td>
                  <td className="font-medium">{s.name}</td>
                  {user.role === "admin" && (
                    <td>
                      <form action={deactivateStudent.bind(null, s.id)}>
                        <button type="submit" className="font-medium text-danger hover:underline">
                          Remove
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
