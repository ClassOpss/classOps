import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { currentOperationId } from "@/lib/operation";
import { waLink, studentInviteMessage, parentInviteMessage } from "@/lib/invites";
import { ClassLinksForm } from "./class-links-form";

export default async function InvitesPage({ params }: { params: Promise<{ classId: string }> }) {
  await requireRole("admin", "teacher");
  const { classId } = await params;
  const operationId = await currentOperationId();

  const klass = await prisma.class.findFirst({
    where: { id: classId, operationId },
    select: {
      name: true,
      lmsType: true,
      googleClassroomLink: true,
      studentGroupLink: true,
      parentCommunityLink: true,
      students: {
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, phone: true, parentName: true, parentPhone: true },
      },
      assignments: {
        where: { endDate: null },
        select: { assistant: { select: { id: true, name: true, phone: true } } },
      },
    },
  });
  if (!klass) notFound();

  const usesClassroom = klass.lmsType === "google_classroom";
  // For IE Learn classes we don't send Google Classroom invites at all.
  const classroomLink = usesClassroom ? klass.googleClassroomLink : null;
  const hasLinks = !!(classroomLink || klass.studentGroupLink || klass.parentCommunityLink);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/classes/${classId}`} className="text-sm text-brand hover:underline">← {klass.name}</Link>
        <h1 className="page-title mt-1">Onboarding &amp; invites</h1>
        <p className="page-subtitle">
          Send each student and parent their class links with one tap — no manual adding, no ban risk.
        </p>
      </div>

      {/* Links */}
      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">Class links</h2>
          <p className="mt-0.5 text-sm text-muted">
            Create each group/community/Classroom once, then paste the invite links here.
          </p>
        </div>
        <div className="px-5 py-5">
          <ClassLinksForm
            classId={classId}
            showClassroom={usesClassroom}
            defaults={{
              googleClassroomLink: klass.googleClassroomLink ?? "",
              studentGroupLink: klass.studentGroupLink ?? "",
              parentCommunityLink: klass.parentCommunityLink ?? "",
            }}
          />
        </div>
      </section>

      {/* Send */}
      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">Send invites ({klass.students.length})</h2>
          <p className="mt-0.5 text-sm text-muted">
            Each button opens WhatsApp with the invite pre-filled to that person — you just press send.
          </p>
        </div>

        {!hasLinks ? (
          <p className="px-5 py-6 text-sm text-muted">Add the class links above first.</p>
        ) : klass.students.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No students yet — import them on the Students page.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Send to student</th>
                  <th>Parent</th>
                  <th>Send to parent</th>
                </tr>
              </thead>
              <tbody>
                {klass.students.map((s) => {
                  const studentHref = waLink(
                    s.phone,
                    studentInviteMessage({
                      className: klass.name,
                      studentName: s.name,
                      studentGroupLink: klass.studentGroupLink,
                      classroomLink,
                    }),
                  );
                  const parentHref = waLink(
                    s.parentPhone,
                    parentInviteMessage({
                      className: klass.name,
                      parentName: s.parentName,
                      studentName: s.name,
                      parentCommunityLink: klass.parentCommunityLink,
                    }),
                  );
                  return (
                    <tr key={s.id}>
                      <td className="font-medium">{s.name}</td>
                      <td>
                        {studentHref ? (
                          <a href={studentHref} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                            WhatsApp
                          </a>
                        ) : (
                          <span className="text-xs text-faint">no phone</span>
                        )}
                      </td>
                      <td className="text-muted">{s.parentName ?? "—"}</td>
                      <td>
                        {parentHref ? (
                          <a href={parentHref} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                            WhatsApp
                          </a>
                        ) : (
                          <span className="text-xs text-faint">no phone</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Assistants */}
      {klass.studentGroupLink && klass.assignments.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="section-title">Assistants ({klass.assignments.length})</h2>
            <p className="mt-0.5 text-sm text-muted">Send each assistant the class WhatsApp group link.</p>
          </div>
          <ul className="divide-y divide-border">
            {klass.assignments.map(({ assistant: a }) => {
              const href = waLink(
                a.phone,
                `Hi ${a.name}, join the ${klass.name} class WhatsApp group: ${klass.studentGroupLink}`,
              );
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 text-sm">
                  <span className="font-medium">{a.name}</span>
                  <span className="ml-auto">
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                        WhatsApp
                      </a>
                    ) : (
                      <span className="text-xs text-faint">no number — add it on Users</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="text-xs text-faint">
        Bulk email/SMS sending (one click for everyone) arrives once email is connected. Auto-adding to
        WhatsApp groups isn&apos;t offered on purpose — it violates WhatsApp&apos;s terms and risks a ban.
      </p>
    </div>
  );
}
