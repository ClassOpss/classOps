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
      className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
    >
      {copied ? "Copied!" : "Copy message"}
    </button>
  );
}
