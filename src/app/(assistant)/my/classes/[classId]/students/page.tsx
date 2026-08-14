import Link from "next/link";
import { requireClassAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { schoolPrefix, uniqueStudentCode } from "@/lib/code";
import { PasteImport } from "@/app/(admin)/classes/[classId]/students/paste-import";
import { AddStudentForm } from "@/app/(admin)/classes/[classId]/students/add-student-form";
import { EditableStudentRow } from "@/app/(admin)/classes/[classId]/students/editable-student-row";

export default async function AssistantStudentsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  await requireClassAccess(classId);

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      school: { select: { name: true } },
      students: { where: { active: true }, orderBy: { name: "asc" } },
    },
  });
  if (!klass) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Class not found</h1>
        <Link href="/my" className="link text-sm">← My Classes</Link>
      </div>
    );
  }

  const prefix = schoolPrefix(klass.school.name);
  const suggestedCode = uniqueStudentCode(prefix, new Set(klass.students.map((s) => s.code)));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/my/classes/${classId}`} className="link text-sm">← {klass.name}</Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">Students ({klass.students.length})</h1>
        <p className="text-sm text-muted">{klass.school.name}</p>
      </div>

      <section className="card p-4">
        <h2 className="section-title mb-1">Import from spreadsheet</h2>
        <p className="mb-3 text-sm text-muted">Names, emails, and student/parent phones.</p>
        <PasteImport classId={classId} />
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-3">Add a student</h2>
        <AddStudentForm classId={classId} suggestedCode={suggestedCode} />
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="section-title">Roster</h2>
        </div>
        {klass.students.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted">No students yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-20">Code</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Parent</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {klass.students.map((s) => (
                  <EditableStudentRow
                    key={s.id}
                    canRemove={false}
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
