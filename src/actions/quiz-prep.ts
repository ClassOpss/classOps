"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClassAccess } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { ymdUtc } from "@/lib/datetime";
import { isQuizDate } from "@/lib/quiz";

// Save the two prep steps (create quiz / send to print) for one class's biweekly quiz
// cycle. The task is SHARED — any assigned assistant may tick either box. Step timestamps
// and completedAt are stamped once (first time each becomes true) and never moved, so
// lateness is judged on the first completion (edit-stable, like HW corrections).
export async function saveQuizPrep(
  classId: string,
  quizDateStr: string,
  formData: FormData,
): Promise<void> {
  const user = await requireClassAccess(classId);
  if (!user.assistantId) return;

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { quizStartDate: true },
  });
  if (!klass?.quizStartDate) return;

  // Only accept a date that is genuinely one of this class's biweekly quiz dates.
  const quizDate = ymdUtc(quizDateStr);
  if (Number.isNaN(quizDate.getTime()) || !isQuizDate(klass.quizStartDate, quizDate)) return;

  const quizCreated = formData.get("quizCreated") === "on";
  const sentToPrint = formData.get("sentToPrint") === "on";

  const existing = await prisma.quizPrep.findUnique({
    where: { classId_quizDate: { classId, quizDate } },
    select: { quizCreatedAt: true, sentToPrintAt: true, completedAt: true },
  });

  const now = new Date();
  // Stamp each step-time the first time it flips on; keep it once set.
  const quizCreatedAt = quizCreated ? existing?.quizCreatedAt ?? now : existing?.quizCreatedAt ?? null;
  const sentToPrintAt = sentToPrint ? existing?.sentToPrintAt ?? now : existing?.sentToPrintAt ?? null;
  const bothDone = quizCreated && sentToPrint;
  const completedAt = bothDone ? existing?.completedAt ?? now : existing?.completedAt ?? null;

  await prisma.quizPrep.upsert({
    where: { classId_quizDate: { classId, quizDate } },
    update: { quizCreated, sentToPrint, quizCreatedAt, sentToPrintAt, completedAt, loggedById: user.assistantId },
    create: {
      classId,
      quizDate,
      quizCreated,
      sentToPrint,
      quizCreatedAt,
      sentToPrintAt,
      completedAt,
      loggedById: user.assistantId,
    },
  });

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "saved_quiz_prep",
    entityType: "class",
    entityId: classId,
    classId,
    metadata: { quizDate: quizDateStr, quizCreated, sentToPrint },
  });

  revalidatePath(`/my/classes/${classId}/quiz-prep`);
  revalidatePath(`/my/classes/${classId}`);
  revalidatePath("/my/tasks");
}
