// Dev-only: a student added today must not reopen HW / assessments set before today.
// Adds a temp student to a class with past HW + an assessment, checks the rosters, removes it.
// Run: npx tsx scripts/dev-joiner-check.ts
import { prisma } from "../src/lib/db";
import { subGroupStudentIds, hwJoinCutoff } from "../src/lib/roster";
import { loadPaperOwners } from "../src/lib/paper-owners";

async function main() {
  const hw = await prisma.homeworkAssignment.findFirst({
    where: { noHomework: false, class: { assessments: { some: {} }, assignments: { some: { endDate: null } } } },
    orderBy: { deadline: "asc" },
    select: {
      id: true, classId: true, createdAt: true, session: { select: { scheduledDate: true } },
      class: { select: { assignments: { where: { endDate: null }, select: { assistantId: true }, take: 1 } } },
    },
  });
  if (!hw) throw new Error("no class with HW + assessments");
  const assistantId = hw.class.assignments[0].assistantId;
  const assessment = await prisma.assessment.findFirst({ where: { classId: hw.classId }, orderBy: { date: "asc" } });
  const s = await prisma.student.create({ data: { classId: hw.classId, name: "ZZ Joiner", code: "ZZ999" } });
  try {
    const old = await subGroupStudentIds(hw.classId, assistantId, new Date(), hwJoinCutoff(hw));
    const any = await subGroupStudentIds(hw.classId, assistantId, new Date());
    const papers = (await loadPaperOwners([assessment!.id])).get(assessment!.id)!;
    console.log("HW", hw.session?.scheduledDate ?? hw.createdAt, "-> joiner counted:", old.includes(s.id), "(no cutoff:", any.includes(s.id) + ")");
    console.log("Assessment", assessment!.date, "-> joiner owes paper:", papers.owners.has(s.id));
    // An assessment dated today would include them.
    const today = await prisma.assessment.create({
      data: { classId: hw.classId, type: "quiz", label: "ZZ today", date: new Date(new Date().toISOString().slice(0, 10)), maxMark: 10 },
    });
    console.log("Assessment today -> joiner owes paper:", (await loadPaperOwners([today.id])).get(today.id)!.owners.has(s.id));
    await prisma.assessment.delete({ where: { id: today.id } });
  } finally {
    await prisma.student.delete({ where: { id: s.id } });
  }
}
main().finally(() => prisma.$disconnect());
