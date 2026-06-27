"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClassAccess } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { sessionStart } from "@/lib/datetime";
import { scheduleTimeForDate } from "@/lib/schedule";

// Spec 5.6: assistant marks the session's materials as uploaded to Google Classroom.
// uploaded_at drives the 9pm lateness check (incident record lands in the cron step).
export async function markClassroomUploaded(sessionId: string, formData: FormData): Promise<void> {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      classId: true,
      dayOff: true,
      scheduledDate: true,
      class: { select: { schedule: true } },
    },
  });
  if (!session) return;

  const user = await requireClassAccess(session.classId);
  if (!user.assistantId) return;
  if (session.dayOff) return;

  const time = scheduleTimeForDate(session.class.schedule as object, session.scheduledDate);
  if (new Date() < sessionStart(session.scheduledDate, time)) return;

  const notes = String(formData.get("notes") ?? "").trim() || null;

  await prisma.classroomUploadLog.upsert({
    where: { sessionId },
    update: { uploadedAt: new Date(), assistantId: user.assistantId, notes },
    create: { sessionId, assistantId: user.assistantId, uploadedAt: new Date(), notes },
  });

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "marked_classroom_upload",
    entityType: "session",
    entityId: sessionId,
    classId: session.classId,
  });

  revalidatePath(`/my/classes/${session.classId}/attendance/${sessionId}`);
  revalidatePath(`/my/classes/${session.classId}`);
}
