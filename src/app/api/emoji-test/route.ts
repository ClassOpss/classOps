// TEMP EMOJI DIAGNOSTIC — public, no auth. Serves an HTML page with several
// WhatsApp deep-link formats so we can find which one delivers emoji intact on
// the user's device. DELETE AFTER.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const msg = "Emoji test " + String.fromCodePoint(0x1f497) + String.fromCodePoint(0x2705) + String.fromCodePoint(0x1f929) + " end";
  const enc = encodeURIComponent(msg);          // standard percent-encoding
  const num = "201000000000";                   // dummy number; picker still opens

  // Variant links (each carries the same message, different transport)
  const variants: [string, string][] = [
    ["A) wa.me/<num>?text= (encodeURIComponent) — CURRENT", `https://wa.me/${num}?text=${enc}`],
    ["B) wa.me/?text= share picker (encodeURIComponent)", `https://wa.me/?text=${enc}`],
    ["C) api.whatsapp.com/send?text= (encodeURIComponent)", `https://api.whatsapp.com/send?phone=${num}&text=${enc}`],
    ["D) whatsapp://send?text= (app scheme, encodeURIComponent)", `whatsapp://send?phone=${num}&text=${enc}`],
    ["E) wa.me/<num>?text= with RAW emoji (spaces->%20 only)", `https://wa.me/${num}?text=${msg.replace(/ /g, "%20")}`],
  ];

  const rows = variants
    .map(
      ([label, href]) =>
        `<li style="margin:14px 0"><div style="font-size:13px;color:#555;margin-bottom:6px">${label}</div>` +
        `<a href="${href}" style="display:inline-block;padding:12px 16px;background:#25D366;color:#fff;border-radius:8px;text-decoration:none;font-size:16px">Open in WhatsApp</a></li>`,
    )
    .join("");

  const html =
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<body style="font-family:system-ui,sans-serif;max-width:520px;margin:24px auto;padding:0 16px">` +
    `<h2>WhatsApp emoji link test</h2>` +
    `<p>The message being sent is:</p>` +
    `<pre style="background:#f3f3f3;padding:12px;border-radius:8px;font-size:18px">${msg}</pre>` +
    `<p>Tap each button, look at the message WhatsApp pre-fills, and note which show the emoji vs a box:</p>` +
    `<ol style="list-style:none;padding:0">${rows}</ol>` +
    `</body>`;

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
