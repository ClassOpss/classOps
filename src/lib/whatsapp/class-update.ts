// Message A — Class Update (spec 5.13). Sent to the class WhatsApp group after a session.
// Students are referenced by CODE (not name) to keep the group message private — each
// parent recognises only their own child's code (see student-code-privacy).

export type ClassUpdateData = {
  dateLabel: string;
  className: string;
  schoolName: string;
  topic?: string | null;
  attendanceLogged: boolean;
  absentCodes: string[];
  // Optional sections — populated once homework (Step 9) / assessments (Step 10) exist.
  hwMissingCodes?: string[];
  newHomework?: string | null;
  homeworkDueLabel?: string | null;
  quizLine?: string | null;
  notes?: string | null;
};

export function buildClassUpdateMessage(d: ClassUpdateData): string {
  const lines: string[] = [];
  lines.push(`*Class Update – ${d.dateLabel}*`);
  lines.push("Dear Parents,");
  lines.push(`Today, in class ${d.className} – ${d.schoolName} we covered:`);
  lines.push(`Topic: ${d.topic ?? "—"}`);
  lines.push("");

  lines.push("*Attendance:*");
  if (!d.attendanceLogged) {
    lines.push("Absent students: (attendance not logged yet)");
  } else {
    lines.push(`Absent students: ${d.absentCodes.length ? d.absentCodes.join(", ") : "None"}`);
  }

  // Homework block — only when there's something to say.
  const hwLines: string[] = [];
  if (d.hwMissingCodes && d.hwMissingCodes.length > 0) {
    hwLines.push(`Students who did not submit previous homework: ${d.hwMissingCodes.join(", ")}`);
  }
  if (d.newHomework) {
    hwLines.push(`New homework assigned: ${d.newHomework}`);
    if (d.homeworkDueLabel) hwLines.push(`Due: ${d.homeworkDueLabel}`);
  }
  if (hwLines.length > 0) {
    lines.push("");
    lines.push("*Homework:*");
    lines.push(...hwLines);
  }

  // Notes / reminders block — only when there's a quiz alert or manual note.
  const noteLines: string[] = [];
  if (d.quizLine) noteLines.push(d.quizLine);
  if (d.notes) noteLines.push(d.notes);
  if (noteLines.length > 0) {
    lines.push("");
    lines.push("*Class Notes/Reminders:*");
    lines.push(...noteLines);
  }

  lines.push("");
  lines.push("Thank you for your continued support.");
  lines.push("Best regards,");
  lines.push("*Team MO*");

  return lines.join("\n");
}
