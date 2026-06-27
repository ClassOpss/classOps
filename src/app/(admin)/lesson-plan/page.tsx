import Link from "next/link";
import type { YearGroup } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { YEAR_GROUPS } from "@/lib/constants";
import { currentOperationId } from "@/lib/operation";
import { movePlanItem, removePlanItem } from "@/actions/lesson-plan";
import { deleteTopic } from "@/actions/topics";
import { AddTopicForm, AddPlanItemForm } from "./lesson-plan-forms";

export default async function LessonPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ yg?: string }>;
}) {
  await requireRole("admin", "teacher");
  const { yg } = await searchParams;
  const yearGroup = (YEAR_GROUPS as readonly string[]).includes(yg ?? "")
    ? (yg as YearGroup)
    : "Y9";

  const operationId = await currentOperationId();
  const [topics, plan] = await Promise.all([
    prisma.topic.findMany({
      where: { operationId, yearGroup },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, chapter: true },
    }),
    prisma.lessonPlan.findUnique({
      where: { operationId_yearGroup: { operationId, yearGroup } },
      include: {
        items: { orderBy: { sequence: "asc" }, include: { topic: { select: { title: true } } } },
      },
    }),
  ]);
  const items = plan?.items ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="page-title">Lesson Plan</h1>
        <p className="page-subtitle">
          One shared plan per year group. Classes generate their dated sessions from it.
        </p>
      </div>

      <nav className="inline-flex w-fit gap-1 rounded-lg border border-border bg-card p-1">
        {YEAR_GROUPS.map((g) => (
          <Link
            key={g}
            href={`/lesson-plan?yg=${g}`}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
              g === yearGroup
                ? "bg-brand text-brand-fg"
                : "text-muted hover:bg-card-muted hover:text-fg"
            }`}
          >
            {g}
          </Link>
        ))}
      </nav>

      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">{yearGroup} plan ({items.length} lessons)</h2>
        </div>
        {items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No lessons yet — add topics below.</p>
        ) : (
          <ol className="divide-y divide-border">
            {items.map((item, idx) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-softfg">
                  {idx + 1}
                </span>
                <span className="flex-1">{item.topic?.title ?? "— (topic deleted)"}</span>
                <form action={movePlanItem.bind(null, item.id, "up")}>
                  <button type="submit" disabled={idx === 0} className="px-1 text-muted disabled:opacity-30 hover:text-fg">↑</button>
                </form>
                <form action={movePlanItem.bind(null, item.id, "down")}>
                  <button type="submit" disabled={idx === items.length - 1} className="px-1 text-muted disabled:opacity-30 hover:text-fg">↓</button>
                </form>
                <form action={removePlanItem.bind(null, item.id)}>
                  <button type="submit" className="font-medium text-danger hover:underline">Remove</button>
                </form>
              </li>
            ))}
          </ol>
        )}
        <div className="border-t border-border px-5 py-4">
          <AddPlanItemForm yearGroup={yearGroup} topics={topics} />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">{yearGroup} topics ({topics.length})</h2>
        </div>
        {topics.length > 0 && (
          <ul className="divide-y divide-border">
            {topics.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className="flex-1">
                  {t.title}
                  {t.chapter ? <span className="text-faint"> · {t.chapter}</span> : null}
                </span>
                <form action={deleteTopic.bind(null, t.id)}>
                  <button type="submit" className="font-medium text-danger hover:underline">Delete</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-border px-5 py-4">
          <AddTopicForm yearGroup={yearGroup} />
        </div>
      </section>
    </div>
  );
}
