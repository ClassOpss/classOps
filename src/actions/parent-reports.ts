"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClassAccess } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";

// Record that a student's monthly PDF report went to the parent (called by the
// "Report → parent" button once the share / chat hand-off happens). sentAt is set on the
// FIRST send only, so re-sending later never makes an on-time task look late.
export async function logParentReportSent(
  studentId: string,
  year: number,
  month: number,
): Promise<{ ok: true; sentAt: string } | { ok: false; error: string }> {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12)
    return { ok: false, error: "Invalid month." };
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true } });
  if (!student) return { ok: false, error: "Student not found." };
  const user = await requireClassAccess(student.classId);

  const log = await prisma.parentReportLog.upsert({
    where: { studentId_year_month: { studentId, year, month } },
    update: {},
    create: { studentId, year, month, sentById: user.assistantId ?? null },
    select: { sentAt: true },
  });

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "sent_parent_report",
    entityType: "student",
    entityId: studentId,
    classId: student.classId,
    metadata: { year, month },
  });
  revalidatePath(`/classes/${student.classId}/parent-reports`);
  revalidatePath(`/my/classes/${student.classId}/parent-reports`);
  revalidatePath("/my/tasks");
  return { ok: true, sentAt: log.sentAt.toISOString() };
}
