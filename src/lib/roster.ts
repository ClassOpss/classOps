import { prisma } from "@/lib/db";
import { cairoDayWindow } from "@/lib/datetime";

// Active student-sub-group for an assistant in a class (spec 4.6): if the class has
// sub-assignments, this assistant's students; otherwise (single assistant) all of them.
// `joinedBefore` narrows to students added before that instant (see joinCutoff).
export async function subGroupStudentIds(
  classId: string,
  assistantId: string,
  now: Date = new Date(),
  joinedBefore?: Date,
): Promise<string[]> {
  const all = await prisma.student.findMany({
    where: { classId, active: true, ...joinedFilter(joinedBefore) },
    select: { id: true },
  });
  const allIds = all.map((s) => s.id);

  const subs = await prisma.studentAssistantAssignment.findMany({
    where: {
      classId,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    select: { studentId: true, assistantId: true },
  });
  if (subs.length === 0) return allIds;
  const mine = subs.filter((s) => s.assistantId === assistantId).map((s) => s.studentId);
  if (!joinedBefore) return mine;
  const joined = new Set(allIds);
  return mine.filter((id) => joined.has(id));
}

// Prisma where-fragment for assignments/sub-assignments active at `now`.
export function activeAt(now: Date) {
  return { startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] };
}

// A student added mid-year owes only work set after they joined, so finished corrections
// and grading stay finished. They count toward a HW / assessment only if added before the
// end of its Cairo day (the lesson day, or the assessment date).
export function joinCutoff(day: Date): Date {
  return cairoDayWindow(day.toISOString().slice(0, 10)).end;
}

// Session-linked HW was set on the lesson day; standalone HW when it was created.
export function hwJoinCutoff(hw: { createdAt: Date; session: { scheduledDate: Date } | null }): Date {
  return hw.session ? joinCutoff(hw.session.scheduledDate) : hw.createdAt;
}

export function joinedFilter(joinedBefore?: Date) {
  return joinedBefore ? { createdAt: { lt: joinedBefore } } : {};
}
