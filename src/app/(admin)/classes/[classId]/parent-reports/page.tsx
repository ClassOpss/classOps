import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { currentOperationId, resolveConfigFor } from "@/lib/operation";
import { waLink, parentReportMessage } from "@/lib/invites";

export default async function ParentReportsPage({ params }: { params: Promise<{ classId: string }> }) {
  await requireRole("admin", "teacher");
  const { classId } = await params;
  const operationId = await currentOperationId();

  const klass = await prisma.class.findFirst({
    where: { id: classId, operationId },
    select: {
      name: true,
      students: {
        where: { active: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          parentName: true,
          parentPhone: true,
          attendance: { select: { status: true } },
          grades: {
            where: { assessment: { isDiagnostic: false }, percentage: { not: null } },
            select: { percentage: true },
          },
          hwSubmissions: { select: { status: true } },
        },
      },
    },
  });
  if (!klass) notFound();
  const cfg = await resolveConfigFor(operationId);

  const rows = klass.students.map((s) => {
    const present = s.attendance.filter((a) => a.status === "present").length;
    const total = s.attendance.length;
    const avg =
      s.grades.length > 0
        ? s.grades.reduce((sum, g) => sum + Number(g.percentage), 0) / s.grades.length
        : null;
    const hw = {
      onTime: s.hwSubmissions.filter((h) => h.status === "on_time").length,
      late: s.hwSubmissions.filter((h) => h.status === "late").length,
      missing: s.hwSubmissions.filter((h) => h.status === "missing").length,
    };
    const href = waLink(
      s.parentPhone,
      parentReportMessage({
        brandName: cfg.brandName,
        className: klass.name,
        studentName: s.name,
        parentName: s.parentName,
        attendance: { present, total },
        avgPercent: avg,
        hw,
      }),
    );
    return { id: s.id, name: s.name, parentName: s.parentName, present, total, avg, hw, href };
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/classes/${classId}`} className="text-sm text-brand hover:underline">← {klass.name}</Link>
        <h1 className="page-title mt-1">Parent reports</h1>
        <p className="page-subtitle">
          Send each parent their own child&apos;s progress privately over WhatsApp — one tap, pre-filled.
        </p>
      </div>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Attendance</th>
                <th>Avg</th>
                <th>Homework</th>
                <th>Send to parent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.name}</td>
                  <td className="text-muted">{r.total > 0 ? `${r.present}/${r.total}` : "—"}</td>
                  <td className="text-muted">{r.avg == null ? "—" : `${Math.round(r.avg)}%`}</td>
                  <td className="text-muted">
                    <span className="text-success">{r.hw.onTime}</span> ·{" "}
                    <span className="text-warn">{r.hw.late}</span> ·{" "}
                    <span className="text-danger">{r.hw.missing}</span>
                  </td>
                  <td>
                    {r.href ? (
                      <a href={r.href} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                        WhatsApp
                      </a>
                    ) : (
                      <span className="text-xs text-faint">no parent phone</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-faint">
        Homework shown as on-time · late · missing. Reports go privately to each parent&apos;s number
        from the roster (students-only emails, so WhatsApp is used here).
      </p>
    </div>
  );
}
