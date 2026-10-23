"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClassAccess, requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { assertClassInOperation } from "@/lib/operation";
import { paperOwnersFor } from "@/lib/paper-owners";

function revalidate(classId: string, assessmentId: string) {
  revalidatePath(`/my/classes/${classId}/assessments/${assessmentId}`);
  revalidatePath(`/my/classes/${classId}/assessments`);
  revalidatePath(`/my/tasks`);
  revalidatePath(`/classes/${classId}/assessments`);
  revalidatePath(`/classes/${classId}/assessments/${assessmentId}/correctors`);
}

// An assistant takes over ungraded papers for ONE assessment ("I'm correcting the whole
// class" / "I'll do the ones who sat with me"). Claims only ever move work TO the caller,
// never away from them, so nobody can push a paper (or its late fine) onto a colleague.
// Form: `student` (repeated) = the papers to take.
export async function claimPapers(assessmentId: string, formData: FormData): Promise<void> {
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId }, select: { classId: true } });
  if (!assessment) return;
  const user = await requireClassAccess(assessment.classId);
  if (!user.assistantId) return;
  const me = user.assistantId;

  const papers = await paperOwnersFor(assessmentId);
  if (!papers) return;
  const wanted = new Set(formData.getAll("student").map(String));
  const ids = [...papers.owners.keys()].filter(
    (id) => wanted.has(id) && !papers.graded.has(id) && papers.owners.get(id) !== me,
  );
  if (ids.length === 0) return;

  await prisma.$transaction(
    ids.map((studentId) =>
      prisma.assessmentCorrector.upsert({
        where: { assessmentId_studentId: { assessmentId, studentId } },
        update: { assistantId: me, setById: me, setAt: new Date() },
        create: { assessmentId, studentId, assistantId: me, setById: me },
      }),
    ),
  );
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "claimed_papers",
    entityType: "assessment",
    entityId: assessmentId,
    classId: assessment.classId,
    metadata: { studentIds: ids },
  });
  revalidate(assessment.classId, assessmentId);
}

// Admin sets who corrects each ungraded paper. Form: `owner_<studentId>` = an assistant on
// the class, or "" for the default (their sub-group assistant). Graded papers keep their
// corrector — that's the record of who actually did the work.
export async function setPaperOwners(assessmentId: string, formData: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId }, select: { classId: true } });
  if (!assessment) return;
  await assertClassInOperation(assessment.classId);

  const papers = await paperOwnersFor(assessmentId);
  if (!papers) return;
  const onClass = new Set(
    (
      await prisma.classAssignment.findMany({
        where: { classId: assessment.classId, OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
        select: { assistantId: true },
      })
    ).map((a) => a.assistantId),
  );

  const claims = new Map(
    (await prisma.assessmentCorrector.findMany({ where: { assessmentId }, select: { studentId: true, assistantId: true } }))
      .map((c) => [c.studentId, c.assistantId]),
  );

  const ops = [];
  const changed: Record<string, string> = {};
  for (const studentId of papers.owners.keys()) {
    if (papers.graded.has(studentId)) continue;
    const raw = formData.get(`owner_${studentId}`);
    if (raw === null) continue;
    const owner = String(raw);
    if (owner === (claims.get(studentId) ?? "")) continue; // unchanged
    if (owner === "") {
      ops.push(prisma.assessmentCorrector.deleteMany({ where: { assessmentId, studentId } }));
    } else if (onClass.has(owner)) {
      ops.push(
        prisma.assessmentCorrector.upsert({
          where: { assessmentId_studentId: { assessmentId, studentId } },
          update: { assistantId: owner, setById: null, setAt: new Date() },
          create: { assessmentId, studentId, assistantId: owner, setById: null },
        }),
      );
    } else continue;
    changed[studentId] = owner || "default";
  }
  if (ops.length === 0) return;
  await prisma.$transaction(ops);
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "set_paper_owners",
    entityType: "assessment",
    entityId: assessmentId,
    classId: assessment.classId,
    metadata: changed,
  });
  revalidate(assessment.classId, assessmentId);
}
