"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClassAccess, getVisibleStudentIds } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { hwStatus } from "@/lib/homework";

// Assistant logs HW submission data for their sub-group (spec 5.7). Status is auto-computed;
// "pending" rows (not submitted, deadline not passed, no notes) are skipped.
export async function submitHomeworkSubmissions(
  homeworkId: string,
  formData: FormData,
): Promise<void> {
  const homework = await prisma.homeworkAssignment.findUnique({
    where: { id: homeworkId },
    select: { id: true, classId: true, deadline: true, noHomework: true },
  });
  if (!homework || homework.noHomework) return;

  const user = await requireClassAccess(homework.classId);
  if (!user.assistantId) return;

  const visibleIds = new Set(await getVisibleStudentIds(homework.classId, user));
  const loggedById = user.assistantId;
  const now = new Date();

  const ops = [];
  for (const studentId of visibleIds) {
    const dateStr = String(formData.get(`date_${studentId}`) ?? "").trim();
    const weak = String(formData.get(`weak_${studentId}`) ?? "").trim() || null;
    const submissionDate = dateStr ? new Date(dateStr) : null;
    const status = hwStatus(submissionDate, homework.deadline, now);

    if (status === null) {
      // Pending: clear any stale row, otherwise nothing to store.
      ops.push(
        prisma.homeworkSubmission.deleteMany({ where: { homeworkId, studentId } }),
      );
      continue;
    }

    ops.push(
      prisma.homeworkSubmission.upsert({
        where: { homeworkId_studentId: { homeworkId, studentId } },
        update: { submissionDate, status, weakPoints: weak, loggedById, loggedAt: now },
        create: { homeworkId, studentId, submissionDate, status, weakPoints: weak, loggedById, loggedAt: now },
      }),
    );
  }

  await prisma.$transaction(ops);

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "submitted_hw_data",
    entityType: "homework_assignment",
    entityId: homeworkId,
    classId: homework.classId,
  });

  revalidatePath(`/my/classes/${homework.classId}/homework/${homeworkId}`);
  revalidatePath(`/my/classes/${homework.classId}/homework`);
}
