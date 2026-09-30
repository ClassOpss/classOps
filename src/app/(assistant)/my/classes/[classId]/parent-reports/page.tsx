import Link from "next/link";
import { requireClassAccess, getVisibleStudentIds } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { loadParentReportStudents } from "@/lib/parent-report-students";
import { cairoToday } from "@/lib/datetime";
import { currentOperationId, resolveConfigFor } from "@/lib/operation";
import { ParentReports, type PRStudent, type PRSentLog } from "@/app/(admin)/classes/[classId]/parent-reports/parent-reports";

export default async function AssistantParentReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { classId } = await params;
  const user = await requireClassAccess(classId);
  const operationId = await currentOperationId();

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      name: true,
      students: {
        where: { active: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          reportLogs: { select: { year: true, month: true, sentAt: true } },
        },
      },
    },
  });
  if (!klass) {
    return <div><Link href="/my" className="link text-sm">← My Classes</Link></div>;
  }
  const cfg = await resolveConfigFor(operationId);
  // "N of M sent" counts only this assistant's sub-group (what the monthly task checks).
  const countIds = await getVisibleStudentIds(classId, user);
  const sp = await searchParams;
  const initialMonth = Number(sp.month) >= 1 && Number(sp.month) <= 12 ? Number(sp.month) : undefined;
  const initialYear = Number(sp.year) > 2000 ? Number(sp.year) : undefined;
  const sentLogs: PRSentLog[] = klass.students.flatMap((s) =>
    s.reportLogs.map((l) => ({ studentId: s.id, year: l.year, month: l.month, sentAt: l.sentAt.toISOString() })),
  );


  const students: PRStudent[] = await loadParentReportStudents(classId);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/my/classes/${classId}`} className="link text-sm">← {klass.name}</Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">Parent reports</h1>
        <p className="text-sm text-muted">PDF per student + one-tap WhatsApp for reports and codes.</p>
      </div>
      {students.length === 0 ? (
        <div className="card p-5 text-sm text-muted">No students yet.</div>
      ) : (
        <ParentReports brandName={cfg.brandName} signature={cfg.brandSignature} className={klass.name}
          students={students}
          sentLogs={sentLogs}
          countIds={countIds}
          initialMonth={initialMonth}
          initialYear={initialYear}
          today={cairoToday().toISOString()}
        />
      )}
    </div>
  );
}
