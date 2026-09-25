"use server";

import { revalidatePath } from "next/cache";
import type { IncidentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { assertClassInOperation } from "@/lib/operation";
import { TASKS } from "@/lib/task-toggles";

export type ToggleState = { ok?: boolean; waived?: number; error?: string } | undefined;

const WAIVE_REASON = "Task turned off (not required)";

// Unwaived incidents of `types` that belong to this class (and optionally one assistant).
// Grade-entry incidents carry no class link, so they can't be matched and are left alone.
function incidentsInClass(classId: string, types: IncidentType[], assistantId?: string): Prisma.LateIncidentWhereInput {
  return {
    waived: false,
    type: { in: types },
    ...(assistantId ? { assistantId } : {}),
    OR: [{ session: { classId } }, { homework: { classId } }, { quizPrep: { classId } }],
  };
}

// Save which tasks are required for a class and for each of its assistants.
// Form fields (checked = required):  class:<type>  and  a:<assignmentId>:<type>.
// With `waivePast` on, existing unwaived fines for tasks that were JUST turned off are
// waived too — the task was never really theirs, so the old fines shouldn't stand.
export async function saveTaskToggles(classId: string, _prev: ToggleState, formData: FormData): Promise<ToggleState> {
  const admin = await requireRole("admin");
  await assertClassInOperation(classId);

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      disabledTasks: true,
      assignments: { where: { endDate: null }, select: { id: true, assistantId: true, exemptTasks: true } },
    },
  });
  if (!klass) return { error: "Class not found." };

  const off = (prefix: string) => TASKS.map((t) => t.type).filter((type) => formData.get(`${prefix}${type}`) !== "on");
  const waivePast = formData.get("waivePast") === "on";

  const classOff = off("class:");
  const newlyClassOff = classOff.filter((t) => !klass.disabledTasks.includes(t));
  const perAssignment = klass.assignments.map((a) => {
    const exempt = off(`a:${a.id}:`);
    return { ...a, exempt, newlyOff: exempt.filter((t) => !a.exemptTasks.includes(t)) };
  });

  let waived = 0;
  await prisma.$transaction(async (tx) => {
    await tx.class.update({ where: { id: classId }, data: { disabledTasks: classOff } });
    for (const a of perAssignment) {
      await tx.classAssignment.update({ where: { id: a.id }, data: { exemptTasks: a.exempt } });
    }
    if (!waivePast) return;
    if (newlyClassOff.length > 0) {
      const r = await tx.lateIncident.updateMany({
        where: incidentsInClass(classId, newlyClassOff),
        data: { waived: true, waiveReason: WAIVE_REASON },
      });
      waived += r.count;
    }
    for (const a of perAssignment) {
      if (a.newlyOff.length === 0) continue;
      const r = await tx.lateIncident.updateMany({
        where: incidentsInClass(classId, a.newlyOff, a.assistantId),
        data: { waived: true, waiveReason: WAIVE_REASON },
      });
      waived += r.count;
    }
  });

  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "updated_task_toggles",
    entityType: "class",
    entityId: classId,
    classId,
    metadata: {
      classOff,
      exemptions: Object.fromEntries(perAssignment.map((a) => [a.assistantId, a.exempt])),
      waived,
    },
  });
  revalidatePath(`/classes/${classId}/assistants`);
  revalidatePath("/dashboard");
  return { ok: true, waived };
}
