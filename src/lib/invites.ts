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

// ── Per-assistant custom invite templates ──────────────────────────────────
// An assistant can save their own student/parent invite messages using these
// {placeholders}. Rendering just substitutes known tokens; unknown text is kept
// verbatim (so they can hardcode their name, signature, emoji, etc.).
export const INVITE_PLACEHOLDERS = [
  "{studentName}",
  "{className}",
  "{parentName}",
  "{parentSalutation}",
  "{assistantName}",
  "{link}",
  "{signature}",
] as const;

export type InviteVars = {
  studentName: string;
  className: string;
  parentName?: string | null;
  parentPrefix?: string | null;
  assistantName?: string | null;
  link?: string | null; // student group link, or parent community link
  signature?: string | null;
};

export function renderInviteTemplate(template: string, vars: InviteVars): string {
  const salutation = parentSalutation(vars);
  const map: Record<string, string> = {
    "{studentName}": vars.studentName,
    "{className}": vars.className,
    "{parentName}": vars.parentName ?? `${vars.studentName}'s parent`,
    "{parentSalutation}": salutation,
    "{assistantName}": vars.assistantName ?? "",
    "{link}": vars.link ?? "",
    "{signature}": vars.signature ?? "",
  };
  return template.replace(/\{studentName\}|\{className\}|\{parentName\}|\{parentSalutation\}|\{assistantName\}|\{link\}|\{signature\}/g, (m) => map[m] ?? m);
}

export function studentInviteMessage(opts: {
  className: string;
  studentName: string;
  studentGroupLink?: string | null;
  classroomLink?: string | null;
}): string {
  const lines = [`Hi ${opts.studentName}, welcome to ${opts.className}! ${GRAD}`, ""];
  if (opts.studentGroupLink) lines.push(`Join the class WhatsApp group: ${opts.studentGroupLink}`);
  if (opts.classroomLink) lines.push(`Join our Google Classroom: ${opts.classroomLink}`);
  return lines.join("\n").trim();
}

// Time-of-day greeting (uses the runtime's local time — the sender's, in Cairo).
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

// Code message to the STUDENT (reports/grades are referenced by code, for privacy).
// Emoji + typographic chars are written as \u escapes (ASCII source) so no build /
// file-encoding step can corrupt them into replacement characters.
const CHECK = String.fromCodePoint(0x2705);
const STARSTRUCK = String.fromCodePoint(0x1F929);
const HEART = String.fromCodePoint(0x1F497);
const GRAD = String.fromCodePoint(0x1F393);
const RSQUO = String.fromCodePoint(0x2019);
const MDASH = String.fromCodePoint(0x2014);

export function studentCodeMessage(opts: { studentName: string; code: string; signature: string }): string {
  return [
    `${greeting()} ${opts.studentName},`,
    `To keep grades private, we${RSQUO}ll be using special codes instead of names when sharing results. Your unique code is: ${opts.code} ${CHECK}`,
    `Please keep this code safe ${MDASH} you${RSQUO}ll need it to find your grades every month. Think of it as your own little secret ID ${STARSTRUCK}`,
    `Best of luck on your quizzes ${MDASH} we believe in you!`,
    `${opts.signature} ${HEART}`,
  ].join("\n");
}

// How to address a parent: "<prefix> <name>" (e.g. "Mrs. Sara"), or
// "<student first name>'s Parent" when no parent name is saved.
function parentSalutation(opts: { parentPrefix?: string | null; parentName?: string | null; studentName: string }): string {
  const name = opts.parentName?.trim();
  const prefix = opts.parentPrefix?.trim();
  if (name) return prefix ? `${prefix} ${name}` : name;
  return `${opts.studentName.trim().split(/\s+/)[0]}${RSQUO}s Parent`;
}

// Code message to the PARENT.
export function parentCodeMessage(opts: {
  studentName: string;
  code: string;
  signature: string;
  parentPrefix?: string | null;
  parentName?: string | null;
}): string {
  return [
    `${greeting()} ${parentSalutation(opts)},`,
    `To keep grades private, we${RSQUO}ll be using special codes instead of names when sharing results. Your child's unique code is: ${opts.code} ${CHECK}`,
    `Please keep this code safe ${MDASH} you${RSQUO}ll need it to find your child's grades every week. Think of it as your own little secret ID ${STARSTRUCK}`,
    `Best of luck on your child's quizzes ${MDASH} we believe in them!`,
    `${opts.signature} ${HEART}`,
  ].join("\n");
}

// Cover note for the per-student monthly PDF report sent 1:1 to the parent.
// The PDF carries the detail; this is just the friendly message around it.
// No emoji on purpose — it goes through a wa.me ?text= link on desktop too.
export function parentReportMessage(opts: {
  studentName: string;
  monthLabel: string; // e.g. "September"
  signature: string;
  parentPrefix?: string | null;
  parentName?: string | null;
}): string {
  return [
    `${greeting()} ${parentSalutation(opts)},`,
    `This is ${opts.studentName}${RSQUO}s ${opts.monthLabel} report.`,
    `If you have any questions, please don${RSQUO}t hesitate to reach out ${MDASH} we${RSQUO}re always happy to help.`,
    opts.signature,
  ].join("\n");
}

export function parentInviteMessage(opts: {
  className: string;
  parentPrefix?: string | null;
  parentName?: string | null;
  studentName: string;
  parentCommunityLink?: string | null;
}): string {
  const who = parentSalutation(opts);
  const lines = [
    `Hello ${who}, this is regarding ${opts.studentName}'s ${opts.className} class.`,
    "",
  ];
  if (opts.parentCommunityLink)
    lines.push(`Please join our parents community for updates: ${opts.parentCommunityLink}`);
  return lines.join("\n").trim();
}
