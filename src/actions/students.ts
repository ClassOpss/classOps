"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, requireClassAccess } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { schoolPrefix, uniqueStudentCode } from "@/lib/code";
import { autoAssignNewStudents } from "@/actions/assignments";
import { assertClassInOperation } from "@/lib/operation";

export type ImportRow = {
  name: string;
  code: string;
  email?: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
};
export type ImportResult = { added: number; skipped: number; error?: string };

const clean = (v?: string) => {
  const t = (v ?? "").trim();
  return t.length ? t : null;
};
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
  const admin = await requireClassAccess(classId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { school: { select: { name: true } } },
  });
  if (!klass) return { error: "Class not found." };

  const existing = await prisma.student.findMany({
    where: { classId },
    select: { name: true, code: true },
  });
  if (existing.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    return { error: "A student with that name already exists in this class." };
  }

  // Code is optional — use the provided one if free, otherwise mint a random unique code.
  const taken = new Set(existing.map((s) => s.code));
  let code = String(formData.get("code") ?? "").trim();
  if (!code || taken.has(code)) code = uniqueStudentCode(schoolPrefix(klass.school.name), taken);

  const created = await prisma.student.create({
    data: { classId, name, code },
    select: { id: true },
  });
  await syncStudentCount(classId);
  await autoAssignNewStudents(classId, [created.id]);
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

// Edit a student's contact details (numbers/emails often unknown at form-fill time).
export async function updateStudentContacts(
  studentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { classId: true },
  });
  if (!student) return { error: "Student not found." };
  await requireClassAccess(student.classId);

  const clean = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v.length ? v : null;
  };
  await prisma.student.update({
    where: { id: studentId },
    data: {
      email: clean("email"),
      phone: clean("phone"),
      parentName: clean("parentName"),
      parentPhone: clean("parentPhone"),
    },
  });
  revalidatePath(`/classes/${student.classId}/students`);
  revalidatePath(`/classes/${student.classId}/invites`);
  return { ok: true };
}

// Set the free-text parent notes shown on the student's PDF report.
export async function setParentNotes(
  studentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { classId: true },
  });
  if (!student) return { error: "Student not found." };
  await requireClassAccess(student.classId);
  const notes = String(formData.get("parentNotes") ?? "").trim() || null;
  await prisma.student.update({ where: { id: studentId }, data: { parentNotes: notes } });
  revalidatePath(`/classes/${student.classId}/parent-reports`);
  return { ok: true };
}

// Soft-deactivate a student (kept for historical records). Admin or teacher.
export async function deactivateStudent(studentId: string): Promise<void> {
  await requireRole("admin", "teacher");
  const target = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true } });
  if (!target) return;
  await assertClassInOperation(target.classId);
  const student = await prisma.student.update({
    where: { id: studentId },
    data: { active: false },
    select: { classId: true },
  });
  await syncStudentCount(student.classId);
  revalidatePath(`/classes/${student.classId}/students`);
}

// Batch-insert of students into a class (admin, teacher, or assigned assistant).
// Dedupes by name (case-insensitive) and code within the class.
export async function importStudents(
  classId: string,
  rows: ImportRow[],
): Promise<ImportResult> {
  const admin = await requireClassAccess(classId);

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, school: { select: { name: true } } },
  });
  if (!klass) return { added: 0, skipped: 0, error: "Class not found." };
  const prefix = schoolPrefix(klass.school.name);

  const existing = await prisma.student.findMany({
    where: { classId },
    select: { name: true, code: true },
  });
  const seenNames = new Set(existing.map((s) => s.name.toLowerCase()));
  const seenCodes = new Set(existing.map((s) => s.code));

  const toInsert: {
    classId: string;
    name: string;
    code: string;
    email: string | null;
    phone: string | null;
    parentName: string | null;
    parentPhone: string | null;
  }[] = [];
  let skipped = 0;

  for (const row of rows) {
    const name = row.name.trim();
    if (!name) {
      skipped++;
      continue;
    }
    // Only a duplicate NAME is skipped. Codes are opaque/random, so a code
    // clash (or a blank code) just means we mint a fresh unique one.
    if (seenNames.has(name.toLowerCase())) {
      skipped++;
      continue;
    }
    let code = row.code.trim();
    if (!code || seenCodes.has(code)) code = uniqueStudentCode(prefix, seenCodes);
    seenNames.add(name.toLowerCase());
    seenCodes.add(code);
    toInsert.push({
      classId,
      name,
      code,
      email: clean(row.email),
      phone: clean(row.phone),
      parentName: clean(row.parentName),
      parentPhone: clean(row.parentPhone),
    });
  }

  const result =
    toInsert.length > 0
      ? await prisma.student.createMany({ data: toInsert, skipDuplicates: true })
      : { count: 0 };

  // Keep the denormalised studentCount in sync with the real roster.
  await syncStudentCount(classId);

  // If the class is already divided between 2 assistants, slot the new students
  // into the smaller sub-group.
  if (toInsert.length > 0) {
    const insertedCodes = toInsert.map((t) => t.code);
    const created = await prisma.student.findMany({
      where: { classId, code: { in: insertedCodes } },
      select: { id: true },
    });
    await autoAssignNewStudents(classId, created.map((c) => c.id));
  }

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
