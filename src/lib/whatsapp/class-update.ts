// Message A — Class Update (spec 5.13). Sent to the class WhatsApp group after a session.
// Students are referenced by NAME here (codes are reserved for the grade reports —
// see student-code-privacy).

export type ClassUpdateData = {
  dateLabel: string;
  className: string;
  schoolName: string;
  topic?: string | null;
  attendanceLogged: boolean;
  absentNames: string[];
  // Optional sections — included only when present.
  hwMissingNames?: string[];
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
    lines.push(`Absent students: ${d.absentNames.length ? d.absentNames.join(", ") : "None"}`);
  }

  // Homework block — only when there's something to say.
  const hwLines: string[] = [];
  if (d.hwMissingNames && d.hwMissingNames.length > 0) {
    hwLines.push(`Students who did not submit previous homework: ${d.hwMissingNames.join(", ")}`);
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
