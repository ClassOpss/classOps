// TEMP EMOJI DIAGNOSTIC — public, no auth. Emits the same emoji built several
// ways so we can hexdump the RAW BYTES the Railway server actually serves and
// see which construction survives the prod build/runtime. DELETE AFTER.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const fc = String.fromCodePoint;
  const dec = decodeURIComponent;

  const lines = [
    "VERSION: emoji-diag-1",
    "",
    "check  literal:✅  fromCodePoint:" + fc(0x2705) + "  decodeURI:" + dec("%E2%9C%85"),
    "star   literal:🤩  fromCodePoint:" + fc(0x1f929) + "  decodeURI:" + dec("%F0%9F%A4%A9"),
    "heart  literal:💗  fromCodePoint:" + fc(0x1f497) + "  decodeURI:" + dec("%F0%9F%92%97"),
    "grad   literal:🎓  fromCodePoint:" + fc(0x1f393) + "  decodeURI:" + dec("%F0%9F%8E%93"),
    "rsquo  literal:’  fromCodePoint:" + fc(0x2019) + "  decodeURI:" + dec("%E2%80%99"),
    "mdash  literal:—  fromCodePoint:" + fc(0x2014) + "  decodeURI:" + dec("%E2%80%94"),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
