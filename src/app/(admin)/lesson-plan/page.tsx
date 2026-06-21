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
        <h1 className="text-xl font-semibold">Lesson Plan</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          One shared plan per year group. Classes generate their dated sessions from it.
        </p>
      </div>

      <nav className="flex gap-2">
        {YEAR_GROUPS.map((g) => (
          <Link
            key={g}
            href={`/lesson-plan?yg=${g}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              g === yearGroup
                ? "bg-foreground text-background"
                : "border border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            }`}
          >
            {g}
          </Link>
        ))}
      </nav>

      <section>
        <h2 className="mb-3 font-medium">{yearGroup} plan ({items.length} lessons)</h2>
        {items.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">No lessons yet — add topics below.</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {items.map((item, idx) => (
              <li
                key={item.id}
                className="flex items-center gap-3 border-b border-black/5 py-2 text-sm dark:border-white/5"
              >
                <span className="w-6 text-black/40">{idx + 1}</span>
                <span className="flex-1">{item.topic?.title ?? "— (topic deleted)"}</span>
                <form action={movePlanItem.bind(null, item.id, "up")}>
                  <button type="submit" disabled={idx === 0} className="px-1 text-black/50 disabled:opacity-30 hover:text-black dark:hover:text-white">↑</button>
                </form>
                <form action={movePlanItem.bind(null, item.id, "down")}>
                  <button type="submit" disabled={idx === items.length - 1} className="px-1 text-black/50 disabled:opacity-30 hover:text-black dark:hover:text-white">↓</button>
                </form>
                <form action={removePlanItem.bind(null, item.id)}>
                  <button type="submit" className="text-red-600 hover:underline">Remove</button>
                </form>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-4">
          <AddPlanItemForm yearGroup={yearGroup} topics={topics} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-medium">{yearGroup} topics ({topics.length})</h2>
        {topics.length > 0 && (
          <ul className="mb-4 flex flex-col gap-1">
            {topics.map((t) => (
              <li key={t.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1">
                  {t.title}
                  {t.chapter ? <span className="text-black/40"> · {t.chapter}</span> : null}
                </span>
                <form action={deleteTopic.bind(null, t.id)}>
                  <button type="submit" className="text-red-600 hover:underline">Delete</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <AddTopicForm yearGroup={yearGroup} />
      </section>
    </div>
  );
}
