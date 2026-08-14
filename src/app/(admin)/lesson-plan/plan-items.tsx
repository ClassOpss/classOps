"use client";

import { useState, useTransition } from "react";
import { reorderPlanItems, removePlanItem } from "@/actions/lesson-plan";

type Item = { id: string; title: string };

// Drag-and-drop reordering (native HTML5 DnD, live reorder on drag-over, commit on drop).
export function PlanItems({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    setItems((cur) => {
      const from = cur.findIndex((i) => i.id === dragId);
      const to = cur.findIndex((i) => i.id === overId);
      if (from < 0 || to < 0) return cur;
      const next = [...cur];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function commit() {
    if (!dragId) return;
    setDragId(null);
    start(() => reorderPlanItems(items.map((i) => i.id)));
  }

  return (
    <ol className={`divide-y divide-border ${pending ? "opacity-70" : ""}`}>
      {items.map((item, idx) => (
        <li
          key={item.id}
          draggable
          onDragStart={() => setDragId(item.id)}
          onDragOver={(e) => onDragOver(e, item.id)}
          onDrop={commit}
          onDragEnd={commit}
          className={`flex items-center gap-3 px-5 py-2.5 text-sm ${dragId === item.id ? "opacity-40" : ""}`}
        >
          <span className="cursor-grab select-none text-base leading-none text-faint hover:text-muted" title="Drag to reorder">
            ⠿
          </span>
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-softfg">
            {idx + 1}
          </span>
          <span className="flex-1">{item.title}</span>
          <form action={removePlanItem.bind(null, item.id)}>
            <button type="submit" className="font-medium text-danger hover:underline">Remove</button>
          </form>
        </li>
      ))}
    </ol>
  );
}
