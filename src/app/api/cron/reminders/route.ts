import { NextResponse } from "next/server";
import { sendDeadlineReminders } from "@/lib/reminders";

export const runtime = "nodejs";

// Railway cron hits this HOURLY (0 * * * *). Each operation is emailed only in the single
// hour that falls REMINDER_LEAD_HOURS before its own deadline hour, so most runs are no-ops.
// Protected by CRON_SECRET. Body: { force?: boolean, dryRun?: boolean, date?: ISO } — `date`
// overrides "now", `force` ignores the time-of-day window, `dryRun` reports recipients
// without emailing (all for testing).
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { force?: boolean; dryRun?: boolean; date?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine (normal hourly run)
  }

  const now = body.date ? new Date(body.date) : new Date();
  const result = await sendDeadlineReminders(now, { force: body.force === true, dryRun: body.dryRun === true });
  return NextResponse.json({ ok: true, ...result });
}
