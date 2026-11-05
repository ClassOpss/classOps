// Dev-only: on top of dev-papers.ts, marks 2 papers in the dev assistant's sub-group as
// corrected by an assistant who is NOT on the class (simulates a departed assistant).
// Run: npx tsx scripts/dev-papers.ts && npx tsx scripts/dev-papers-left.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const klass = await prisma.class.findFirstOrThrow({ where: { name: "Demo — Y9 Stars" }, select: { id: true } });
  const a = await prisma.assessment.findFirstOrThrow({ where: { classId: klass.id, label: "ZZ Papers test" } });
  const onClass = await prisma.classAssignment.findMany({ where: { classId: klass.id, endDate: null }, select: { assistantId: true, assistant: { select: { name: true, user: { select: { email: true } } } } } });
  console.log("on class:", onClass.map((x) => `${x.assistant.name} <${x.assistant.user?.email}>`));
  const me = onClass.find((x) => x.assistant.user?.email === "assistant@classops.local")!.assistantId;
  const gone = await prisma.assistant.findFirstOrThrow({ where: { id: { notIn: onClass.map((x) => x.assistantId) } }, select: { id: true, name: true } });
  const mine = await prisma.studentAssistantAssignment.findMany({ where: { classId: klass.id, assistantId: me, endDate: null }, take: 2, select: { studentId: true } });
  await prisma.assessmentGrade.createMany({
    data: mine.map((s, i) => ({ assessmentId: a.id, studentId: s.studentId, absent: false, rawMark: 15 + i * 3, percentage: (15 + i * 3) * 5, loggedById: gone.id, loggedAt: new Date() })),
  });
  console.log("graded", mine.length, "by departed", gone.name, "url", `/my/classes/${klass.id}/assessments/${a.id}`);
}
main().finally(() => prisma.$disconnect());
