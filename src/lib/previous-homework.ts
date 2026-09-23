import { prisma } from "@/lib/db";

// "Previous homework" for a session = every homework (lesson or standalone) whose due
// date falls AFTER the class's previous taught session and ON/BEFORE this one — i.e. the
// work that came due since the last class. HW is usually due the day before the next
// class (e.g. set Tue, due Mon, checked at next Tue's class) but any due date works:
// a deadline that lands after the NEXT class is simply checked one class later.
// Day-offs are skipped, so the window stretches across them.
export async function previousHomework(classId: string, sessionDate: Date) {
  const prev = await prisma.classSession.findFirst({
    where: { classId, dayOff: false, scheduledDate: { lt: sessionDate } },
    orderBy: { scheduledDate: "desc" },
    select: { scheduledDate: true },
  });

  return prisma.homeworkAssignment.findMany({
    where: {
      classId,
      noHomework: false,
      deadline: { lte: sessionDate, ...(prev ? { gt: prev.scheduledDate } : {}) },
    },
    orderBy: { deadline: "asc" },
    select: { id: true, description: true, deadline: true },
  });
}

const shortDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

// Short human label for a homework: its description, else its due date.
export function homeworkLabel(hw: { description: string | null; deadline: Date }): string {
  return hw.description?.trim() || `due ${shortDate.format(hw.deadline)}`;
}

export function homeworkDueLabel(deadline: Date): string {
  return shortDate.format(deadline);
}
