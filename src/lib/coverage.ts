import { prisma } from "@/lib/db";
import { loadVacations, isSchoolOnVacation } from "@/lib/vacations";

export type CoverageCandidate = {
  sessionId: string;
  classId: string;
  className: string;
  date: Date;
  ownerName: string;
  covererId: string;
  covererName: string;
};

// A session is a likely coverage when someone OTHER than its responsible assistant
// actually logged its daily tasks (and it hasn't been marked covered yet). The admin
// confirms these to apply the ±coverageAdjustment.
export async function detectCoverageCandidates(operationId: string): Promise<CoverageCandidate[]> {
  const [sessions, vacations] = await Promise.all([
    prisma.classSession.findMany({
      where: {
        dayOff: false,
        responsibleAssistantId: { not: null },
        coveredById: null,
        class: { operationId },
      },
      orderBy: { scheduledDate: "desc" },
      select: {
        id: true,
        scheduledDate: true,
        responsibleAssistantId: true,
        class: { select: { id: true, name: true, schoolId: true } },
        responsibleAssistant: { select: { name: true } },
        attendance: { select: { loggedById: true }, take: 1 },
        parentUpdate: { select: { assistantId: true } },
        classroomUpload: { select: { assistantId: true } },
      },
    }),
    loadVacations(operationId),
  ]);

  const out: Omit<CoverageCandidate, "covererName">[] = [];
  const covererIds = new Set<string>();
  for (const s of sessions) {
    // During the school's break nobody "owns" the session, so a non-owner logging a
    // task isn't coverage — don't flag it (keeps pay/scores clean).
    if (isSchoolOnVacation(s.class.schoolId, s.scheduledDate, vacations)) continue;
    const logger =
      s.attendance[0]?.loggedById ?? s.parentUpdate?.assistantId ?? s.classroomUpload?.assistantId ?? null;
    if (!logger || logger === s.responsibleAssistantId) continue;
    covererIds.add(logger);
    out.push({
      sessionId: s.id,
      classId: s.class.id,
      className: s.class.name,
      date: s.scheduledDate,
      ownerName: s.responsibleAssistant?.name ?? "—",
      covererId: logger,
    });
  }

  if (out.length === 0) return [];
  const names = new Map(
    (await prisma.assistant.findMany({ where: { id: { in: [...covererIds] } }, select: { id: true, name: true } }))
      .map((a) => [a.id, a.name]),
  );
  return out.map((c) => ({ ...c, covererName: names.get(c.covererId) ?? "—" }));
}
