import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { deleteAssessment } from "@/actions/assessments";
import { AssessmentForm } from "./assessment-form";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const TYPE_LABEL: Record<string, string> = {
  quiz: "Quiz",
  midterm: "Midterm",
  past_paper: "Past paper",
  exam: "Exam",
};

export default async function AssessmentsAdminPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const user = await requireRole("admin", "teacher");
  const { classId } = await params;

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { name: true },
  });
  const assessments = await prisma.assessment.findMany({
    where: { classId },
    orderBy: { date: "desc" },
    include: { _count: { select: { grades: true } } },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/classes/${classId}`} className="text-sm text-blue-600 hover:underline">← {klass?.name}</Link>
        <h1 className="mt-1 text-xl font-semibold">Assessments</h1>
      </div>

      <section>
        <h2 className="mb-3 font-medium">New assessment</h2>
        <AssessmentForm classId={classId} />
      </section>

      <section>
        <h2 className="mb-3 font-medium">All assessments ({assessments.length})</h2>
        {assessments.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">None yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
              <tr>
                <th className="py-2">Label</th>
                <th className="py-2">Type</th>
                <th className="py-2">Date</th>
                <th className="py-2">Max</th>
                <th className="py-2">Grades</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2">
                    {a.label}
                    {a.isDiagnostic ? <span className="ml-1 text-xs text-black/40">· Diagnostic</span> : null}
                  </td>
                  <td className="py-2">{TYPE_LABEL[a.type]}</td>
                  <td className="py-2">{dateFmt.format(a.date)}</td>
                  <td className="py-2">{a.maxMark}</td>
                  <td className="py-2">{a._count.grades}</td>
                  <td className="py-2">
                    {user.role === "admin" && a._count.grades === 0 && (
                      <form action={deleteAssessment.bind(null, a.id)}>
                        <button type="submit" className="text-red-600 hover:underline">Delete</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
