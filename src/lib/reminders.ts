import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import type { LmsType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CAIRO_TZ, sessionDeadline, saturdayDeadline, sessionStart, formatCairo } from "@/lib/datetime";
import { subGroupStudentIds, activeAt } from "@/lib/roster";
import { scheduleTimeForDate, type ClassSchedule } from "@/lib/schedule";
import { OPERATION_DEFAULTS, operationConfig, type OperationConfig } from "@/lib/config";
import { loadAllVacations, isSchoolOnVacation, type VacationSpan } from "@/lib/vacations";
import { sendEmail, resolveOperationSender } from "@/lib/email";

// How far ahead of a deadline the reminder fires. The cron runs hourly and each
// operation is nudged only in the single hour that sits this many hours before its
// own (per-operation) deadline hour — so "2 hours before 9pm" == the 7pm run.
const REMINDER_LEAD_HOURS = 2;

type VacMap = Map<string, VacationSpan[]>;
type CfgMap = Map<string, OperationConfig>;

function cfgFor(cfgs: CfgMap, operationId: string): OperationConfig {
  return cfgs.get(operationId) ?? OPERATION_DEFAULTS;
}

// The Cairo calendar day of `now`, as a UTC-midnight Date (matches @db.Date storage).
function cairoDate(now: Date): Date {
  return new Date(`${formatInTimeZone(now, CAIRO_TZ, "yyyy-MM-dd")}T00:00:00.000Z`);
}

function onVacation(vacs: VacMap, operationId: string, schoolId: string, date: Date): boolean {
  return isSchoolOnVacation(schoolId, date, vacs.get(operationId) ?? []);
}

// One outstanding task an assistant still owes before a deadline.
type PendingTask = {
  label: string; // human phrasing, e.g. "Log attendance — Y9 Citadel"
  deadline: Date;
};

type Bucket = { operationId: string; tasks: PendingTask[] };

function lmsLabel(lms: LmsType): string {
  return lms === "ie_learn" ? "IE Learn" : "Google Classroom";
}

// Daily session tasks (attendance / parent update / classroom upload) due tonight, for
// the operations whose reminder window is currently open. Skips sessions that haven't
// started yet — you can't log attendance for a class that hasn't happened.
async function gatherDaily(
  now: Date,
  today: Date,
  ops: Set<string>,
  cfgs: CfgMap,
  vacs: VacMap,
  buckets: Map<string, Bucket>,
): Promise<void> {
  if (ops.size === 0) return;
  const sessions = await prisma.classSession.findMany({
    where: { scheduledDate: today, dayOff: false, class: { operationId: { in: [...ops] } } },
    select: {
      responsibleAssistantId: true,
      coveredById: true,
      class: { select: { name: true, operationId: true, schoolId: true, schedule: true, lmsType: true } },
      attendance: { select: { id: true }, take: 1 },
      parentUpdate: { select: { id: true } },
      classroomUpload: { select: { id: true } },
    },
  });

  for (const s of sessions) {
    // Daily tasks belong to ONE assistant: the coverer if covered, else the owner.
    const assistantId = s.coveredById ?? s.responsibleAssistantId;
    if (!assistantId) continue;
    const operationId = s.class.operationId;
    if (onVacation(vacs, operationId, s.class.schoolId, today)) continue;

    // Not started yet -> the tasks can't be done, so no reminder for this session.
    const time = scheduleTimeForDate(s.class.schedule as ClassSchedule, today);
    if (now < sessionStart(today, time)) continue;

    const deadline = sessionDeadline(today, cfgFor(cfgs, operationId));
    const cls = s.class.name;
    const bucket = buckets.get(assistantId) ?? { operationId, tasks: [] };
    if (s.attendance.length === 0) bucket.tasks.push({ label: `Log attendance — ${cls}`, deadline });
    if (!s.parentUpdate) bucket.tasks.push({ label: `Send parent update — ${cls}`, deadline });
    if (!s.classroomUpload)
      bucket.tasks.push({ label: `Upload to ${lmsLabel(s.class.lmsType)} — ${cls}`, deadline });
    buckets.set(assistantId, bucket);
  }
}

