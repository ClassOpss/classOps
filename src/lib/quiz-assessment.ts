import { prisma } from "@/lib/db";
import { isQuizDate, quizNumber } from "@/lib/quiz";

// Once a biweekly quiz is confirmed (announcement sent, or quiz created) it gets a linked
// Assessment so grade entry is ready — only the max mark is left to fill in. Idempotent:
// reuses the linked one, or adopts a quiz someone already created by hand for that class
// + date. Returns true when it created or linked something.
export async function ensureQuizAssessment(
  classId: string,
  scheduledDate: Date,
  quizStartDate: Date | null,
): Promise<boolean> {
  if (!quizStartDate) return false; // ad-hoc cycles are born with their assessment
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

// Every hand-added assessment gets the quiz tasks (announcement + prep). It joins an open
// quiz cycle already on that day (cadence or moved), else claims its cadence slot, else
// gets its own ad-hoc cycle. A day that already has a cycle with another assessment keeps
// that one set of tasks — no duplicates.
export async function attachQuizTasks(a: {
  id: string;
  classId: string;
  date: Date;
  topicNotes: string | null;
}): Promise<void> {
  const open = await prisma.quizPrep.findFirst({
    where: { classId: a.classId, quizDate: a.date, assessmentId: null },
    select: { id: true, coverage: true },
  });
  if (open) {
    await prisma.quizPrep.update({
      where: { id: open.id },
      data: { assessmentId: a.id, coverage: open.coverage ?? a.topicNotes },
    });
    return;
  }

  const klass = await prisma.class.findUnique({ where: { id: a.classId }, select: { quizStartDate: true } });
  const onCadence = !!klass?.quizStartDate && isQuizDate(klass.quizStartDate, a.date);
  await prisma.quizPrep.createMany({
    data: [
      {
        classId: a.classId,
        scheduledDate: a.date,
        quizDate: a.date,
        coverage: a.topicNotes,
        assessmentId: a.id,
        adHoc: !onCadence,
      },
    ],
    skipDuplicates: true,
  });
}
