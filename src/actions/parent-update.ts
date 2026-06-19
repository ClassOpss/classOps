"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClassAccess } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { sessionStart } from "@/lib/datetime";

// Record that the assistant sent the class-update message (spec 5.5). sent_at drives the
// 9pm lateness check (shown in the UI; the incident record itself lands in the cron step).
export async function markParentUpdateSent(sessionId: string): Promise<void> {
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

  const sched = (session.class.schedule ?? {}) as { time?: string };
  if (new Date() < sessionStart(session.scheduledDate, sched.time)) return;

  await prisma.parentUpdateLog.upsert({
    where: { sessionId },
    update: { sentAt: new Date(), assistantId: user.assistantId },
    create: { sessionId, assistantId: user.assistantId, sentAt: new Date() },
  });

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "marked_parent_update",
    entityType: "session",
    entityId: sessionId,
    classId: session.classId,
  });

  revalidatePath(`/my/classes/${session.classId}/parent-update/${sessionId}`);
  revalidatePath(`/my/classes/${session.classId}`);
}
