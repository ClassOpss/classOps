// Message B — Quiz Announcement (spec 5.13). Triggered by teacher/admin from an assessment.
import { OPERATION_DEFAULTS } from "@/lib/config";
import { weekdayName } from "@/lib/quiz";

export type QuizAnnouncementData = {
  dateLabel: string;
  timeLabel?: string | null;
  topics: string[];
  // Assessment type (quiz/midterm/past_paper/exam); defaults to quiz.
  type?: string | null;
};

const KIND: Record<string, string> = { quiz: "quiz", midterm: "midterm", past_paper: "past paper", exam: "exam" };

export function assessmentKind(type?: string | null): string {
  return KIND[type ?? "quiz"] ?? "quiz";
}

const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// "16:00" -> "4:00 PM"
export function friendlyTime(hhmm?: string | null): string | null {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// Split free-text topic notes into individual lines.
export function topicsFromNotes(topicNotes?: string | null, topicTitle?: string | null): string[] {
  if (topicNotes) {
    return topicNotes
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return topicTitle ? [topicTitle] : [];
}

export function buildQuizAnnouncement(
  d: QuizAnnouncementData,
  signature: string = OPERATION_DEFAULTS.brandSignature,
): string {
  const kind = assessmentKind(d.type);
  const lines: string[] = [];
  lines.push(`*${cap(kind)} Announcement*`);
  lines.push("Good Afternoon Parents & Students,");
  const when = d.timeLabel ? `${d.dateLabel} at ${d.timeLabel}` : d.dateLabel;
  lines.push(`Just a quick reminder that we'll be having a${/^[aeiou]/.test(kind) ? "n" : ""} ${kind} on ${when}.`);
  lines.push("It will cover:");
  if (d.topics.length > 0) {
    for (const t of d.topics) lines.push(`- ${t}`);
  } else {
    lines.push("- (topics to be confirmed)");
  }
  lines.push(
    kind === "quiz"
      ? "The quiz will be short and focused, so students are encouraged to revise their notes, homework, and correction videos."
      : "Students are encouraged to revise their notes, homework, and correction videos.",
  );
  lines.push("Always feel free to share any questions or concerns, we're always here!");
  lines.push("We'll also share results in the monthly report so you can track progress.");
  lines.push("Best of luck to everyone!");
  lines.push(`*${signature}*`);
  return lines.join("\n");
}

// "Monday – 19/1/2026" for a UTC-midnight @db.Date quiz date.
export function quizDateLabel(date: Date): string {
  return `${weekdayName(date)} – ${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
}

// The quiz-task announcement message built from a cycle's actual date + coverage text (plus
// the linked assessment's type + time when it has one).
export function buildBiweeklyQuizAnnouncement(opts: {
  date: Date;
  coverage?: string | null;
  type?: string | null;
  time?: string | null;
  signature?: string;
}): string {
  return buildQuizAnnouncement(
    {
      dateLabel: quizDateLabel(opts.date),
      timeLabel: friendlyTime(opts.time),
      topics: topicsFromNotes(opts.coverage),
      type: opts.type,
    },
    opts.signature ?? OPERATION_DEFAULTS.brandSignature,
  );
}
