"use client";

import { useState } from "react";
import { normalizePhone, waLink } from "@/lib/invites";

// Sends a student's PDF report to the parent over WhatsApp.
//
// wa.me links can't carry attachments, so:
//  • Devices that can share files (phones): fetch the PDF and open the native
//    share sheet with the PDF + message as caption — pick WhatsApp → the parent.
//  • Everything else (laptops): download the PDF and open the parent's chat with
//    the message pre-filled — attach the downloaded file and send.
//
// Some browsers (iOS Safari) drop the tap's "user gesture" while the PDF is
// fetching, which makes share() throw NotAllowedError. In that case we keep the
// fetched file and ask for a second tap to share it.
export function SendReportPdf({
  pdfHref,
  filename,
  phone,
  message,
  label = "Report → parent",
  className = "btn-secondary btn-sm",
}: {
  pdfHref: string;
  filename: string;
  phone: string | null | undefined;
  message: string;
  label?: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "downloaded" | "error">("idle");
  const [file, setFile] = useState<File | null>(null);

  if (!normalizePhone(phone)) return null;

  async function share(f: File): Promise<boolean> {
    try {
      await navigator.share({ files: [f], text: message });
      setStatus("idle");
      setFile(null);
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setStatus("idle"); // user closed the share sheet
        return true;
      }
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setFile(f);
        setStatus("ready"); // needs a fresh tap
        return true;
      }
      return false;
    }
  }

  function downloadAndOpenChat(f: File) {
    const url = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    window.open(waLink(phone, message)!, "_blank", "noopener,noreferrer");
    setStatus("downloaded");
    setTimeout(() => setStatus("idle"), 6000);
  }

  async function onClick() {
    if (status === "ready" && file) {
      await share(file);
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch(pdfHref);
      if (!res.ok) throw new Error(String(res.status));
      const f = new File([await res.blob()], filename, { type: "application/pdf" });
      const canShareFile =
        typeof navigator.canShare === "function" &&
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) &&
        navigator.canShare({ files: [f] });
      if (canShareFile && (await share(f))) return;
      downloadAndOpenChat(f);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  const text =
    status === "loading" ? "Preparing PDF…"
    : status === "ready" ? "Tap to share PDF"
    : status === "downloaded" ? "PDF downloaded — attach it in chat"
    : status === "error" ? "Couldn't load PDF"
    : label;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={status === "loading"}
      className={className}
      title="Phones: shares the PDF via WhatsApp. Laptops: downloads the PDF and opens the parent's chat — attach the file and send."
    >
      {text}
    </button>
  );
}
