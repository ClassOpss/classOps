"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";

export async function waiveIncident(incidentId: string, formData: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  await prisma.lateIncident.update({
    where: { id: incidentId },
    data: { waived: true, waiveReason: reason },
  });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "waived_incident",
    entityType: "late_incident",
    entityId: incidentId,
  });
  revalidatePath("/dashboard");
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
}
