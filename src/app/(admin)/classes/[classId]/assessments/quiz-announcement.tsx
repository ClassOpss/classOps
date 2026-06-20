"use client";

import { useState } from "react";

export function QuizAnnouncement({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-blue-600 hover:underline"
      >
        {open ? "Hide announcement" : "Quiz announcement"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <pre className="whitespace-pre-wrap rounded-md border border-black/10 bg-black/[.03] p-3 text-xs dark:border-white/10 dark:bg-white/[.04]">
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
            className="self-start rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
          >
            {copied ? "Copied!" : "Copy message"}
          </button>
        </div>
      )}
    </div>
  );
}
