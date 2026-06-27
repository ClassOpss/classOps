"use client";

import { useState } from "react";

export function CopyMessage({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // clipboard may be blocked; the message is still visible to copy manually
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={copied ? "btn-secondary" : "btn-primary"}
    >
      {copied ? "Copied!" : "Copy message"}
    </button>
  );
}
