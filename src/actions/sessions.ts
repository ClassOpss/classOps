"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { weeklySlotDates } from "@/lib/sessions";
import { layoutFutureDates, nextSlotAfter, isLocked } from "@/lib/session-timeline";
import { cairoToday } from "@/lib/datetime";
import { scheduleDays } from "@/lib/schedule";
import { assignResponsibilities } from "@/lib/responsibility";
import { activeAt } from "@/lib/roster";
import { currentOperationId } from "@/lib/operation";

export type FormState = { ok?: boolean; error?: string } | undefined;

// Active assistants assigned to a class, in a stable order (so day-ownership is deterministic).
async function classAssistantIds(classId: string, now: Date): Promise<string[]> {
  const assigns = await prisma.classAssignment.findMany({
    where: { classId, ...activeAt(now) },
    orderBy: [{ startDate: "asc" }, { assistant: { name: "asc" } }],
    select: { assistantId: true },
  });
  return [...new Set(assigns.map((a) => a.assistantId))];
}

// Recompute responsibleAssistantId for a class's sessions (e.g. after assistants change).
export async function reassignResponsibilities(classId: string): Promise<void> {
  const sessions = await prisma.classSession.findMany({
    where: { classId },
    orderBy: { scheduledDate: "asc" },
    select: { id: true, scheduledDate: true, dayOff: true },
  });
  const assistantIds = await classAssistantIds(classId, new Date());
  const owners = assignResponsibilities(sessions, assistantIds);
  await prisma.$transaction(
    sessions.map((s, i) =>
      prisma.classSession.update({ where: { id: s.id }, data: { responsibleAssistantId: owners[i] } }),
    ),
  );
}