// Weekly sub-group tasks (HW correction / grade entry) due this Sunday–Saturday week, for
// the operations whose weekly reminder window is currently open.
async function gatherWeekly(
  now: Date,
  ops: Set<string>,
  cfgs: CfgMap,
  vacs: VacMap,
  buckets: Map<string, Bucket>,
): Promise<void> {
  if (ops.size === 0) return;
  const weekEnd = cairoDate(now); // the weekly deadline weekday (Saturday)
  const weekStart = new Date(weekEnd);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);

  const homeworks = await prisma.homeworkAssignment.findMany({
    where: {
      noHomework: false,
      deadline: { gte: weekStart, lte: weekEnd },
      class: { operationId: { in: [...ops] } },
    },
    select: {
      classId: true,
      deadline: true,
      submissions: { select: { studentId: true } },
      class: {
        select: {
          name: true,
          operationId: true,
          schoolId: true,
          assignments: { where: activeAt(now), select: { assistantId: true } },
        },
      },
    },
  });
  for (const hw of homeworks) {
    const operationId = hw.class.operationId;
    if (onVacation(vacs, operationId, hw.class.schoolId, hw.deadline)) continue;
    const deadline = saturdayDeadline(hw.deadline, cfgFor(cfgs, operationId));
    const submitted = new Set(hw.submissions.map((x) => x.studentId));
    for (const { assistantId } of hw.class.assignments) {
      const subIds = await subGroupStudentIds(hw.classId, assistantId, now);
      if (subIds.length === 0) continue;
      const reviewed = subIds.filter((id) => submitted.has(id)).length;
      if (reviewed < subIds.length) {
        const bucket = buckets.get(assistantId) ?? { operationId, tasks: [] };
        bucket.tasks.push({ label: `Correct homework — ${hw.class.name}`, deadline });
        buckets.set(assistantId, bucket);
      }
    }
  }

  const assessments = await prisma.assessment.findMany({
    where: { date: { gte: weekStart, lte: weekEnd }, class: { operationId: { in: [...ops] } } },
    select: {
      classId: true,
      date: true,
      grades: { select: { studentId: true } },
      class: {
        select: {
          name: true,
          operationId: true,
          schoolId: true,
          assignments: { where: activeAt(now), select: { assistantId: true } },
        },
      },
    },
  });
  for (const a of assessments) {
    const operationId = a.class.operationId;
    if (onVacation(vacs, operationId, a.class.schoolId, a.date)) continue;
    const deadline = saturdayDeadline(a.date, cfgFor(cfgs, operationId));
    const graded = new Set(a.grades.map((g) => g.studentId));
    for (const { assistantId } of a.class.assignments) {
      const subIds = await subGroupStudentIds(a.classId, assistantId, now);
      if (subIds.length === 0) continue;
      const done = subIds.filter((id) => graded.has(id)).length;
      if (done < subIds.length) {
        const bucket = buckets.get(assistantId) ?? { operationId, tasks: [] };
        bucket.tasks.push({ label: `Enter assessment grades — ${a.class.name}`, deadline });
        buckets.set(assistantId, bucket);
      }
    }
  }
}

// Which operations are inside their daily / weekly reminder window right now.
function activeWindows(
  now: Date,
  today: Date,
  cfgs: CfgMap,
  force: boolean,
): { daily: Set<string>; weekly: Set<string> } {
  const cairoHour = Number(formatInTimeZone(now, CAIRO_TZ, "H"));
  const cairoWeekday = today.getUTCDay(); // 0=Sun … 6=Sat, matching weeklyDeadlineWeekday
  const daily = new Set<string>();
  const weekly = new Set<string>();
  for (const [operationId, cfg] of cfgs) {
    const dailyHour = (cfg.dailyDeadlineHour - REMINDER_LEAD_HOURS + 24) % 24;
    if (force || cairoHour === dailyHour) daily.add(operationId);
    const weeklyHour = (cfg.weeklyDeadlineHour - REMINDER_LEAD_HOURS + 24) % 24;
    if (force || (cairoWeekday === cfg.weeklyDeadlineWeekday && cairoHour === weeklyHour))
      weekly.add(operationId);
  }
  return { daily, weekly };
}

