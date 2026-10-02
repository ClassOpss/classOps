// Runs reassignResponsibilities on ZZ-Switch (after dev-switch.ts) and prints owners + covers.
import { PrismaClient } from "@prisma/client";
import { reassignResponsibilities } from "../src/actions/sessions";
import { detectCoverageCandidates } from "../src/lib/coverage";

const prisma = new PrismaClient();
const OP = "00000000-0000-0000-0000-000000000001";

async function show(label: string, classId: string) {
  const s = await prisma.classSession.findMany({
    where: { classId }, orderBy: { scheduledDate: "asc" },
    select: { scheduledDate: true, responsibleAssistant: { select: { name: true } } },
  });
  console.log(`\n${label}`);
  for (const x of s) console.log(" ", x.scheduledDate.toISOString().slice(0, 10), ["Su","Mo","Tu","We","Th","Fr","Sa"][x.scheduledDate.getUTCDay()], x.responsibleAssistant?.name);
  const cov = (await detectCoverageCandidates(OP)).filter((c) => c.classId === classId);
  console.log("  coverage candidates:", cov.length);
}

async function main() {
  const k = await prisma.class.findFirstOrThrow({ where: { name: "ZZ-Switch" } });
  await show("BEFORE (buggy stamp)", k.id);
  await reassignResponsibilities(k.id);
  await show("AFTER recalculate (auto split)", k.id);
  const omar = await prisma.assistant.findFirstOrThrow({ where: { name: "ZZ Omar" } });
  const belal = await prisma.assistant.findFirstOrThrow({ where: { name: "ZZ Belal" } });
  await prisma.classAssignment.updateMany({ where: { classId: k.id, assistantId: omar.id }, data: { ownedWeekdays: [2] } });
  // Belal started before today -> close the row today, reopen from today with the new day (as saveDayOwners does).
  const today = new Date(Date.UTC(2026, 9, 2));
  await prisma.classAssignment.updateMany({ where: { classId: k.id, assistantId: belal.id, endDate: null }, data: { endDate: today } });
  await prisma.classAssignment.create({ data: { classId: k.id, assistantId: belal.id, startDate: today, ownedWeekdays: [4] } });
  await reassignResponsibilities(k.id);
  await show("AFTER pin Omar=Tue, Belal=Thu", k.id);
}
main().finally(() => prisma.$disconnect());
