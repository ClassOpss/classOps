import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { COUNTED_ATTENDANCE } from "@/lib/attendance";
import { currentOperationId, resolveConfigFor } from "@/lib/operation";
import { ParentReports, type PRStudent, type PRSentLog } from "./parent-reports";

export default async function ParentReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
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
          code: true,
          phone: true,
          parentPrefix: true,
          parentName: true,
          parentPhone: true,
          parentNotes: true,
          attendance: { where: COUNTED_ATTENDANCE, select: { status: true } },
          grades: {
            where: { assessment: { isDiagnostic: false }, percentage: { not: null } },
            select: { percentage: true },
          },
          hwSubmissions: { select: { status: true } },
          reportLogs: { select: { year: true, month: true, sentAt: true } },
        },
      },
    },
  });
  if (!klass) notFound();
  const cfg = await resolveConfigFor(operationId);
  const sp = await searchParams;
  const initialMonth = Number(sp.month) >= 1 && Number(sp.month) <= 12 ? Number(sp.month) : undefined;
  const initialYear = Number(sp.year) > 2000 ? Number(sp.year) : undefined;
  const sentLogs: PRSentLog[] = klass.students.flatMap((s) =>
    s.reportLogs.map((l) => ({ studentId: s.id, year: l.year, month: l.month, sentAt: l.sentAt.toISOString() })),
  );


  const students: PRStudent[] = klass.students.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    phone: s.phone,
    parentPrefix: s.parentPrefix,
    parentName: s.parentName,
    parentPhone: s.parentPhone,
    parentNotes: s.parentNotes,
    present: s.attendance.filter((a) => a.status === "present").length,
    total: s.attendance.length,
    avg: s.grades.length ? s.grades.reduce((sum, g) => sum + Number(g.percentage), 0) / s.grades.length : null,
    hw: {
      onTime: s.hwSubmissions.filter((h) => h.status === "on_time").length,
      late: s.hwSubmissions.filter((h) => h.status === "late").length,
      missing: s.hwSubmissions.filter((h) => h.status === "missing").length,
    },
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/classes/${classId}`} className="text-sm text-brand hover:underline">← {klass.name}</Link>
        <h1 className="page-title mt-1">Parent reports</h1>
        <p className="page-subtitle">
          Detailed PDF per student, plus one-tap WhatsApp for the report, or to send each family their code.
        </p>
      </div>

      {students.length === 0 ? (
        <div className="card p-6 text-sm text-muted">No students yet.</div>
      ) : (
        <ParentReports brandName={cfg.brandName} signature={cfg.brandSignature} className={klass.name}
          students={students}
          sentLogs={sentLogs}
          initialMonth={initialMonth}
          initialYear={initialYear}
        />
      )}

      <p className="text-xs text-faint">
        The PDF covers the selected month: attendance/absences, missed homework, this month&apos;s grades vs the class
        average, and your notes. WhatsApp buttons open a chat to that student&apos;s or parent&apos;s number.
      </p>
    </div>
  );
}
