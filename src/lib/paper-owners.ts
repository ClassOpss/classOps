import { prisma } from "@/lib/db";
import { activeAt, joinCutoff } from "@/lib/roster";

// Who corrects each student's paper for one assessment. With 2 assistants a quiz is
// sometimes split by sub-group, sometimes taken whole by one assistant, sometimes split by
// who was there — so ownership is per assessment, per student:
//   graded   -> the assistant who entered it (AssessmentGrade.loggedById = the corrector)
//   claimed  -> the AssessmentCorrector row, while that assistant is still on the class
//   otherwise-> the student's sub-group assistant
// SHARED = the class has no sub-groups, so every assigned assistant owns it (as subGroupStudentIds).
// A student missing from the map (sub-groups exist but they're in none) is nobody's paper.
export const SHARED = "*";
export type PaperOwners = Map<string, string>;

export function resolvePaperOwners(input: {
  studentIds: string[];
  graded: Map<string, string>; // studentId -> loggedById
  claims: Map<string, string>; // studentId -> assistantId
  subGroups: Map<string, string>; // studentId -> assistantId (empty = no sub-groups)
  onClass: Set<string>; // assistants currently assigned to the class
}): PaperOwners {
  const owners: PaperOwners = new Map();
  for (const id of input.studentIds) {
    const graded = input.graded.get(id);
    const claim = input.claims.get(id);
    const owner =
      graded ??
      (claim && input.onClass.has(claim) ? claim : undefined) ??
      (input.subGroups.size === 0 ? SHARED : input.subGroups.get(id));
    if (owner) owners.set(id, owner);
  }
  return owners;
}

// The papers this assistant is answerable for (corrected by them, or still theirs to do).
export function papersOf(owners: PaperOwners, assistantId: string): string[] {
  return [...owners].filter(([, o]) => o === assistantId || o === SHARED).map(([id]) => id);
}

export type AssessmentPapers = { classId: string; owners: PaperOwners; graded: Set<string> };

// Batch loader (active roster, sub-groups + assignments as of `now`).
export async function loadPaperOwners(
  assessmentIds: string[],
  now: Date = new Date(),
): Promise<Map<string, AssessmentPapers>> {
  const out = new Map<string, AssessmentPapers>();
  if (assessmentIds.length === 0) return out;
  const assessments = await prisma.assessment.findMany({
    where: { id: { in: assessmentIds } },
    select: {
      id: true,
      classId: true,
      date: true,
      grades: { select: { studentId: true, loggedById: true } },
      correctors: { select: { studentId: true, assistantId: true } },
    },
  });
  const classIds = [...new Set(assessments.map((a) => a.classId))];
  const [students, subs, assignments] = await Promise.all([
    prisma.student.findMany({
      where: { classId: { in: classIds }, active: true },
      select: { id: true, classId: true, createdAt: true },
    }),
    prisma.studentAssistantAssignment.findMany({
      where: { classId: { in: classIds }, ...activeAt(now) },
      select: { classId: true, studentId: true, assistantId: true },
    }),
    prisma.classAssignment.findMany({
      where: { classId: { in: classIds }, ...activeAt(now) },
      select: { classId: true, assistantId: true },
    }),
  ]);

  for (const a of assessments) {
    const graded = new Map(a.grades.map((g) => [g.studentId, g.loggedById]));
    // Students who joined after the assessment owe no paper on it (a graded one still counts).
    const cutoff = joinCutoff(a.date);
    const studentIds = students
      .filter((s) => s.classId === a.classId && (s.createdAt < cutoff || graded.has(s.id)))
      .map((s) => s.id);
    out.set(a.id, {
      classId: a.classId,
      graded: new Set(graded.keys()),
      owners: resolvePaperOwners({
        studentIds,
        graded,
        claims: new Map(a.correctors.map((c) => [c.studentId, c.assistantId])),
        subGroups: new Map(subs.filter((s) => s.classId === a.classId).map((s) => [s.studentId, s.assistantId])),
        onClass: new Set(assignments.filter((x) => x.classId === a.classId).map((x) => x.assistantId)),
      }),
    });
  }
  return out;
}

export type PaperRow = {
  studentId: string;
  name: string;
  ownerId: string | null; // null = shared or nobody's
  shared: boolean; // class has no sub-groups: every assistant on it owns the paper
  ownerName: string;
  graded: boolean;
  claimed: boolean; // owner differs from the default because of a claim / admin move
};

// Display rows for one assessment's "who's correcting" view, plus the assistants on the class.
export async function paperRows(
  assessmentId: string,
): Promise<{ rows: PaperRow[]; assistants: { id: string; name: string }[] } | null> {
  const now = new Date();
  const papers = await paperOwnersFor(assessmentId, now);
  if (!papers) return null;
  const [students, claims, assignments] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: [...papers.owners.keys()] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.assessmentCorrector.findMany({ where: { assessmentId }, select: { studentId: true, assistantId: true } }),
    prisma.classAssignment.findMany({
      where: { classId: papers.classId, ...activeAt(now) },
      select: { assistant: { select: { id: true, name: true } } },
    }),
  ]);
  const ownerIds = [...new Set([...papers.owners.values()].filter((o) => o !== SHARED))];
  const names = new Map(
    (await prisma.assistant.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } })).map((a) => [a.id, a.name]),
  );
  const claimed = new Map(claims.map((c) => [c.studentId, c.assistantId]));
  const assistants = [...new Map(assignments.map((a) => [a.assistant.id, a.assistant])).values()];
  return {
    assistants,
    rows: students.map((s) => {
      const owner = papers.owners.get(s.id);
      const graded = papers.graded.has(s.id);
      return {
        studentId: s.id,
        name: s.name,
        ownerId: owner && owner !== SHARED ? owner : null,
        shared: owner === SHARED,
        ownerName: owner === SHARED ? "Shared" : owner ? (names.get(owner) ?? "Unknown") : "Unassigned",
        graded,
        claimed: !graded && claimed.get(s.id) === owner,
      };
    }),
  };
}

export async function paperOwnersFor(assessmentId: string, now: Date = new Date()): Promise<AssessmentPapers | null> {
  return (await loadPaperOwners([assessmentId], now)).get(assessmentId) ?? null;
}

// Papers already corrected by an assistant who has since LEFT the class (a replacement took
// over mid-term). The replacement may view AND edit those marks; the paper stays credited to
// the original corrector (loggedById is create-only), so fines/pay don't move. Limited to the
// viewer's own sub-group when the class has sub-groups.
export async function inheritedPaperIds(
  classId: string,
  assistantId: string,
  papers: { studentId: string; ownerId: string | null; graded: boolean }[],
  now: Date = new Date(),
): Promise<string[]> {
  const candidates = papers.filter((p) => p.graded && p.ownerId && p.ownerId !== SHARED && p.ownerId !== assistantId);
  if (candidates.length === 0) return [];
  const [assignments, subs] = await Promise.all([
    prisma.classAssignment.findMany({ where: { classId, ...activeAt(now) }, select: { assistantId: true } }),
    prisma.studentAssistantAssignment.findMany({
      where: { classId, ...activeAt(now) },
      select: { studentId: true, assistantId: true },
    }),
  ]);
  const onClass = new Set(assignments.map((a) => a.assistantId));
  if (!onClass.has(assistantId)) return [];
  const mine = new Set(subs.filter((s) => s.assistantId === assistantId).map((s) => s.studentId));
  return candidates
    .filter((p) => !onClass.has(p.ownerId!) && (subs.length === 0 || mine.has(p.studentId)))
    .map((p) => p.studentId);
}
