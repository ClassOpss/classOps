"use client";

import { useState } from "react";

// "Copy message" button that flips to "Copied!" for 2s. The message stays visible in a
// <pre> next to it so it can always be copied manually if the clipboard is blocked.
export function CopyMessage({ message, label = "Copy message", className = "btn-primary btn-sm self-start" }: {
  message: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(message);
        } catch {
          /* clipboard may be blocked; the message is shown for manual copy */
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={className}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
