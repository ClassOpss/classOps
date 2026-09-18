"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClassAccess, getVisibleStudentIds } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { hwStatus } from "@/lib/homework";

// Assistant edits a homework's due date after it's been set. Recomputes the stored
// status of already-submitted rows so on-time/late badges stay consistent with the
// new deadline; "missing" rows are left as-is. Correction lateness is unaffected —
// it's judged on the assistant's first-entry loggedAt, not the deadline.
export async function updateHomeworkDeadline(
  homeworkId: string,
  formData: FormData,
): Promise<void> {
  const homework = await prisma.homeworkAssignment.findUnique({
    where: { id: homeworkId },
    select: { id: true, classId: true, noHomework: true },
  });
  if (!homework || homework.noHomework) return;

  const user = await requireClassAccess(homework.classId);

  const dateStr = String(formData.get("deadline") ?? "").trim();
  if (!dateStr) return;
  const deadline = new Date(dateStr);
  if (Number.isNaN(deadline.getTime())) return;

  const now = new Date();
  const submitted = await prisma.homeworkSubmission.findMany({
    where: { homeworkId, submissionDate: { not: null } },
    select: { id: true, submissionDate: true },
  });

  await prisma.$transaction([
    prisma.homeworkAssignment.update({ where: { id: homeworkId }, data: { deadline } }),
    ...submitted.map((s) =>
      prisma.homeworkSubmission.update({
        where: { id: s.id },
        data: { status: hwStatus(s.submissionDate, deadline, now) ?? "on_time" },
      }),
    ),
  ]);

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "updated_hw_deadline",
    entityType: "homework_assignment",
    entityId: homeworkId,
    classId: homework.classId,
  });

  revalidatePath(`/my/classes/${homework.classId}/homework/${homeworkId}`);
  revalidatePath(`/my/classes/${homework.classId}/homework`);
}

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
    const state = String(formData.get(`state_${studentId}`) ?? ""); // submitted | not_submitted | ""
    const weak = String(formData.get(`weak_${studentId}`) ?? "").trim() || null;

    if (state !== "submitted" && state !== "not_submitted") {
      // Unreviewed: no row exists -> the correction stays incomplete.
      ops.push(prisma.homeworkSubmission.deleteMany({ where: { homeworkId, studentId } }));
      continue;
    }

    let submissionDate: Date | null = null;
    let status: "on_time" | "late" | "missing";
    if (state === "submitted") {
      const dateStr = String(formData.get(`date_${studentId}`) ?? "").trim();
      submissionDate = dateStr ? new Date(dateStr) : homework.deadline; // default to the due date
      // date is always set here, so hwStatus resolves to on_time | late
      status = hwStatus(submissionDate, homework.deadline, now) ?? "on_time";
    } else {
      status = "missing"; // explicitly reviewed as not submitted
    }

    ops.push(
      prisma.homeworkSubmission.upsert({
        where: { homeworkId_studentId: { homeworkId, studentId } },
        // loggedAt is set once (on create) and never bumped on edit — editing later to
        // record a student's OWN late submission doesn't make the assistant look late.
        update: { submissionDate, status, weakPoints: weak, loggedById },
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
