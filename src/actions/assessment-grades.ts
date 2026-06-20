"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClassAccess, getVisibleStudentIds } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";

// Assistant enters raw marks for their sub-group (spec 5.8). Percentage is derived.
// A blank mark = unreviewed (no row) so the entry stays incomplete until everyone has a mark.
export async function submitGrades(assessmentId: string, formData: FormData): Promise<void> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, classId: true, maxMark: true },
  });
  if (!assessment) return;

  const user = await requireClassAccess(assessment.classId);
  if (!user.assistantId) return;

  const visibleIds = await getVisibleStudentIds(assessment.classId, user);
  const loggedById = user.assistantId;
  const now = new Date();
  const max = assessment.maxMark;

  const ops = [];
  for (const studentId of visibleIds) {
    const absent = formData.get(`absent_${studentId}`) === "on";
    const raw = String(formData.get(`mark_${studentId}`) ?? "").trim();

    // Absent: reviewed, no mark, excluded from averages.
    if (absent) {
      ops.push(
        prisma.assessmentGrade.upsert({
          where: { assessmentId_studentId: { assessmentId, studentId } },
          update: { absent: true, rawMark: null, percentage: null, loggedById },
          create: { assessmentId, studentId, absent: true, rawMark: null, percentage: null, loggedById, loggedAt: now },
        }),
      );
      continue;
    }

    if (raw === "" || Number.isNaN(Number(raw))) {
      ops.push(prisma.assessmentGrade.deleteMany({ where: { assessmentId, studentId } })); // unreviewed
      continue;
    }

    const mark = Math.min(max, Math.max(0, Number(raw)));
    const percentage = Math.round((mark / max) * 10000) / 100;
    ops.push(
      prisma.assessmentGrade.upsert({
        where: { assessmentId_studentId: { assessmentId, studentId } },
        // loggedAt set once on create (edit-stable, like homework).
        update: { absent: false, rawMark: mark, percentage, loggedById },
        create: { assessmentId, studentId, absent: false, rawMark: mark, percentage, loggedById, loggedAt: now },
      }),
    );
  }

  await prisma.$transaction(ops);

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "submitted_grades",
    entityType: "assessment",
    entityId: assessmentId,
    classId: assessment.classId,
  });

  revalidatePath(`/my/classes/${assessment.classId}/assessments/${assessmentId}`);
  revalidatePath(`/my/classes/${assessment.classId}/assessments`);
}
