"use client";

import { useActionState } from "react";
import { setClassLinks } from "@/actions/classes";
import type { FormState } from "@/actions/classes";

export function ClassLinksForm({
  classId,
  showClassroom = true,
  defaults,
}: {
  classId: string;
  showClassroom?: boolean;
  defaults: { googleClassroomLink: string; studentGroupLink: string; parentCommunityLink: string };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    setClassLinks.bind(null, classId),
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {showClassroom ? (
        <Field
          name="googleClassroomLink"
          label="Google Classroom invite link"
          hint="Classroom → your class → Settings → invite/class link."
          defaultValue={defaults.googleClassroomLink}
          placeholder="https://classroom.google.com/c/…"
        />
      ) : (
        <p className="rounded-lg bg-card-muted px-3 py-2 text-sm text-muted">
          This class uses <span className="font-medium">IE Learn</span> — no Google Classroom invites are sent.
        </p>
      )}
      <Field
        name="studentGroupLink"
        label="Student WhatsApp group link"
        hint="WhatsApp group → Invite via link."
        defaultValue={defaults.studentGroupLink}
        placeholder="https://chat.whatsapp.com/…"
      />
      <Field
        name="parentCommunityLink"
        label="Parents community link"
        hint="WhatsApp community → members → invite link."
        defaultValue={defaults.parentCommunityLink}
        placeholder="https://chat.whatsapp.com/…"
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary btn-sm">
          {pending ? "Saving…" : "Save links"}
        </button>
        {state?.ok && <span className="text-sm text-success">Saved ✓</span>}
        {state?.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  hint,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  hint: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={defaultValue} placeholder={placeholder} className="input" />
      <p className="field-hint">{hint}</p>
    </div>
  );
}
