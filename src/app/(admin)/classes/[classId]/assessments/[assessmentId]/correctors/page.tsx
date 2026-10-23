import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { currentOperationId } from "@/lib/operation";
import { paperRows } from "@/lib/paper-owners";
import { setPaperOwners } from "@/actions/paper-owners";
import { PaperOwnersSummary } from "@/components/paper-owners";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

// Who corrects each paper for one assessment. Graded papers show who corrected them
// (fixed); ungraded ones can be moved by an admin. Late fines follow this ownership.
export default async function CorrectorsPage({
  params,
}: {
  params: Promise<{ classId: string; assessmentId: string }>;
}) {
  const user = await requireRole("admin", "teacher");
  const { classId, assessmentId } = await params;
  const operationId = await currentOperationId();
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, classId, class: { operationId } },
    select: { label: true, date: true, class: { select: { name: true } } },
  });
  if (!assessment) notFound();
  const papers = await paperRows(assessmentId);
  const rows = papers?.rows ?? [];
  const assistants = papers?.assistants ?? [];
  const claims = new Map(
    (await prisma.assessmentCorrector.findMany({ where: { assessmentId }, select: { studentId: true, assistantId: true } }))
      .map((c) => [c.studentId, c.assistantId]),
  );
  const isAdmin = user.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/classes/${classId}/assessments`} className="link text-sm">← {assessment.class.name} assessments</Link>
        <h1 className="page-title mt-1">Who&apos;s correcting · {assessment.label}</h1>
        <p className="text-sm text-muted">
          {dateFmt.format(assessment.date)} · late grade-entry fines only go to the assistant who owns an ungraded paper.
        </p>
      </div>

      <section className="card p-5">
        <PaperOwnersSummary rows={rows} />
      </section>

      <form action={setPaperOwners.bind(null, assessmentId)} className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>Corrector</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.studentId}>
                  <td className="font-medium">{r.name}</td>
                  <td>
                    {r.graded ? <span className="badge-success">Graded</span> : <span className="badge-warn">To do</span>}
                  </td>
                  <td>
                    {r.graded || !isAdmin ? (
                      <span className="text-sm">
                        {r.ownerName}
                        {r.claimed ? <span className="ml-1.5 text-xs text-muted">(took over)</span> : null}
                      </span>
                    ) : (
                      <select name={`owner_${r.studentId}`} defaultValue={claims.get(r.studentId) ?? ""} className="select !py-1.5">
                        <option value="">Sub-group default{!r.claimed ? ` (${r.ownerName})` : ""}</option>
                        {assistants.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isAdmin && rows.some((r) => !r.graded) && (
          <div className="flex items-center justify-between gap-3 border-t border-border p-3">
            <p className="text-xs text-muted">
              Moving papers doesn&apos;t touch fines already issued — waive those from the dashboard.
            </p>
            <button type="submit" className="btn-primary">Save correctors</button>
          </div>
        )}
      </form>
    </div>
  );
}
