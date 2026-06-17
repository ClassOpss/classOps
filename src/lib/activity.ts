import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

interface LogActivityInput {
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  classId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

// Append-only activity log helper (spec 4.20). Never throws into the caller's flow.
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        classId: input.classId ?? null,
        metadata: input.metadata,
      },
    });
  } catch (err) {
    console.error("[activity] failed to log", input.action, err);
  }
}
