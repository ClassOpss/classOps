import { sessionStart } from "@/lib/datetime";
import { scheduleTimeForDate, type ClassSchedule } from "@/lib/schedule";

// When a follow-up task becomes actionable. Nothing should be listed as "to do" before the
// thing it follows has actually happened: you can't correct homework that isn't due yet,
// grade a quiz that hasn't been sat, or log a lesson that hasn't started.

// Homework is collected at the class on its due date (that day's slot time); a due date with
// no class that day opens at the start of the day.
export function homeworkDueAt(deadline: Date, schedule: unknown): Date {
  return sessionStart(deadline, scheduleTimeForDate(schedule as ClassSchedule, deadline));
}

// An assessment is held at its own time, else the class slot that day, else start of day.
export function assessmentHeldAt(date: Date, time: string | null | undefined, schedule: unknown): Date {
  return sessionStart(date, time || scheduleTimeForDate(schedule as ClassSchedule, date));
}

// A session's daily tasks (attendance, parent update, upload) open when the class starts.
export function sessionStartsAt(scheduledDate: Date, schedule: unknown): Date {
  return sessionStart(scheduledDate, scheduleTimeForDate(schedule as ClassSchedule, scheduledDate));
}