function reminderEmail(opts: { brandName: string; name: string; tasks: PendingTask[]; url: string }): {
  html: string;
  text: string;
} {
  const { brandName, name, tasks, url } = opts;
  const rows = tasks
    .map(
      (t) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eef0f3;font-size:14px;color:#0f1729">${t.label}</td>` +
        `<td style="padding:8px 0 8px 12px;border-bottom:1px solid #eef0f3;font-size:13px;color:#98a1ae;white-space:nowrap;text-align:right">due ${formatCairo(
          t.deadline,
          "h:mm a",
        )}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f7f8fa;padding:24px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f1729">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border:1px solid #e8eaed;border-radius:14px;overflow:hidden">
      <tr><td style="padding:22px 28px;border-bottom:1px solid #e8eaed;font-weight:700;font-size:16px">${brandName}</td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 10px;font-size:20px">Deadline reminder</h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#5b6472">${name}, you have ${tasks.length} task${
          tasks.length === 1 ? "" : "s"
        } still to complete before tonight's deadline:</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px">${rows}</table>
        <a href="${url}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:9px">Open my classes</a>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:11px;color:#98a1ae">Sent by ${brandName} via ClassOps</p>
  </td></tr></table></body></html>`;
  const text = `Deadline reminder\n\n${name}, you have ${tasks.length} task(s) still to complete before tonight's deadline:\n\n${tasks
    .map((t) => `- ${t.label} (due ${formatCairo(t.deadline, "h:mm a")})`)
    .join("\n")}\n\nOpen my classes: ${url}`;
  return { html, text };
}

export type ReminderResult = {
  operations: number; // operations with a window open this run
  candidates: number; // assistants with >=1 pending task
  sent: number;
  failed: number;
};

// Load every operation's config once (the job spans all operations).
async function loadConfigs(): Promise<CfgMap> {
  const ops = await prisma.operation.findMany();
  return new Map(ops.map((o) => [o.id, operationConfig(o)]));
}

// Email each assistant a summary of the daily/weekly tasks they still owe, ~2h before the
// deadline. `force` ignores the time-of-day window; `dryRun` computes recipients without
// sending (both for testing).
export async function sendDeadlineReminders(
  now: Date = new Date(),
  { force = false, dryRun = false }: { force?: boolean; dryRun?: boolean } = {},
): Promise<ReminderResult> {
  const cfgs = await loadConfigs();
  const today = cairoDate(now);
  const { daily, weekly } = activeWindows(now, today, cfgs, force);
  const openOps = new Set([...daily, ...weekly]);
  if (openOps.size === 0) return { operations: 0, candidates: 0, sent: 0, failed: 0 };

  const vacs = await loadAllVacations();
  const buckets = new Map<string, Bucket>();
  await gatherDaily(now, today, daily, cfgs, vacs, buckets);
  await gatherWeekly(now, weekly, cfgs, vacs, buckets);
  if (buckets.size === 0) return { operations: openOps.size, candidates: 0, sent: 0, failed: 0 };

  // Resolve assistant contact details (active only, must have an email).
  const assistants = await prisma.assistant.findMany({
    where: { id: { in: [...buckets.keys()] }, active: true },
    select: { id: true, name: true, email: true, operationId: true },
  });
  const url = new URL("/my", process.env.AUTH_URL ?? "http://localhost:3000").toString();

  let sent = 0;
  let failed = 0;
  let candidates = 0;
  for (const a of assistants) {
    const bucket = buckets.get(a.id);
    if (!bucket || bucket.tasks.length === 0) continue;
    if (!a.email?.trim()) continue;
    candidates++;
    // Earliest deadline first, so the email reads in urgency order.
    bucket.tasks.sort((x, y) => x.deadline.getTime() - y.deadline.getTime());
    if (dryRun) {
      sent++; // "would send"
      continue;
    }
    const sender = await resolveOperationSender(a.operationId);
    if (!sender) {
      failed++;
      continue;
    }
    const { html, text } = reminderEmail({ brandName: sender.fromName, name: a.name, tasks: bucket.tasks, url });
    const res = await sendEmail({
      to: a.email,
      toName: a.name,
      subject: `${sender.fromName}: ${bucket.tasks.length} task${
        bucket.tasks.length === 1 ? "" : "s"
      } due tonight`,
      html,
      text,
      fromEmail: sender.fromEmail,
      fromName: sender.fromName,
      replyTo: sender.replyTo,
    });
    if (res.ok) sent++;
    else failed++;
  }
  return { operations: openOps.size, candidates, sent, failed };
}