// Materialize per-class ClassSessions from the year-group plan + the class schedule.
// Regenerates from scratch — refused once any attendance has been logged (so we never
// destroy real records).
export async function generateSessions(
  classId: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const user = await requireRole("admin", "teacher");
  const operationId = await currentOperationId();

  const klass = await prisma.class.findFirst({
    where: { id: classId, operationId },
    select: { id: true, operationId: true, yearGroup: true, schedule: true, planStartDate: true },
  });
  if (!klass) return { error: "Class not found." };
  if (!klass.planStartDate) return { error: "Set a plan start date on the class first." };

  const days = scheduleDays(klass.schedule as object);
  if (days.length === 0) return { error: "This class has no scheduled day(s)." };

  const plan = await prisma.lessonPlan.findUnique({
    where: { operationId_yearGroup: { operationId: klass.operationId, yearGroup: klass.yearGroup } },
    include: { items: { orderBy: { sequence: "asc" }, select: { id: true, topicId: true } } },
  });
  const items = plan?.items ?? [];
  if (items.length === 0) return { error: `Build the ${klass.yearGroup} lesson plan first.` };

  const logged = await prisma.attendance.count({ where: { session: { classId } } });
  if (logged > 0) {
    return { error: "Attendance has already been logged — sessions can no longer be regenerated." };
  }

  const dates = weeklySlotDates(klass.planStartDate, days, items.length);
  // Stamp who owns each session's daily tasks (by weekday for multi-day, else alternating).
  const assistantIds = await classAssistantIds(classId, new Date());
  const owners = assignResponsibilities(
    dates.map((d) => ({ scheduledDate: d, dayOff: false })),
    assistantIds,
  );

  await prisma.classSession.deleteMany({ where: { classId } });
  await prisma.classSession.createMany({
    data: items.map((item, i) => ({
      classId,
      planItemId: item.id,
      lessonNumber: i + 1,
      scheduledDate: dates[i],
      topicId: item.topicId,
      responsibleAssistantId: owners[i],
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

// ----------------------------------------------------------------------------
// Mid-term editing — never touches "delivered" sessions
// ----------------------------------------------------------------------------
// A session is LOCKED (delivered) once it's on/before today OR carries any logged
// record (attendance / parent update / classroom upload / homework). Locked sessions
// are the past; everything after is the freely-editable future. Editing only ever
// rewrites the future, so no attendance/grades can be lost — unlike "Regenerate",
// which wipes every session and is therefore blocked once anything is logged.
type LoadedSession = {
  id: string;
  planItemId: string | null;
  scheduledDate: Date;
  dayOff: boolean;
  locked: boolean;
};

async function loadSessionsWithLocks(classId: string): Promise<LoadedSession[]> {
  const rows = await prisma.classSession.findMany({
    where: { classId },
    orderBy: { scheduledDate: "asc" },
    select: {
      id: true,
      planItemId: true,
      scheduledDate: true,
      dayOff: true,
      _count: { select: { attendance: true } },
      parentUpdate: { select: { id: true } },
      classroomUpload: { select: { id: true } },
      homework: { select: { id: true } },
    },
  });
  const today = cairoToday();
  return rows.map((r) => {
    const hasData =
      r._count.attendance > 0 || !!r.parentUpdate || !!r.classroomUpload || !!r.homework;
    return {
      id: r.id,
      planItemId: r.planItemId,
      scheduledDate: r.scheduledDate,
      dayOff: r.dayOff,
      locked: isLocked({ scheduledDate: r.scheduledDate, hasData }, today),
    };
  });
}

// One future-session slot after laying out: either keep an existing row (new date) or
// create a fresh one. `pinnedDate` marks day-offs, whose real calendar date never moves.
type FutureEntry =
  | { keepId: string; pinnedDate: Date | null }
  | { create: { planItemId: string | null; topicId: string | null; notes: string | null } };

// The earliest free future slot to lay the future out from: the first undelivered
// session's date, or (when everything is delivered) the next meeting date after the last.
function firstFutureSlot(
  sessions: LoadedSession[],
  days: string[],
  planStartDate: Date | null,
): Date | undefined {
  const firstFuture = sessions.find((s) => !s.locked);
  if (firstFuture) return firstFuture.scheduledDate;
  const last = sessions[sessions.length - 1];
  if (last) return nextSlotAfter(last.scheduledDate, days);
  return planStartDate ? weeklySlotDates(planStartDate, days, 1)[0] : undefined;
}

// Assign dates to the ordered future entries and persist: delete replaced rows, re-date
// kept rows, create new rows, then renumber all sessions and re-stamp responsibilities.
async function persistFuture(
  classId: string,
  ordered: FutureEntry[],
  firstSlot: Date,
  days: string[],
  deleteIds: string[],
): Promise<void> {
  const dates = layoutFutureDates(
    ordered.map((e) => ({ pinnedDate: "keepId" in e ? e.pinnedDate : null })),
    firstSlot,
    days,
  );

  const ops = [];
  if (deleteIds.length > 0) {
    ops.push(prisma.classSession.deleteMany({ where: { id: { in: deleteIds } } }));
  }
  ordered.forEach((e, i) => {
    if ("keepId" in e) {
      ops.push(prisma.classSession.update({ where: { id: e.keepId }, data: { scheduledDate: dates[i] } }));
    } else {
      ops.push(
        prisma.classSession.create({
          data: {
            classId,
            planItemId: e.create.planItemId,
            topicId: e.create.topicId,
            notes: e.create.notes,
            scheduledDate: dates[i],
            lessonNumber: 0, // renumbered below
          },
        }),
      );
    }
  });
  await prisma.$transaction(ops);

  // Renumber stored lessonNumber to match date order (display recomputes anyway, but keep it tidy).
  const all = await prisma.classSession.findMany({
    where: { classId },
    orderBy: { scheduledDate: "asc" },
    select: { id: true },
  });
  await prisma.$transaction(
    all.map((s, i) => prisma.classSession.update({ where: { id: s.id }, data: { lessonNumber: i + 1 } })),
  );

  await reassignResponsibilities(classId);
}

async function loadClassForEdit(classId: string, operationId: string) {
  return prisma.class.findFirst({
    where: { id: classId, operationId },
    select: { id: true, yearGroup: true, schedule: true, planStartDate: true },
  });
}

// Feature A — add a lesson to THIS class only (e.g. it's behind, or a topic needs more
// time). Inserts an ad-hoc session (planItemId = null, so it can never appear in another
// class) and pushes every following future session back one slot. Delivered sessions are
// untouched. `position` is the id of an upcoming session to insert before, or "end".
export async function addClassLesson(
  classId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRole("admin", "teacher");
  const operationId = await currentOperationId();
  const klass = await loadClassForEdit(classId, operationId);
  if (!klass) return { error: "Class not found." };

  const days = scheduleDays(klass.schedule as object);
  if (days.length === 0) return { error: "This class has no scheduled day(s)." };

  const topicId = String(formData.get("topicId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const position = String(formData.get("position") ?? "end").trim();
  if (!topicId) return { error: "Pick a topic for the lesson." };

  const topic = await prisma.topic.findFirst({
    where: { id: topicId, operationId, yearGroup: klass.yearGroup },
    select: { id: true },
  });
  if (!topic) return { error: "That topic isn't in this class's year group." };

  const sessions = await loadSessionsWithLocks(classId);
  const future = sessions.filter((s) => !s.locked);

  const ordered: FutureEntry[] = future.map((s) => ({
    keepId: s.id,
    pinnedDate: s.dayOff ? s.scheduledDate : null,
  }));
  const newEntry: FutureEntry = { create: { planItemId: null, topicId, notes } };

  if (position === "end") {
    ordered.push(newEntry);
  } else {
    const idx = future.findIndex((s) => s.id === position);
    if (idx === -1) return { error: "Choose a valid upcoming lesson to insert before." };
    ordered.splice(idx, 0, newEntry);
  }

  const firstSlot = firstFutureSlot(sessions, days, klass.planStartDate);
  if (!firstSlot) return { error: "Set a plan start date on the class first." };

  await persistFuture(classId, ordered, firstSlot, days, []);
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "added_class_lesson",
    entityType: "class",
    entityId: classId,
    classId,
    metadata: { topicId, position },
  });
  revalidatePath(`/classes/${classId}/sessions`);
  return { ok: true };
}

// Remove an ad-hoc (class-specific) upcoming lesson and pull the rest forward. Only
// allowed on undelivered ad-hoc sessions — plan sessions and anything logged are safe.
export async function removeClassLesson(sessionId: string): Promise<void> {
  const user = await requireRole("admin", "teacher");
  const operationId = await currentOperationId();
  const target = await prisma.classSession.findFirst({
    where: { id: sessionId, class: { operationId } },
    select: { classId: true },
  });
  if (!target) return;

  const klass = await loadClassForEdit(target.classId, operationId);
  if (!klass) return;
  const days = scheduleDays(klass.schedule as object);

  const sessions = await loadSessionsWithLocks(target.classId);
  const self = sessions.find((s) => s.id === sessionId);
  // Guard: must be an undelivered, class-specific (ad-hoc) lesson.
  if (!self || self.locked || self.planItemId !== null) return;

  const ordered: FutureEntry[] = sessions
    .filter((s) => !s.locked && s.id !== sessionId)
    .map((s) => ({ keepId: s.id, pinnedDate: s.dayOff ? s.scheduledDate : null }));

  const firstSlot = firstFutureSlot(sessions, days, klass.planStartDate);
  if (!firstSlot) return;

  await persistFuture(target.classId, ordered, firstSlot, days, [sessionId]);
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "removed_class_lesson",
    entityType: "session",
    entityId: sessionId,
    classId: target.classId,
  });
  revalidatePath(`/classes/${target.classId}/sessions`);
}

// Feature B — re-sync the future from the (edited) year-group plan, mid-term-safe.
// Keeps every delivered session, day-off, and class-specific lesson; only the plan-derived
// upcoming sessions are rebuilt from the plan tail beyond what's already been delivered.
// This is the safe replacement for "Regenerate" once a class is live — a syllabus change
// flows into each class from its own current point without destroying logged data.
export async function updateFutureFromPlan(
  classId: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const user = await requireRole("admin", "teacher");
  const operationId = await currentOperationId();
  const klass = await loadClassForEdit(classId, operationId);
  if (!klass) return { error: "Class not found." };

  const days = scheduleDays(klass.schedule as object);
  if (days.length === 0) return { error: "This class has no scheduled day(s)." };

  const plan = await prisma.lessonPlan.findUnique({
    where: { operationId_yearGroup: { operationId, yearGroup: klass.yearGroup } },
    include: { items: { orderBy: { sequence: "asc" }, select: { id: true, topicId: true } } },
  });
  const items = plan?.items ?? [];
  if (items.length === 0) return { error: `Build the ${klass.yearGroup} lesson plan first.` };

  const sessions = await loadSessionsWithLocks(classId);
  if (sessions.length === 0) return { error: "Generate sessions first, then updates apply to the future." };

  const locked = sessions.filter((s) => s.locked);
  const future = sessions.filter((s) => !s.locked);

  // How many plan lessons are already delivered — continue the plan from there.
  const deliveredPlanCount = locked.filter((s) => s.planItemId !== null).length;
  const planTail = items.slice(deliveredPlanCount);

  const tailQueue = [...planTail];
  const ordered: FutureEntry[] = [];
  const deleteIds: string[] = [];

  for (const s of future) {
    const isAdhoc = s.planItemId === null;
    if (s.dayOff || isAdhoc) {
      // Preserve day-offs (pinned to their date) and class-specific lessons.
      ordered.push({ keepId: s.id, pinnedDate: s.dayOff ? s.scheduledDate : null });
    } else {
      // Plan-derived upcoming session -> replace with the next plan-tail item (or drop if the plan shrank).
      deleteIds.push(s.id);
      const next = tailQueue.shift();
      if (next) ordered.push({ create: { planItemId: next.id, topicId: next.topicId, notes: null } });
    }
  }
  // Any plan lessons the future didn't have room for -> append at the end.
  for (const item of tailQueue) {
    ordered.push({ create: { planItemId: item.id, topicId: item.topicId, notes: null } });
  }

  if (ordered.length === 0 && deleteIds.length === 0) return { ok: true };

  const firstSlot = firstFutureSlot(sessions, days, klass.planStartDate);
  if (!firstSlot) return { error: "Set a plan start date on the class first." };

  await persistFuture(classId, ordered, firstSlot, days, deleteIds);
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "updated_future_from_plan",
    entityType: "class",
    entityId: classId,
    classId,
    metadata: { rebuilt: ordered.filter((e) => "create" in e).length, removed: deleteIds.length },
  });
  revalidatePath(`/classes/${classId}/sessions`);
  return { ok: true };
}
