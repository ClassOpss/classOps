"use client";

import { useActionState } from "react";
import { addClassLesson, updateFutureFromPlan, type FormState } from "@/actions/sessions";

type TopicOption = { id: string; title: string; chapter: string | null };
type UpcomingOption = { id: string; label: string };

// Feature A — add a lesson to THIS class only, pushing the rest of the future back a slot.
export function AddClassLesson({
  classId,
  topics,
  upcoming,
}: {
  classId: string;
  topics: TopicOption[];
  upcoming: UpcomingOption[];
}) {
  const action = addClassLesson.bind(null, classId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <section className="card flex flex-col gap-3 p-5">
      <div>
        <h2 className="text-sm font-semibold">Add a class-specific lesson</h2>
        <p className="mt-1 text-xs text-muted">
          For this class only — e.g. it&apos;s behind, or a topic needs more time. The new lesson
          slots in and every following upcoming session moves back one slot. It never appears in
          other classes&apos; schedules.
        </p>
      </div>
      <form action={formAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Topic
          <select name="topicId" required defaultValue="" className="input">
            <option value="" disabled>
              Choose a topic…
            </option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.chapter ? `${t.chapter} · ${t.title}` : t.title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Insert
          <select name="position" defaultValue="end" className="input">
            <option value="end">At the end</option>
            {upcoming.map((u) => (
              <option key={u.id} value={u.id}>
                Before: {u.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Note (optional)
          <input
            name="notes"
            placeholder="e.g. extra practice on simultaneous equations"
            className="input"
          />
        </label>

        <button type="submit" disabled={pending} className="btn-primary self-start">
          {pending ? "Adding…" : "Add lesson"}
        </button>
        {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        {state?.ok ? <p className="text-sm text-success">Lesson added.</p> : null}
      </form>
    </section>
  );
}

// Feature B — re-sync the undelivered future from the (edited) year-group plan. Delivered
// sessions, day-offs, and class-specific lessons are kept; only upcoming plan sessions rebuild.
export function UpdateFutureFromPlan({ classId }: { classId: string }) {
  const action = updateFutureFromPlan.bind(null, classId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <section className="card flex flex-col gap-3 p-5">
      <div>
        <h2 className="text-sm font-semibold">Update future from plan</h2>
        <p className="mt-1 text-xs text-muted">
          Use after a mid-year syllabus change. Keeps everything already delivered (and any
          day-offs or class-specific lessons); only rebuilds the upcoming plan sessions from the
          current {""}
          year-group plan. Safe once attendance has been logged.
        </p>
      </div>
      <form action={formAction}>
        <button type="submit" disabled={pending} className="btn-secondary self-start">
          {pending ? "Updating…" : "Update future sessions"}
        </button>
        {state?.error ? <p className="mt-2 text-sm text-danger">{state.error}</p> : null}
        {state?.ok ? <p className="mt-2 text-sm text-success">Future sessions updated.</p> : null}
      </form>
    </section>
  );
}
