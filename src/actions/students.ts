"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";

export type ImportRow = { name: string; code: string };
export type ImportResult = { added: number; skipped: number; error?: string };
export type FormState = { ok?: boolean; error?: string } | undefined;

async function syncStudentCount(classId: string) {
  const count = await prisma.student.count({ where: { classId, active: true } });
  await prisma.class.update({ where: { id: classId }, data: { studentCount: count } });
}

// Manually add a single student to a class.
export async function addStudent(
  classId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireRole("admin");
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!name || !code) return { error: "Name and code are required." };

  const clash = await prisma.student.findFirst({
    where: { classId, OR: [{ code }, { name: { equals: name, mode: "insensitive" } }] },
    select: { id: true },
  });
  if (clash) return { error: "A student with that name or code already exists in this class." };

  await prisma.student.create({ data: { classId, name, code } });
  await syncStudentCount(classId);
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "added_student",
    entityType: "class",
    entityId: classId,
    classId,
  });
  revalidatePath(`/classes/${classId}/students`);
  return { ok: true };
}

// Soft-deactivate a student (kept for historical records).
export async function deactivateStudent(studentId: string): Promise<void> {
  await requireRole("admin");
  const student = await prisma.student.update({
    where: { id: studentId },
    data: { active: false },
    select: { classId: true },
  });
  await syncStudentCount(student.classId);
  revalidatePath(`/classes/${student.classId}/students`);
}

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
  await syncStudentCount(classId);

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
