"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClassAccess } from "@/lib/auth-guards";
import { paperOwnersFor, papersOf } from "@/lib/paper-owners";
import { logActivity } from "@/lib/activity";

// Assistant enters raw marks for the papers they own on this assessment (their sub-group,
// plus any they took over — lib/paper-owners). Percentage is derived.
// A blank mark = unreviewed (no row) so the entry stays incomplete until everyone has a mark.
export async function submitGrades(assessmentId: string, formData: FormData): Promise<void> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, classId: true, maxMark: true },
  });
  if (!assessment || assessment.maxMark == null) return; // max mark must be set first

  const user = await requireClassAccess(assessment.classId);
  if (!user.assistantId) return;

  const papers = await paperOwnersFor(assessmentId);
  const visibleIds = papers ? papersOf(papers.owners, user.assistantId) : [];
  const loggedById = user.assistantId;
  const now = new Date();
  const max = assessment.maxMark;

  const ops = [];
  for (const studentId of visibleIds) {
    // Not on the submitted form (papers moved to me after the page loaded) -> leave it alone.
    if (!formData.has(`mark_${studentId}`) && !formData.has(`absent_${studentId}`)) continue;
    const absent = formData.get(`absent_${studentId}`) === "on";
    const raw = String(formData.get(`mark_${studentId}`) ?? "").trim();

    // Absent: reviewed, no mark, excluded from averages.
    if (absent) {
      ops.push(
        prisma.assessmentGrade.upsert({
          where: { assessmentId_studentId: { assessmentId, studentId } },
          update: { absent: true, rawMark: null, percentage: null },
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
        // loggedAt + loggedById set once on create: edit-stable, and loggedById is the record
        // of who corrected the paper (lib/paper-owners).
        update: { absent: false, rawMark: mark, percentage },
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
