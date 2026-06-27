import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { currentOperationId, resolveConfigFor } from "@/lib/operation";
import { deleteAssessment } from "@/actions/assessments";
import { buildQuizAnnouncement, friendlyTime, topicsFromNotes } from "@/lib/whatsapp/quiz-announcement";
import { AssessmentForm } from "./assessment-form";
import { QuizAnnouncement } from "./quiz-announcement";

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
  const operationId = await currentOperationId();

  const klass = await prisma.class.findFirst({
    where: { id: classId, operationId },
    select: { name: true },
  });
  if (!klass) notFound();
  const cfg = await resolveConfigFor(operationId);
  const assessments = await prisma.assessment.findMany({
    where: { classId },
    orderBy: { date: "desc" },
    include: { _count: { select: { grades: true } }, topic: { select: { title: true } } },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/classes/${classId}`} className="link text-sm">← {klass?.name}</Link>
        <h1 className="page-title mt-1">Assessments</h1>
      </div>

      <section className="card p-5">
        <h2 className="section-title mb-3">New assessment</h2>
        <AssessmentForm classId={classId} />
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">All assessments ({assessments.length})</h2>
        </div>
        {assessments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">None yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Type</th>
                <th>Date</th>
                <th>Max</th>
                <th>Grades</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium">
                    {a.label}
                    {a.isDiagnostic ? <span className="ml-1.5 badge-neutral">Diagnostic</span> : null}
                  </td>
                  <td className="text-muted">{TYPE_LABEL[a.type]}</td>
                  <td className="text-muted">{dateFmt.format(a.date)}</td>
                  <td>{a.maxMark}</td>
                  <td>{a._count.grades}</td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <QuizAnnouncement
                        message={buildQuizAnnouncement(
                          {
                            dateLabel: dateFmt.format(a.date),
                            timeLabel: friendlyTime(a.time),
                            topics: topicsFromNotes(a.topicNotes, a.topic?.title),
                          },
                          cfg.brandSignature,
                        )}
                      />
                      {user.role === "admin" && a._count.grades === 0 && (
                        <form action={deleteAssessment.bind(null, a.id)}>
                          <button type="submit" className="font-medium text-danger hover:underline">Delete</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </div>
  );
}
