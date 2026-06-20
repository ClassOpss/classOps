import { prisma } from "@/lib/db";

// Active student-sub-group for an assistant in a class (spec 4.6): if the class has
// sub-assignments, this assistant's students; otherwise (single assistant) all of them.
export async function subGroupStudentIds(
  classId: string,
  assistantId: string,
  now: Date = new Date(),
): Promise<string[]> {
  const all = await prisma.student.findMany({
    where: { classId, active: true },
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
  return subs.filter((s) => s.assistantId === assistantId).map((s) => s.studentId);
}

// Prisma where-fragment for assignments/sub-assignments active at `now`.
export function activeAt(now: Date) {
  return { startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] };
}
