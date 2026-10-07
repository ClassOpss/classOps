"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { currentOperationId } from "@/lib/operation";

export async function waiveIncident(incidentId: string, formData: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  await prisma.lateIncident.update({
    where: { id: incidentId },
    data: { waived: true, waiveReason: reason, confirmedAt: null },
  });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "waived_incident",
    entityType: "late_incident",
    entityId: incidentId,
  });
  revalidatePath("/dashboard");
  revalidatePath("/pay", "layout");
}

export async function unwaiveIncident(incidentId: string): Promise<void> {
  const admin = await requireRole("admin");
  await prisma.lateIncident.update({
    where: { id: incidentId },
    data: { waived: false, waiveReason: null },
  });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "unwaived_incident",
    entityType: "late_incident",
    entityId: incidentId,
  });
  revalidatePath("/dashboard");
  revalidatePath("/pay", "layout");
}

// "Fine stands": still deducted, but off the dashboard's To-review list.
export async function confirmIncidents(incidentIds: string[]): Promise<void> {
  const admin = await requireRole("admin");
  const operationId = await currentOperationId();
  const { count } = await prisma.lateIncident.updateMany({
    where: { id: { in: incidentIds }, waived: false, confirmedAt: null, assistant: { operationId } },
    data: { confirmedAt: new Date() },
  });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "confirmed_incidents",
    entityType: "late_incident",
    entityId: incidentIds.length === 1 ? incidentIds[0] : null,
    metadata: { count },
  });
  revalidatePath("/dashboard");
  revalidatePath("/pay", "layout");
}

export async function unconfirmIncident(incidentId: string): Promise<void> {
  const admin = await requireRole("admin");
  await prisma.lateIncident.update({ where: { id: incidentId }, data: { confirmedAt: null } });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "unconfirmed_incident",
    entityType: "late_incident",
    entityId: incidentId,
  });
  revalidatePath("/dashboard");
  revalidatePath("/pay", "layout");
}
