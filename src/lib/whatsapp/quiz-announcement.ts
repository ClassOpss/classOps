// Message B — Quiz Announcement (spec 5.13). Triggered by teacher/admin from an assessment.
import { OPERATION_DEFAULTS } from "@/lib/config";

export type QuizAnnouncementData = {
  dateLabel: string;
  timeLabel?: string | null;
  topics: string[];
};

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
  const lines: string[] = [];
  lines.push("*Quiz Announcement*");
  lines.push("Good Afternoon Parents & Students,");
  const when = d.timeLabel ? `${d.dateLabel} at ${d.timeLabel}` : d.dateLabel;
  lines.push(`Just a quick reminder that we'll be having a quiz on ${when}.`);
  lines.push("It will cover:");
  if (d.topics.length > 0) {
    for (const t of d.topics) lines.push(`- ${t}`);
  } else {
    lines.push("- (topics to be confirmed)");
  }
  lines.push(
    "The quiz will be short and focused, so students are encouraged to revise their notes, homework, and correction videos.",
  );
  lines.push("Always feel free to share any questions or concerns, we're always here!");
  lines.push("We'll also share results in the monthly report so you can track progress.");
  lines.push("Best of luck to everyone!");
  lines.push(`*${signature}*`);
  return lines.join("\n");
}
