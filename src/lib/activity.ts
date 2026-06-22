import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { currentOperationId } from "@/lib/operation";

interface LogActivityInput {
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  classId?: string | null;
  // Defaults to the request's current operation; pass explicitly (incl. null) to override.
  operationId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

// Append-only activity log helper (spec 4.20). Never throws into the caller's flow.
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    let operationId = input.operationId;
    if (operationId === undefined) {
      try {
        operationId = await currentOperationId();
      } catch {
        operationId = null; // outside a resolvable request scope
      }
    }
    await prisma.activityLog.create({
      data: {
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        classId: input.classId ?? null,
        operationId: operationId ?? null,
        metadata: input.metadata,
      },
    });
  } catch (err) {
    console.error("[activity] failed to log", input.action, err);
  }
}
