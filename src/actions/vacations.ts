"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { currentOperationId } from "@/lib/operation";

export type FormState = { ok?: boolean; error?: string } | undefined;

// Parse a yyyy-mm-dd <input type=date> value into a UTC-midnight Date (matches @db.Date).
function parseDate(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Admin: record a school break (Easter, mid-year, …). Prorates that school's classes'
// pay for the covered days and suppresses late fines / coverage flags during the window.
export async function createVacation(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("admin");
  const operationId = await currentOperationId();

  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const start = parseDate(String(formData.get("startDate") ?? ""));
  const end = parseDate(String(formData.get("endDate") ?? ""));

  if (!label) return { error: "Give the break a name (e.g. Easter)." };
  if (!start || !end) return { error: "Pick valid start and end dates." };
  if (end < start) return { error: "End date can't be before the start date." };

  const school = await prisma.school.findFirst({
    where: { id: schoolId, operationId },
    select: { id: true },
  });
  if (!school) return { error: "Pick a school." };

  await prisma.schoolVacation.create({
    data: { operationId, schoolId, label, startDate: start, endDate: end },
  });

  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "added_school_vacation",
    entityType: "school",
    entityId: schoolId,
    metadata: { label },
  });
  revalidatePath("/vacations");
  return { ok: true };
}

export async function deleteVacation(vacationId: string): Promise<void> {
  const admin = await requireRole("admin");
  const operationId = await currentOperationId();
  const vac = await prisma.schoolVacation.findFirst({
    where: { id: vacationId, operationId },
    select: { id: true, schoolId: true, label: true },
  });
  if (!vac) return;
  await prisma.schoolVacation.delete({ where: { id: vac.id } });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "removed_school_vacation",
    entityType: "school",
    entityId: vac.schoolId,
    metadata: { label: vac.label },
  });
  revalidatePath("/vacations");
}
