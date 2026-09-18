"use client";

import { useActionState, useEffect, useState } from "react";
import { saveLessonDetails, type FormState } from "@/actions/lesson-details";

const inputCls = "input";

export type LessonDetails = {
  topicId: string;
  customTopic: string;
  homework: string;
  deadline: string; // yyyy-mm-dd
  noHomework: boolean;
  notes: string;
};

export function LessonDetailsForm({
  sessionId,
  topics,
  current,
}: {
  sessionId: string;
  topics: { id: string; title: string }[];
  current: LessonDetails;
}) {
  const action = saveLessonDetails.bind(null, sessionId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  // Controlled fields. React 19 auto-resets uncontrolled inputs after a form
  // action resolves — with defaultValue that would snap back to the pre-save
  // value before the revalidated props arrive. Controlling them keeps the
  // chosen value, and the effect below re-syncs to the persisted server value
  // whenever it changes (e.g. a server-computed homework deadline).
  const [topicId, setTopicId] = useState(current.topicId);
  const [customTopic, setCustomTopic] = useState(current.customTopic);
  const [homework, setHomework] = useState(current.homework);
  const [deadline, setDeadline] = useState(current.deadline);
  const [noHomework, setNoHomework] = useState(current.noHomework);
  const [notes, setNotes] = useState(current.notes);

  useEffect(() => {
    setTopicId(current.topicId);
    setCustomTopic(current.customTopic);
    setHomework(current.homework);
    setDeadline(current.deadline);
    setNoHomework(current.noHomework);
    setNotes(current.notes);
  }, [current.topicId, current.customTopic, current.homework, current.deadline, current.noHomework, current.notes]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
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
          placeholder="e.g. Revision — mixed past-paper questions"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="label">Homework</span>
        <input
          name="homework"
          value={homework}
          onChange={(e) => setHomework(e.target.value)}
          placeholder="e.g. Exercise 4B, Q1–10"
          className={inputCls}
        />
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label">Due date</span>
          <input
            type="date"
            name="homeworkDeadline"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex items-center gap-2 py-2 text-sm">
          <input
            type="checkbox"
            name="noHomework"
            checked={noHomework}
            onChange={(e) => setNoHomework(e.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          No homework given
        </label>
      </div>

      <label className="block">
        <span className="label">Quiz / announcement / notes</span>
        <textarea
          name="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Quiz next session on Indices"
          className={inputCls}
        />
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-secondary">
          {pending ? "Saving…" : "Save lesson details"}
        </button>
        {state?.ok ? <span className="text-sm text-success">Saved.</span> : null}
        {state?.error ? <span className="text-sm text-danger">{state.error}</span> : null}
      </div>
    </form>
  );
}
