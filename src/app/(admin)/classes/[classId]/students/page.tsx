import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { schoolPrefix, uniqueStudentCode } from "@/lib/code";
import { currentOperationId } from "@/lib/operation";
import { ImportStudents } from "./import-students";
import { AddStudentForm } from "./add-student-form";
import { PasteImport } from "./paste-import";
import { EditableStudentRow } from "./editable-student-row";

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/classes/${classId}`} className="link text-sm">← {klass.name}</Link>
          <h1 className="page-title mt-1">Students ({klass.students.length})</h1>
          <p className="page-subtitle">{klass.school.name} · {klass.yearGroup}</p>
        </div>
        <Link href={`/classes/${classId}/invites`} className="btn-secondary btn-sm">
          Onboarding &amp; invites →
        </Link>
      </div>

      {user.role === "admin" && (
        <section className="card p-5">
          <h2 className="section-title mb-1">Import students from spreadsheet</h2>
          <p className="mb-3 text-sm text-muted">
            Captures names, emails, and student/parent phones — used for Classroom &amp; WhatsApp invites.
          </p>
          <PasteImport classId={classId} />
        </section>
      )}

      {user.role === "admin" && (
        <details className="card p-5">
          <summary className="section-title cursor-pointer">Import from PDF (names only)</summary>
          <div className="mt-3">
            <ImportStudents classId={classId} prefix={prefix} existingCodes={existingCodes} />
          </div>
        </details>
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
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-20">Code</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Parent</th>
                  <th className="w-28"></th>
                </tr>
              </thead>
              <tbody>
                {klass.students.map((s) => (
                  <EditableStudentRow
                    key={s.id}
                    isAdmin={user.role === "admin"}
                    student={{
                      id: s.id,
                      code: s.code,
                      name: s.name,
                      email: s.email,
                      phone: s.phone,
                      parentName: s.parentName,
                      parentPhone: s.parentPhone,
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
