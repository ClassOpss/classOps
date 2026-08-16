"use client";

import { useEffect, useState } from "react";
import { normalizePhone, waLink } from "@/lib/invites";

// One-tap WhatsApp send that stays reliable on every device.
//
// WhatsApp *Desktop/Web* corrupts emoji passed through a click-to-send link
// (wa.me ?text=) — it mangles them into "□"/"�" and then sends the mangled
// text. Phones handle the same link perfectly. So when (and only when) the
// message contains emoji AND the sender is on a laptop, we switch to a
// "copy + open chat" flow: pasting into WhatsApp Web preserves emoji intact.
// Every other case keeps the plain one-tap link (no behaviour change).
const EMOJI_RE = /\p{Extended_Pictographic}/u;

export function WhatsAppSend({
  phone,
  message,
  label = "WhatsApp",
  className = "btn-secondary btn-sm",
}: {
  phone: string | null | undefined;
  message: string;
  label?: string;
  className?: string;
}) {
  // null until mounted; we can't read navigator during SSR / first render.
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const mobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone|IEMobile|BlackBerry/i.test(
      navigator.userAgent,
    );
    setIsDesktop(!mobile);
  }, []);

  const digits = normalizePhone(phone);
  if (!digits) return null;

  const hasEmoji = EMOJI_RE.test(message);

  // Default (mobile, unknown-yet, or no-emoji message): the normal one-tap link.
  // Only a KNOWN desktop with an emoji message takes the copy path — so the
  // initial render always matches SSR (link), avoiding a hydration mismatch.
  if (!(isDesktop === true && hasEmoji)) {
    return (
      <a href={waLink(phone, message)!} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    );
  }

  async function copyAndOpen() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked — still open the chat so the user isn't stuck.
    }
    window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={copyAndOpen}
      className={className}
      title="WhatsApp Desktop garbles emoji in auto-filled links — this copies the message (emoji intact) and opens the chat. Just paste (Ctrl+V) and send."
    >
      {copied ? "Copied — paste in chat" : `${label} (copy)`}
    </button>
  );
}
