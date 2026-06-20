import { NextResponse } from "next/server";
import { detectLateIncidents } from "@/lib/late-incidents";

export const runtime = "nodejs";

// Railway cron hits this at 9pm daily and 9pm Saturday (weekly:true). Protected by CRON_SECRET.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { weekly?: boolean; date?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine (daily run)
  }

  // `date` (ISO) overrides "now" for testing/backfill; otherwise use the current time.
  const now = body.date ? new Date(body.date) : new Date();
  const weekly = body.weekly === true;

  const result = await detectLateIncidents(now, weekly);
  return NextResponse.json({ ok: true, weekly, ...result });
}
