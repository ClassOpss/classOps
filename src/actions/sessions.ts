"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { generateSessionDates } from "@/lib/sessions";

export type FormState = { ok?: boolean; error?: string } | undefined;

type Schedule = { day?: string; time?: string };

// Materialize per-class ClassSessions from the year-group plan + the class schedule.
// Regenerates from scratch — refused once any attendance has been logged (so we never
// destroy real records).
export async function generateSessions(
  classId: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const user = await requireRole("admin", "teacher");

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, yearGroup: true, schedule: true, planStartDate: true },
  });
  if (!klass) return { error: "Class not found." };
  if (!klass.planStartDate) return { error: "Set a plan start date on the class first." };

  const sched = (klass.schedule ?? {}) as Schedule;
  if (!sched.day) return { error: "This class has no scheduled day." };

  const plan = await prisma.lessonPlan.findUnique({
    where: { yearGroup: klass.yearGroup },
    include: { items: { orderBy: { sequence: "asc" }, select: { id: true, topicId: true } } },
  });
  const items = plan?.items ?? [];
  if (items.length === 0) return { error: `Build the ${klass.yearGroup} lesson plan first.` };

  const logged = await prisma.attendance.count({ where: { session: { classId } } });
  if (logged > 0) {
    return { error: "Attendance has already been logged — sessions can no longer be regenerated." };
  }

  const dates = generateSessionDates(klass.planStartDate, sched.day, items.length);

  await prisma.classSession.deleteMany({ where: { classId } });
  await prisma.classSession.createMany({
    data: items.map((item, i) => ({
      classId,
      planItemId: item.id,
      lessonNumber: i + 1,
      scheduledDate: dates[i],
      topicId: item.topicId,
    })),
  });

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "generated_sessions",
    entityType: "class",
    entityId: classId,
    classId,
    metadata: { count: items.length },
  });
  revalidatePath(`/classes/${classId}/sessions`);
  return { ok: true };
}

// Day-off is admin-only (spec 5.2). Marking/clearing only flips a flag — the lesson
// renumbering is computed on read, never written.
export async function markDayOff(sessionId: string, formData: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const s = await prisma.classSession.update({
    where: { id: sessionId },
    data: { dayOff: true, cancellationReason: reason },
    select: { classId: true },
  });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "marked_day_off",
    entityType: "session",
    entityId: sessionId,
    classId: s.classId,
  });
  revalidatePath(`/classes/${s.classId}/sessions`);
}

export async function clearDayOff(sessionId: string): Promise<void> {
  const admin = await requireRole("admin");
  const s = await prisma.classSession.update({
    where: { id: sessionId },
    data: { dayOff: false, cancellationReason: null },
    select: { classId: true },
  });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "cleared_day_off",
    entityType: "session",
    entityId: sessionId,
    classId: s.classId,
  });
  revalidatePath(`/classes/${s.classId}/sessions`);
}
