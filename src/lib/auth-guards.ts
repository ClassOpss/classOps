import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { homeFor } from "@/lib/routes";
import { currentOperationId } from "@/lib/operation";

export type SessionUser = {
  id: string;
  role: Role;
  assistantId: string | null;
  // null = super-admin (cross-operation); otherwise the user's home operation.
  operationId: string | null;
  name?: string | null;
  email?: string | null;
};

// The real access-control layer (middleware is just coarse routing).
// Call these at the top of every server component / server action that touches data.

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user as SessionUser;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

// Assistants may only act on classes they are actively assigned to.
// Admin/teacher pass through. Returns the (assistant) user when allowed.
export async function requireClassAccess(classId: string): Promise<SessionUser> {
  const user = await requireUser();

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { operationId: true },
  });
  if (!klass) redirect(homeFor(user.role));

  // The class must belong to the operation in scope (the user's own, or the
  // super-admin's active operation) — blocks cross-operation access via URL.
  if (klass.operationId !== (await currentOperationId())) redirect(homeFor(user.role));

  if (user.role === "admin" || user.role === "teacher") return user;

  if (!user.assistantId) redirect("/my");

  const now = new Date();
  const assignment = await prisma.classAssignment.findFirst({
    where: {
      classId,
      assistantId: user.assistantId,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    select: { id: true },
  });
  if (!assignment) redirect("/my");

  return user;
}

// Sub-group rule (spec 4.6): if a class has student sub-assignments, an assistant
// only sees their own students; otherwise (single assistant) they see all of them.
// Admin/teacher always see the full roster.
export async function getVisibleStudentIds(
  classId: string,
  user: SessionUser,
): Promise<string[]> {
  const allStudents = await prisma.student.findMany({
    where: { classId, active: true },
    select: { id: true },
    orderBy: { name: "asc" },
  });
  const allIds = allStudents.map((s) => s.id);

  if (user.role !== "assistant" || !user.assistantId) return allIds;

  const now = new Date();
  const subAssignments = await prisma.studentAssistantAssignment.findMany({
    where: {
      classId,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    select: { studentId: true, assistantId: true },
  });

  // No sub-assignments at all -> single-assistant class, show everyone.
  if (subAssignments.length === 0) return allIds;

  return subAssignments
    .filter((s) => s.assistantId === user.assistantId)
    .map((s) => s.studentId);
}
