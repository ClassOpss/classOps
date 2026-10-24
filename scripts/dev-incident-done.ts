// Dev helper: seeds late incidents on existing data (some tasks since done, some not) so the
// dashboard's "Done … / Not done yet" line can be eyeballed. `clean` removes them.
// Incidents are tagged waiveReason "dev-incident-done" (then un-waived) for cleanup.
import { PrismaClient } from "@prisma/client";
import { saturdayDeadline, sessionDeadline } from "../src/lib/datetime";
const prisma = new PrismaClient();
const TAG = "dev-incident-done";

async function main() {
  if (process.argv[2] === "clean") {
    const r = await prisma.lateIncident.deleteMany({ where: { waiveReason: TAG } });
    console.log("removed", r.count);
    return;
  }
  const withAtt = await prisma.classSession.findFirst({
    where: { attendance: { some: {} }, responsibleAssistantId: { not: null } },
    orderBy: { scheduledDate: "desc" },
    select: { id: true, scheduledDate: true, responsibleAssistantId: true, classId: true },
  });
  if (!withAtt) throw new Error("Need a session with logged attendance.");
  const a = withAtt.responsibleAssistantId!;
  const without = await prisma.classSession.findFirst({
    where: { classId: withAtt.classId, attendance: { none: {} }, dayOff: false, scheduledDate: { lte: new Date() } },
    orderBy: { scheduledDate: "desc" },
    select: { id: true, scheduledDate: true },
  });
  const hw = await prisma.homeworkAssignment.findFirst({
    where: { classId: withAtt.classId, noHomework: false, sessionId: { not: null } },
    orderBy: { deadline: "desc" },
    select: { sessionId: true, deadline: true },
  });
  const asm = await prisma.assessment.findFirst({ where: { classId: withAtt.classId }, orderBy: { date: "desc" }, select: { date: true } });

  const rows = [
    { type: "attendance" as const, sessionId: withAtt.id, deadline: sessionDeadline(withAtt.scheduledDate) },
    { type: "parent_update" as const, sessionId: withAtt.id, deadline: sessionDeadline(withAtt.scheduledDate) },
    ...(without ? [{ type: "attendance" as const, sessionId: without.id, deadline: sessionDeadline(without.scheduledDate) }] : []),
    ...(hw ? [{ type: "hw_correction" as const, sessionId: hw.sessionId, deadline: saturdayDeadline(hw.deadline) }] : []),
    ...(asm ? [{ type: "grade_entry" as const, sessionId: null, deadline: saturdayDeadline(asm.date) }] : []),
  ];
  // Pull every deadline into this month so the dashboard (current month) shows them.
  const now = new Date();
  await prisma.lateIncident.createMany({
    data: rows.map((r) => ({ assistantId: a, ...r, waiveReason: TAG })),
  });
  console.log("seeded", rows.length, rows.map((r) => `${r.type}@${r.deadline.toISOString()}`), "now", now.toISOString());
}
main().finally(() => prisma.$disconnect());
