"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";

export type ImportRow = { name: string; code: string };
export type ImportResult = { added: number; skipped: number; error?: string };

// Admin batch-insert of students into a class. Dedupes by name (case-insensitive)
// and code within the class; uses createMany(skipDuplicates) for the bulk insert.
export async function importStudents(
  classId: string,
  rows: ImportRow[],
): Promise<ImportResult> {
  const admin = await requireRole("admin");

  const klass = await prisma.class.findUnique({ where: { id: classId }, select: { id: true } });
  if (!klass) return { added: 0, skipped: 0, error: "Class not found." };

  const existing = await prisma.student.findMany({
    where: { classId },
    select: { name: true, code: true },
  });
  const seenNames = new Set(existing.map((s) => s.name.toLowerCase()));
  const seenCodes = new Set(existing.map((s) => s.code));

  const toInsert: { classId: string; name: string; code: string }[] = [];
  let skipped = 0;

  for (const row of rows) {
    const name = row.name.trim();
    const code = row.code.trim();
    if (!name || !code) {
      skipped++;
      continue;
    }
    if (seenNames.has(name.toLowerCase()) || seenCodes.has(code)) {
      skipped++;
      continue;
    }
    seenNames.add(name.toLowerCase());
    seenCodes.add(code);
    toInsert.push({ classId, name, code });
  }

  const result =
    toInsert.length > 0
      ? await prisma.student.createMany({ data: toInsert, skipDuplicates: true })
      : { count: 0 };

  // Keep the denormalised studentCount in sync with the real roster.
  const count = await prisma.student.count({ where: { classId } });
  await prisma.class.update({ where: { id: classId }, data: { studentCount: count } });

  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "imported_students",
    entityType: "class",
    entityId: classId,
    classId,
    metadata: { added: result.count, skipped },
  });

  revalidatePath(`/classes/${classId}/students`);
  return { added: result.count, skipped };
}
