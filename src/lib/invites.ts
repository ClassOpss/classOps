// Helpers for the compliant WhatsApp onboarding flow: we never auto-add anyone to
// a group/community (that risks a ban). Instead we generate a pre-filled "click to
// send" wa.me link per recipient carrying their class's invite link — one tap sends
// it, and they self-join.

// Normalise an Egyptian (or already-international) number to bare E.164 digits for wa.me.
//   01001234567 -> 201001234567 ; +20 100 123 4567 -> 201001234567
export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d]/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("20")) return d;
  if (d.startsWith("0")) return "20" + d.slice(1);
  // A bare 10-digit Egyptian mobile (1XXXXXXXXX) -> prefix country code.
  if (d.length === 10 && d.startsWith("1")) return "20" + d;
  return d;
}

export function waLink(phone: string | null | undefined, text: string): string | null {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function studentInviteMessage(opts: {
  className: string;
  studentName: string;
  studentGroupLink?: string | null;
  classroomLink?: string | null;
}): string {
  const lines = [`Hi ${opts.studentName}, welcome to ${opts.className}! 🎓`, ""];
  if (opts.studentGroupLink) lines.push(`Join the class WhatsApp group: ${opts.studentGroupLink}`);
  if (opts.classroomLink) lines.push(`Join our Google Classroom: ${opts.classroomLink}`);
  return lines.join("\n").trim();
}

// A private per-student progress report for the parent (sent 1:1 over WhatsApp).
export function parentReportMessage(opts: {
  brandName: string;
  className: string;
  studentName: string;
  parentName?: string | null;
  periodLabel?: string | null;
  attendance: { present: number; total: number };
  avgPercent: number | null;
  hw: { onTime: number; late: number; missing: number };
}): string {
  const who = opts.parentName ? opts.parentName : "there";
  const att = opts.attendance;
  const attLine =
    att.total > 0
      ? `Attendance: ${att.present}/${att.total} (${Math.round((att.present / att.total) * 100)}%)`
      : "Attendance: —";
  const lines = [
    `Hello ${who}, here is ${opts.studentName}'s progress report — ${opts.className}${opts.periodLabel ? ` (${opts.periodLabel})` : ""}:`,
    "",
    attLine,
    `Average grade: ${opts.avgPercent == null ? "—" : Math.round(opts.avgPercent) + "%"}`,
    `Homework: ${opts.hw.onTime} on time · ${opts.hw.late} late · ${opts.hw.missing} missing`,
    "",
    `— ${opts.brandName}`,
  ];
  return lines.join("\n");
}

export function parentInviteMessage(opts: {
  className: string;
  parentName?: string | null;
  studentName: string;
  parentCommunityLink?: string | null;
}): string {
  const who = opts.parentName ? opts.parentName : "there";
  const lines = [
    `Hello ${who}, this is regarding ${opts.studentName}'s ${opts.className} class.`,
    "",
  ];
  if (opts.parentCommunityLink)
    lines.push(`Please join our parents community for updates: ${opts.parentCommunityLink}`);
  return lines.join("\n").trim();
}
