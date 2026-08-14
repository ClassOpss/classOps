// Sends a sample teacher-invite + assistant-invite email to confirm Brevo delivery.
//   PowerShell:  npx tsx scripts/test-email.ts
// Uses BREVO_API_KEY + BREVO_SENDER_EMAIL from .env.
const KEY = process.env.BREVO_API_KEY!;
const FROM = process.env.BREVO_SENDER_EMAIL!;
const TO = "jana.meriden2005@gmail.com";
const BRAND = "Math by Mo";

function actionEmail(heading: string, intro: string, buttonLabel: string, url: string) {
  return `<!doctype html><html><body style="margin:0;background:#f7f8fa;padding:24px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f1729">
  <table role="presentation" width="100%"><tr><td align="center">
    <table role="presentation" width="480" style="max-width:480px;background:#fff;border:1px solid #e8eaed;border-radius:14px;overflow:hidden">
      <tr><td style="padding:22px 28px;border-bottom:1px solid #e8eaed;font-weight:700;font-size:16px">${BRAND}</td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 10px;font-size:20px">${heading}</h1>
        <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#5b6472">${intro}</p>
        <a href="${url}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:9px">${buttonLabel}</a>
        <p style="margin:22px 0 0;font-size:12px;color:#98a1ae;word-break:break-all">Or paste this link:<br>${url}</p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:11px;color:#98a1ae">Sent by ${BRAND} via ClassOps</p>
  </td></tr></table></body></html>`;
}

async function send(subject: string, html: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: FROM, name: BRAND },
      to: [{ email: TO }],
      subject,
      htmlContent: html,
    }),
  });
  console.log(subject, "->", res.status, res.ok ? "SENT ✓" : await res.text());
}

async function main() {
  const url = "https://classops-production.up.railway.app/set-password?email=demo@x.com&token=SAMPLE";
  await send(
    "Set up your Math by Mo account",
    actionEmail("Welcome to Math by Mo", "Your Math by Mo account on ClassOps is ready. Set your password to sign in.", "Set your password", url),
  );
  await send(
    "Set up your Math by Mo assistant account",
    actionEmail("You've been invited as an assistant", "You've been added as an assistant on Math by Mo. Set your password to get started.", "Set your password", url),
  );
}
main();
