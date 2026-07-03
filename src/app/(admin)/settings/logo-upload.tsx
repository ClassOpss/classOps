"use client";

import { useActionState, useRef, useState } from "react";
import { uploadLogo, type BrandingState } from "@/actions/branding";

export function LogoUpload() {
  const [state, action, pending] = useActionState<BrandingState, FormData>(uploadLogo, undefined);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn-secondary btn-sm"
        >
          Choose image
        </button>
        <span className="text-sm text-muted">{fileName ?? "PNG, JPG, WEBP or SVG · max 1 MB"}</span>
        <input
          ref={inputRef}
          type="file"
          name="logo"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || !fileName} className="btn-primary btn-sm">
          {pending ? "Uploading…" : "Upload logo"}
        </button>
        {state?.error && <span className="text-sm text-danger">{state.error}</span>}
        {state?.ok && <span className="text-sm text-success">Logo updated ✓</span>}
      </div>
    </form>
  );
}
