"use client";

import { useActionState, useState } from "react";
import { addPastSession, type FormState } from "@/actions/sessions";

const inputCls = "input";

export function AddPastSessionForm({
  classId,
  topics,
  today,
}: {
  classId: string;
  topics: { id: string; title: string }[];
  today: string; // yyyy-mm-dd, Cairo
}) {
  const action = addPastSession.bind(null, classId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const [topicId, setTopicId] = useState("");
  const [customTopic, setCustomTopic] = useState("");

  return (
    <details className="card p-3.5">
      <summary className="cursor-pointer text-sm font-semibold">Add a past session</summary>
      <p className="mt-1 text-sm text-muted">
        For a makeup or extra class that happened on a day that wasn&apos;t scheduled. It becomes a
        session you can log attendance and homework for.
      </p>
      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <label className="block">
          <span className="label">Date it happened</span>
          <input type="date" name="date" max={today} required className={`${inputCls} w-auto`} />
        </label>

        <label className="block">
          <span className="label">Topic covered</span>
          <select
            name="topicId"
            value={topicId}
            onChange={(e) => { setTopicId(e.target.value); if (e.target.value) setCustomTopic(""); }}
            disabled={customTopic.trim() !== ""}
            className={inputCls}
          >
            <option value="">—</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Or type a topic not in the plan</span>
          <input
            name="customTopic"
            value={customTopic}
            onChange={(e) => { setCustomTopic(e.target.value); if (e.target.value.trim()) setTopicId(""); }}
            placeholder="e.g. Makeup — Revision session"
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="label">Note (optional)</span>
          <input name="notes" placeholder="anything worth recording" className={inputCls} />
        </label>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="btn-primary self-start">
            {pending ? "Adding…" : "Add session"}
          </button>
          {state?.ok ? <span className="text-sm text-success">Session added.</span> : null}
          {state?.error ? <span className="text-sm text-danger">{state.error}</span> : null}
        </div>
      </form>
    </details>
  );
}
