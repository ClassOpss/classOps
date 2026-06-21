"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";

// Admin confirms that `covererId` covered this session for its owner -> drives ±coverage in pay.
export async function confirmCoverage(sessionId: string, covererId: string): Promise<void> {
  const admin = await requireRole("admin");
  const s = await prisma.classSession.update({
    where: { id: sessionId },
    data: { coveredById: covererId },
    select: { classId: true },
  });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "confirmed_coverage",
    entityType: "session",
    entityId: sessionId,
    classId: s.classId,
    metadata: { covererId },
  });
  revalidatePath("/dashboard");
}

export async function clearCoverage(sessionId: string): Promise<void> {
  await requireRole("admin");
  await prisma.classSession.update({ where: { id: sessionId }, data: { coveredById: null } });
  revalidatePath("/dashboard");
}
