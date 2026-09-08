import Link from "next/link";
import { requireClassAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { normalizePhone, studentInviteMessage, parentInviteMessage } from "@/lib/invites";
import { WhatsAppSend } from "@/components/whatsapp-send";

// Assistant-facing invites: send each student/parent their class WhatsApp group +
// Classroom join links with one tap (no auto-adding — no ban risk). The links
// themselves are class config set by the admin (read-only here).
export default async function AssistantInvitesPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  await requireClassAccess(classId);

  const klass = await prisma.class.findUnique({
    where: { id: classId },
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

  const usesClassroom = klass.lmsType === "google_classroom";
  const classroomLink = usesClassroom ? klass.googleClassroomLink : null;
  const hasLinks = !!(classroomLink || klass.studentGroupLink || klass.parentCommunityLink);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/my/classes/${classId}`} className="link text-sm">← {klass.name}</Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">Onboarding &amp; invites</h1>
        <p className="text-sm text-muted">
          Send each student and parent their class links with one tap — no manual adding, no ban risk.
        </p>
      </div>

      {/* Links (read-only — set by admin) */}
      <section className="card p-4">
        <h2 className="section-title mb-3">Class links</h2>
        {!hasLinks ? (
          <p className="text-sm text-muted">
            No class links set yet. Ask your admin to add the WhatsApp group / community links
            on this class, then you can send them here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {klass.studentGroupLink && (
              <li>
                <span className="text-muted">Student WhatsApp group: </span>
                <a href={klass.studentGroupLink} target="_blank" rel="noreferrer" className="link break-all">
                  {klass.studentGroupLink}
                </a>
              </li>
            )}
            {klass.parentCommunityLink && (
              <li>
                <span className="text-muted">Parents community: </span>
                <a href={klass.parentCommunityLink} target="_blank" rel="noreferrer" className="link break-all">
                  {klass.parentCommunityLink}
                </a>
              </li>
            )}
            {classroomLink && (
              <li>
                <span className="text-muted">Google Classroom: </span>
                <a href={classroomLink} target="_blank" rel="noreferrer" className="link break-all">
                  {classroomLink}
                </a>
              </li>
            )}
          </ul>
        )}
      </section>

      {/* Send */}
      <section className="card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="section-title">Send invites ({klass.students.length})</h2>
          <p className="mt-0.5 text-sm text-muted">
            Each button opens WhatsApp with the invite pre-filled to that person — you just press send.
          </p>
        </div>

        {!hasLinks ? (
          <p className="px-4 py-6 text-sm text-muted">Ask your admin to add the class links first.</p>
        ) : klass.students.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No students yet — add them on the Students page.</p>
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
                  const studentMsg = studentInviteMessage({
                    className: klass.name,
                    studentName: s.name,
                    studentGroupLink: klass.studentGroupLink,
                    classroomLink,
                  });
                  const parentMsg = parentInviteMessage({
                    className: klass.name,
                    parentName: s.parentName,
                    studentName: s.name,
                    parentCommunityLink: klass.parentCommunityLink,
                  });
                  return (
                    <tr key={s.id}>
                      <td className="font-medium">{s.name}</td>
                      <td>
                        {normalizePhone(s.phone) ? (
                          <WhatsAppSend phone={s.phone} message={studentMsg} />
                        ) : (
                          <span className="text-xs text-faint">no phone</span>
                        )}
                      </td>
                      <td className="text-muted">{s.parentName ?? "—"}</td>
                      <td>
                        {normalizePhone(s.parentPhone) ? (
                          <WhatsAppSend phone={s.parentPhone} message={parentMsg} />
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

      <p className="text-xs text-faint">
        Auto-adding to WhatsApp groups isn&apos;t offered on purpose — it violates WhatsApp&apos;s
        terms and risks a ban. Sending the join link is the safe way.
      </p>
    </div>
  );
}
