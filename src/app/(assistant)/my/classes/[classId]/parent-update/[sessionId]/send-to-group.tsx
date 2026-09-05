"use client";

import { useState } from "react";

// Owner-sends-to-their-own-class case. WhatsApp group invite links can't carry a
// prefilled message, so we copy the update to the clipboard and open the group —
// the assistant just pastes (Ctrl/Cmd+V) and sends.
export function SendToGroup({ message, groupLink }: { message: string; groupLink: string }) {
  const [copied, setCopied] = useState(false);

  async function copyAndOpen() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked — still open the group so the user isn't stuck.
    }
    window.open(groupLink, "_blank", "noopener,noreferrer");
  }

  return (
    <button type="button" onClick={copyAndOpen} className="btn-primary">
      {copied ? "Copied — paste in group" : "Copy & open group"}
    </button>
  );
}
