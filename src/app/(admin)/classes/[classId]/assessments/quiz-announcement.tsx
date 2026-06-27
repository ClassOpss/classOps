"use client";

import { useState } from "react";

export function QuizAnnouncement({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="link">
        {open ? "Hide announcement" : "Quiz announcement"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <pre className="whitespace-pre-wrap rounded-lg border border-border bg-card-muted p-3 text-xs">
            {message}
          </pre>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(message);
              } catch {
                /* clipboard may be blocked; message is visible to copy manually */
              }
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="btn-primary btn-sm self-start"
          >
            {copied ? "Copied!" : "Copy message"}
          </button>
        </div>
      )}
    </div>
  );
}
