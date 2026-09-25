import type { IncidentType, LmsType } from "@prisma/client";
import { hasLms } from "@/lib/lms";

// Every trackable assistant task, in display order. Each one can be turned off for a
// whole class (Class.disabledTasks — e.g. the school has no parents group) or for one
// assistant in one class (ClassAssignment.exemptTasks). An OFF task is never listed on
// the Tasks page, never reminded, and never fined — nobody loses money for work that
// isn't theirs to do.
export const TASKS: { type: IncidentType; label: string }[] = [
  { type: "attendance", label: "Attendance" },
  { type: "parent_update", label: "Parent update" },
  { type: "classroom_upload", label: "Classroom upload" },
  { type: "hw_correction", label: "HW correction" },
  { type: "grade_entry", label: "Grade entry" },
  { type: "quiz_prep", label: "Quiz prep" },
  { type: "quiz_announcement", label: "Quiz announcement" },
];

const TASK_TYPES = new Set<string>(TASKS.map((t) => t.type));

export function isTaskType(v: string): v is IncidentType {
  return TASK_TYPES.has(v);
}

export type TaskScope = {
  lmsType?: LmsType;
  disabledTasks: IncidentType[]; // class-wide
  // The assistant's exemptions in this class (union across their active assignment rows).
  exemptTasks?: IncidentType[];
};

// Whether `type` is required of this assistant in this class.
export function taskRequired(type: IncidentType, scope: TaskScope): boolean {
  if (type === "classroom_upload" && scope.lmsType && !hasLms(scope.lmsType)) return false;
  if (scope.disabledTasks.includes(type)) return false;
  if (scope.exemptTasks?.includes(type)) return false;
  return true;
}

// Union of an assistant's exemptions across the given assignment rows (a permanent row
// plus a cover row can coexist; being exempt on either one excuses them).
export function exemptionsFor(
  assistantId: string,
  rows: { assistantId: string; exemptTasks: IncidentType[] }[],
): IncidentType[] {
  return rows.filter((r) => r.assistantId === assistantId).flatMap((r) => r.exemptTasks);
}
