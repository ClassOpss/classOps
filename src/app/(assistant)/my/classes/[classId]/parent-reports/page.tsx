import Link from "next/link";
import { requireClassAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { currentOperationId, resolveConfigFor } from "@/lib/operation";
import { ParentReports, type PRStudent } from "@/app/(admin)/classes/[classId]/parent-reports/parent-reports";

export default async function AssistantParentReportsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  await requireClassAccess(classId);
  const operationId = await currentOperationId();

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      name: true,
      students: {
        where: { active: true },
        orderBy: { name: "asc" },
        select: {
          id: true, name: true, code: true, phone: true, parentName: true, parentPhone: true, parentNotes: true,
          attendance: { select: { status: true } },
          grades: { where: { assessment: { isDiagnostic: false }, percentage: { not: null } }, select: { percentage: true } },
          hwSubmissions: { select: { status: true } },
        },
      },
    },
  });
  if (!klass) {
    return <div><Link href="/my" className="link text-sm">← My Classes</Link></div>;
  }
  const cfg = await resolveConfigFor(operationId);

  const students: PRStudent[] = klass.students.map((s) => ({
    id: s.id, name: s.name, code: s.code, phone: s.phone, parentName: s.parentName,
    parentPhone: s.parentPhone, parentNotes: s.parentNotes,
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
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/my/classes/${classId}`} className="link text-sm">← {klass.name}</Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">Parent reports</h1>
        <p className="text-sm text-muted">PDF per student + one-tap WhatsApp for reports and codes.</p>
      </div>
      {students.length === 0 ? (
        <div className="card p-5 text-sm text-muted">No students yet.</div>
      ) : (
        <ParentReports brandName={cfg.brandName} signature={cfg.brandSignature} className={klass.name} students={students} />
      )}
    </div>
  );
}
