import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { endAssignment, autoDivideStudents } from "@/actions/assignments";
import { currentOperationId } from "@/lib/operation";
import { AssignAssistant } from "./assign-assistant";

export default async function AssistantsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const user = await requireRole("admin", "teacher");
  const { classId } = await params;
  const isAdmin = user.role === "admin";
  const operationId = await currentOperationId();

  const klass = await prisma.class.findFirst({
    where: { id: classId, operationId },
    select: { id: true, name: true, school: { select: { name: true } } },
  });
  if (!klass) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Class not found</h1>
        <Link href="/classes" className="link text-sm">← Classes</Link>
      </div>
    );
  }

  const [assignments, allAssistants, subs, studentCount] = await Promise.all([
    prisma.classAssignment.findMany({
      where: { classId, endDate: null },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
      include: { assistant: { select: { id: true, name: true } } },
    }),
    prisma.assistant.findMany({ where: { active: true, operationId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.studentAssistantAssignment.findMany({
      where: { classId, endDate: null },
      include: { student: { select: { id: true, name: true, code: true } } },
    }),
    prisma.student.count({ where: { classId, active: true } }),
  ]);

  const activeIds = new Set(assignments.map((a) => a.assistantId));
  const available = allAssistants.filter((a) => !activeIds.has(a.id));
  const divided = subs.length > 0;

  function studentsFor(assistantId: string) {
    return subs
      .filter((s) => s.assistantId === assistantId)
      .map((s) => s.student)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/classes/${classId}`} className="link text-sm">← {klass.name}</Link>
        <h1 className="page-title mt-1">Assistants</h1>
        <p className="page-subtitle">
          {klass.school.name} · {studentCount} students · {assignments.length}/2 assistants
        </p>
      </div>

      <section className="card p-5">
        <h2 className="section-title mb-3">Assigned assistants</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted">None assigned yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {assignments.map((a, i) => (
              <li key={a.id} className="flex items-center gap-3 text-sm">
                <span className="font-medium">{a.assistant.name}</span>
                {i === 0 && assignments.length > 1 && (
                  <span className="text-xs text-faint">(first — gets the extra student)</span>
                )}
                {isAdmin && (
                  <form action={endAssignment.bind(null, a.id)} className="ml-auto">
                    <button type="submit" className="font-medium text-danger hover:underline">End</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin && (
        <section className="card p-5">
          <h2 className="section-title mb-3">Assign an assistant</h2>
          <AssignAssistant classId={classId} available={available} />
        </section>
      )}

      {isAdmin && (
        <section className="card p-5">
          <h2 className="section-title mb-1">Divide students</h2>
          <p className="mb-3 text-sm text-muted">
            Splits the roster into alphabetical halves between the two assistants (the first
            assistant gets the extra on odd counts). Re-running re-divides everyone.
          </p>
          <form action={autoDivideStudents.bind(null, classId)}>
            <button type="submit" disabled={assignments.length < 2} className="btn-secondary">
              Auto-divide students
            </button>
          </form>
          {assignments.length < 2 && (
            <p className="mt-2 text-xs text-faint">Assign 2 assistants to enable dividing.</p>
          )}
        </section>
      )}

      <section className="card p-5">
        <h2 className="section-title mb-3">Sub-groups</h2>
        {assignments.length <= 1 ? (
          <p className="text-sm text-muted">
            {assignments.length === 1
              ? `${assignments[0].assistant.name} is responsible for all ${studentCount} students.`
              : "No assistants assigned."}
          </p>
        ) : !divided ? (
          <p className="text-sm text-warn">Two assistants assigned — run “Auto-divide students” to split the roster.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {assignments.map((a) => {
              const list = studentsFor(a.assistant.id);
              return (
                <div key={a.id}>
                  <h3 className="mb-2 text-sm font-semibold">
                    {a.assistant.name} ({list.length})
                  </h3>
                  <ul className="flex flex-col gap-1 text-sm">
                    {list.map((s) => (
                      <li key={s.id}>
                        <span className="text-faint">{s.code}</span> {s.name}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
