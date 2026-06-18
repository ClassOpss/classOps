import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { endAssignment, autoDivideStudents } from "@/actions/assignments";
import { AssignAssistant } from "./assign-assistant";

export default async function AssistantsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const user = await requireRole("admin", "teacher");
  const { classId } = await params;
  const isAdmin = user.role === "admin";

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, school: { select: { name: true } } },
  });
  if (!klass) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Class not found</h1>
        <Link href="/classes" className="text-sm text-blue-600 hover:underline">← Classes</Link>
      </div>
    );
  }

  const [assignments, allAssistants, subs, studentCount] = await Promise.all([
    prisma.classAssignment.findMany({
      where: { classId, endDate: null },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
      include: { assistant: { select: { id: true, name: true } } },
    }),
    prisma.assistant.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
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
        <Link href={`/classes/${classId}`} className="text-sm text-blue-600 hover:underline">← {klass.name}</Link>
        <h1 className="mt-1 text-xl font-semibold">Assistants — {klass.name}</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          {klass.school.name} · {studentCount} students · {assignments.length}/2 assistants
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-medium">Assigned assistants</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">None assigned yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {assignments.map((a, i) => (
              <li key={a.id} className="flex items-center gap-3 text-sm">
                <span className="font-medium">{a.assistant.name}</span>
                {i === 0 && assignments.length > 1 && (
                  <span className="text-xs text-black/40">(first — gets the extra student)</span>
                )}
                {isAdmin && (
                  <form action={endAssignment.bind(null, a.id)}>
                    <button type="submit" className="text-sm text-red-600 hover:underline">End</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin && (
        <section>
          <h2 className="mb-3 font-medium">Assign an assistant</h2>
          <AssignAssistant classId={classId} available={available} />
        </section>
      )}

      {isAdmin && (
        <section>
          <h2 className="mb-1 font-medium">Divide students</h2>
          <p className="mb-3 text-sm text-black/50 dark:text-white/50">
            Splits the roster into alphabetical halves between the two assistants (the first
            assistant gets the extra on odd counts). Re-running re-divides everyone.
          </p>
          <form action={autoDivideStudents.bind(null, classId)}>
            <button
              type="submit"
              disabled={assignments.length < 2}
              className="rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
            >
              Auto-divide students
            </button>
          </form>
          {assignments.length < 2 && (
            <p className="mt-2 text-xs text-black/40">Assign 2 assistants to enable dividing.</p>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 font-medium">Sub-groups</h2>
        {assignments.length <= 1 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            {assignments.length === 1
              ? `${assignments[0].assistant.name} is responsible for all ${studentCount} students.`
              : "No assistants assigned."}
          </p>
        ) : !divided ? (
          <p className="text-sm text-amber-600">Two assistants assigned — run “Auto-divide students” to split the roster.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {assignments.map((a) => {
              const list = studentsFor(a.assistant.id);
              return (
                <div key={a.id}>
                  <h3 className="mb-2 text-sm font-medium">
                    {a.assistant.name} ({list.length})
                  </h3>
                  <ul className="flex flex-col gap-1 text-sm">
                    {list.map((s) => (
                      <li key={s.id}>
                        <span className="text-black/40">{s.code}</span> {s.name}
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
