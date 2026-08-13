import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";

// Transactional email via Brevo's REST API (no SDK needed — just fetch).

export type EmailResult = { ok: true } | { ok: false; error: string };

export function emailConfigured(): boolean {
  return !!process.env.BREVO_API_KEY && !!process.env.BREVO_SENDER_EMAIL;
}

type SendArgs = {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: { email: string; name?: string } | null;
};

export async function sendEmail(args: SendArgs): Promise<EmailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: false, error: "Email is not configured (BREVO_API_KEY missing)." };
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: args.fromEmail, name: args.fromName },
        to: [{ email: args.to, name: args.toName ?? undefined }],
        replyTo: args.replyTo ?? undefined,
        subject: args.subject,
        htmlContent: args.html,
        textContent: args.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Brevo ${res.status}: ${body.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email send failed." };
  }
}

// A simple branded, responsive HTML email with a single call-to-action button.
export function actionEmail(opts: {
  brandName: string;
  heading: string;
  intro: string;
  buttonLabel: string;
  url: string;
  footer?: string;
}): { html: string; text: string } {
  const { brandName, heading, intro, buttonLabel, url, footer } = opts;
  const html = `<!doctype html><html><body style="margin:0;background:#f7f8fa;padding:24px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f1729">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border:1px solid #e8eaed;border-radius:14px;overflow:hidden">
      <tr><td style="padding:22px 28px;border-bottom:1px solid #e8eaed;font-weight:700;font-size:16px">${brandName}</td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 10px;font-size:20px">${heading}</h1>
        <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#5b6472">${intro}</p>
        <a href="${url}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:9px">${buttonLabel}</a>
        <p style="margin:22px 0 0;font-size:12px;color:#98a1ae;word-break:break-all">Or paste this link into your browser:<br>${url}</p>
        ${footer ? `<p style="margin:18px 0 0;font-size:12px;color:#98a1ae">${footer}</p>` : ""}
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:11px;color:#98a1ae">Sent by ${brandName} via ClassOps</p>
  </td></tr></table></body></html>`;
  const text = `${heading}\n\n${intro}\n\n${buttonLabel}: ${url}\n${footer ?? ""}`.trim();
  return { html, text };
}

// The set of sender emails verified (active) in the Brevo account. Cached per request.
const verifiedSenders = cache(async (): Promise<Set<string>> => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return new Set();
  try {
    const res = await fetch("https://api.brevo.com/v3/senders", {
      headers: { "api-key": apiKey, accept: "application/json" },
    });
    if (!res.ok) return new Set();
    const data = (await res.json()) as { senders?: { email: string; active: boolean }[] };
    return new Set((data.senders ?? []).filter((s) => s.active).map((s) => s.email.toLowerCase()));
  } catch {
    return new Set();
  }
});

// Hybrid sender resolution:
//  - if the operation's sender email is a verified Brevo sender -> send truly from it
//  - else -> send from the platform fallback address, with the operation's brand name
//    as the display name and Reply-To set to the operation's email (so replies reach them)
export async function resolveOperationSender(
  operationId: string,
): Promise<{ fromEmail: string; fromName: string; replyTo: { email: string; name?: string } | null } | null> {
  const fallback = process.env.BREVO_SENDER_EMAIL;
  const op = await prisma.operation.findUnique({
    where: { id: operationId },
    select: { brandName: true, senderEmail: true },
  });
  const brand = op?.brandName ?? process.env.BREVO_SENDER_NAME ?? "ClassOps";
  const own = op?.senderEmail?.trim().toLowerCase() || null;

  if (own && (await verifiedSenders()).has(own)) {
    return { fromEmail: own, fromName: brand, replyTo: null };
  }
  if (!fallback) return null; // nothing verified to send from
  return { fromEmail: fallback, fromName: brand, replyTo: own ? { email: own, name: brand } : null };
}
