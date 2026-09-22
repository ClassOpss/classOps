import { prisma } from "@/lib/db";
import { quizNumber } from "@/lib/quiz";

// Once a biweekly quiz is confirmed (announcement sent, or quiz created) it gets a linked
// Assessment so grade entry is ready — only the max mark is left to fill in. Idempotent:
// reuses the linked one, or adopts a quiz someone already created by hand for that class
// + date. Returns true when it created or linked something.
export async function ensureQuizAssessment(
  classId: string,
  scheduledDate: Date,
  quizStartDate: Date,
): Promise<boolean> {
  const row = await prisma.quizPrep.findUnique({
    where: { classId_scheduledDate: { classId, scheduledDate } },
    select: { id: true, quizDate: true, coverage: true, assessmentId: true },
  });
  if (!row || row.assessmentId) return false;

  const manual = await prisma.assessment.findFirst({
    where: { classId, type: "quiz", date: row.quizDate, quizPrep: { is: null } },
    select: { id: true },
  });
  const assessmentId =
    manual?.id ??
    (
      await prisma.assessment.create({
        data: {
          classId,
          type: "quiz",
          label: `Quiz ${quizNumber(quizStartDate, scheduledDate)}`,
          topicNotes: row.coverage,
          date: row.quizDate,
          maxMark: null,
          isDiagnostic: false,
        },
        select: { id: true },
      })
    ).id;

  await prisma.quizPrep.update({ where: { id: row.id }, data: { assessmentId } });
  return true;
}
