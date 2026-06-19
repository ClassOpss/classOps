"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClassAccess } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";

export type FormState = { ok?: boolean; error?: string } | undefined;

// Default HW deadline = the next session's date (spec 4.9), else this session + 7 days.
async function defaultDeadline(classId: string, after: Date): Promise<Date> {
  const next = await prisma.classSession.findFirst({
    where: { classId, dayOff: false, scheduledDate: { gt: after } },
    orderBy: { scheduledDate: "asc" },
    select: { scheduledDate: true },
  });
  if (next) return next.scheduledDate;
  const d = new Date(after);
  d.setUTCDate(d.getUTCDate() + 7);
  return d;
}

// Capture what was covered + homework + a notes/announcement line on a session.
// These feed the parent-update message and are omitted when blank.
export async function saveLessonDetails(
  sessionId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: { id: true, classId: true, scheduledDate: true },
  });
  if (!session) return { error: "Session not found." };

  const user = await requireClassAccess(session.classId);

  const topicId = String(formData.get("topicId") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const noHomework = formData.get("noHomework") === "on";
  const description = String(formData.get("homework") ?? "").trim();
  const deadlineStr = String(formData.get("homeworkDeadline") ?? "").trim();

  await prisma.classSession.update({
    where: { id: sessionId },
    data: { topicId, messageNotes: notes },
  });

  if (noHomework) {
    const deadline = await defaultDeadline(session.classId, session.scheduledDate);
    await prisma.homeworkAssignment.upsert({
      where: { sessionId },
      update: { noHomework: true, description: null, deadline },
      create: { sessionId, classId: session.classId, noHomework: true, description: null, deadline },
    });
  } else if (description) {
    const deadline = deadlineStr
      ? new Date(deadlineStr)
      : await defaultDeadline(session.classId, session.scheduledDate);
    await prisma.homeworkAssignment.upsert({
      where: { sessionId },
      update: { noHomework: false, description, deadline },
      create: { sessionId, classId: session.classId, noHomework: false, description, deadline },
    });
  } else {
    // Nothing entered — clear any existing assignment.
    await prisma.homeworkAssignment.deleteMany({ where: { sessionId } });
  }

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "saved_lesson_details",
    entityType: "session",
    entityId: sessionId,
    classId: session.classId,
  });

  revalidatePath(`/my/classes/${session.classId}/attendance/${sessionId}`);
  revalidatePath(`/my/classes/${session.classId}/parent-update/${sessionId}`);
  return { ok: true };
}
