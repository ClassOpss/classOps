"use client";

import { useActionState } from "react";
import { createTopic, type FormState as TopicState } from "@/actions/topics";
import { addPlanItem, type FormState as PlanState } from "@/actions/lesson-plan";

const inputCls =
  "rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent";
const btnCls =
  "rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50";

export function AddTopicForm({ yearGroup }: { yearGroup: string }) {
  const action = createTopic.bind(null, yearGroup);
  const [state, formAction, pending] = useActionState<TopicState, FormData>(action, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-sm">Topic title</label>
        <input name="title" required placeholder={`New ${yearGroup} topic`} className={inputCls} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm">Chapter (optional)</label>
        <input name="chapter" className={inputCls} />
      </div>
      <button type="submit" disabled={pending} className={btnCls}>
        {pending ? "Adding…" : "Add topic"}
      </button>
      {state?.error ? <p className="w-full text-sm text-red-600">{state.error}</p> : null}
      {state?.ok ? <p className="w-full text-sm text-green-600">Topic added.</p> : null}
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
    return <p className="text-sm text-black/50 dark:text-white/50">Add some topics first.</p>;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm">
        Add lesson (topic)
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
      {state?.error ? <p className="w-full text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
