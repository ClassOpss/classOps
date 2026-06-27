"use client";

import { useActionState } from "react";
import { createTopic, type FormState as TopicState } from "@/actions/topics";
import { addPlanItem, type FormState as PlanState } from "@/actions/lesson-plan";

const inputCls = "input";
const btnCls = "btn-primary";

export function AddTopicForm({ yearGroup }: { yearGroup: string }) {
  const action = createTopic.bind(null, yearGroup);
  const [state, formAction, pending] = useActionState<TopicState, FormData>(action, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="flex-1">
        <label className="label">Topic title</label>
        <input name="title" required placeholder={`New ${yearGroup} topic`} className={inputCls} />
      </div>
      <div>
        <label className="label">Chapter (optional)</label>
        <input name="chapter" className={inputCls} />
      </div>
      <button type="submit" disabled={pending} className={btnCls}>
        {pending ? "Adding…" : "Add topic"}
      </button>
      {state?.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="w-full text-sm text-success">Topic added.</p> : null}
    </form>
  );
}

export function AddPlanItemForm({
  yearGroup,
  topics,
}: {
  yearGroup: string;
  topics: { id: string; title: string }[];
}) {
  const action = addPlanItem.bind(null, yearGroup);
  const [state, formAction, pending] = useActionState<PlanState, FormData>(action, undefined);

  if (topics.length === 0) {
    return <p className="text-sm text-muted">Add some topics first.</p>;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="block flex-1">
        <span className="label">Add lesson (topic)</span>
        <select name="topicId" required defaultValue="" className={inputCls}>
          <option value="" disabled>Select a topic…</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className={btnCls}>
        {pending ? "Adding…" : "Add to plan"}
      </button>
      {state?.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
