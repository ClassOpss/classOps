import "server-only";
import { prisma } from "@/lib/db";
import { monthWindow } from "@/lib/pay";
import { looZ } from "@/lib/trend";
import { letterFor, parseBoundaries } from "@/lib/grade-boundaries";
import {
  classifyTrend,
  markBiggestImprover,
  GROUP_ORDER,
  type Classified,
  type TrendGroup,
  type TrendPoint,
} from "@/lib/class-trend-classify";

// Class trend table: every assessment (mocks/diagnostics included — they're often the most
// telling) as a column, one row per student, grouped by what needs doing. Ranks and
// standing are always computed against the WHOLE class, even when an assistant only
// sees their sub-group.

export type TrendColumn = {
  id: string;
  label: string;
  date: Date;
  type: string;
  isDiagnostic: boolean;
  hasBoundaries: boolean;
  classAvg: number | null; // mean of every marked student
};
export type TrendCell =
  | { kind: "mark"; pct: number; letter: string | null; rank: number; n: number }
  | { kind: "absent" }
  | null; // not marked (yet)
export type TrendRow = {
  id: string;
  name: string;
  code: string;
  cells: TrendCell[];
  points: TrendPoint[]; // the standardised results the trend was judged on
  trend: Classified;
};
export type ClassTrends = {
  columns: TrendColumn[];
  rows: TrendRow[];
  counts: Partial<Record<TrendGroup, number>>;
  months: { month: number; year: number }[]; // newest first, months that have assessments
};

export async function loadClassTrends(
  classId: string,
  opts: {
    studentIds?: string[] | null;
    period?: { month: number; year: number } | null;
    until?: Date; // only assessments dated before this (parent report: up to its month)
  } = {},
): Promise<ClassTrends> {
  const win = opts.period ? monthWindow(opts.period.month, opts.period.year) : null;
  const [students, assessments, allDates] = await Promise.all([
    prisma.student.findMany({
      where: { classId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.assessment.findMany({
      where: {
        classId,
        ...(win || opts.until
          ? { date: { ...(win ? { gte: win.start, lt: win.end } : {}), ...(opts.until ? { lt: opts.until } : {}) } }
          : {}),
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        label: true,
        date: true,
        type: true,
        isDiagnostic: true,
        gradeBoundaries: true,
        grades: { select: { studentId: true, rawMark: true, percentage: true, absent: true } },
      },
    }),
    prisma.assessment.findMany({ where: { classId }, select: { date: true } }),
  ]);

  // Per assessment: rank (1 = best, ties share) and leave-one-out z for every marked student.
  type Scored = { pct: number; letter: string | null; rank: number; n: number; z: number | null };
  const scored = assessments.map((a) => {
    const bounds = parseBoundaries(a.gradeBoundaries);
    const marked = a.grades.filter((g) => !g.absent && g.percentage != null);
    const pcts = marked.map((g) => Number(g.percentage));
    const byStudent = new Map<string, Scored | "absent">();
    marked.forEach((g, i) => {
      const pct = pcts[i];
      byStudent.set(g.studentId, {
        pct,
        letter: bounds && g.rawMark != null ? letterFor(Number(g.rawMark), bounds) : null,
        rank: 1 + pcts.filter((p) => p > pct).length,
        n: pcts.length,
        z: looZ(pct, pcts.filter((_, j) => j !== i)),
      });
    });
    for (const g of a.grades) if (g.absent) byStudent.set(g.studentId, "absent");
    const classAvg = pcts.length ? pcts.reduce((x, y) => x + y, 0) / pcts.length : null;
    return { a, bounds, byStudent, classAvg };
  });

  const rows: TrendRow[] = students.map((s) => {
    const cells: TrendCell[] = [];
    const points: TrendPoint[] = [];
    for (const { a, byStudent } of scored) {
      const v = byStudent.get(s.id);
      if (v === "absent") cells.push({ kind: "absent" });
      else if (!v) cells.push(null);
      else {
        cells.push({ kind: "mark", pct: v.pct, letter: v.letter, rank: v.rank, n: v.n });
        // Too few others to standardise (tiny class / early marking) -> leave out of the trend.
        if (v.z != null) points.push({ label: a.label, pct: v.pct, z: v.z, rank: v.rank, n: v.n });
      }
    }
    return { id: s.id, name: s.name, code: s.code, cells, points, trend: classifyTrend(points) };
  });
  markBiggestImprover(rows); // class-wide, before narrowing to a sub-group

  const visible = opts.studentIds ? new Set(opts.studentIds) : null;
  const shown = rows
    .filter((r) => !visible || visible.has(r.id))
    .sort(
      (x, y) =>
        GROUP_ORDER.indexOf(x.trend.group) - GROUP_ORDER.indexOf(y.trend.group) || x.name.localeCompare(y.name),
    );
  const counts: Partial<Record<TrendGroup, number>> = {};
  for (const r of shown) counts[r.trend.group] = (counts[r.trend.group] ?? 0) + 1;

  const seen = new Set<string>();
  const months = allDates
    .map((d) => ({ month: d.date.getUTCMonth() + 1, year: d.date.getUTCFullYear() }))
    .filter((m) => !seen.has(`${m.year}-${m.month}`) && seen.add(`${m.year}-${m.month}`))
    .sort((a, b) => b.year - a.year || b.month - a.month);

  return {
    columns: scored.map(({ a, bounds, classAvg }) => ({
      id: a.id,
      label: a.label,
      date: a.date,
      type: a.type,
      isDiagnostic: a.isDiagnostic,
      hasBoundaries: !!bounds,
      classAvg,
    })),
    rows: shown,
    counts,
    months,
  };
}

// Cross-class view: every active class in the operation, with its students who need action.
export async function loadOperationTrends(
  operationId: string,
  period: { month: number; year: number } | null,
) {
  const classes = await prisma.class.findMany({
    where: { operationId, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, school: { select: { name: true } } },
  });
  return Promise.all(
    classes.map(async (c) => ({ ...c, trends: await loadClassTrends(c.id, { period }) })),
  );
}
