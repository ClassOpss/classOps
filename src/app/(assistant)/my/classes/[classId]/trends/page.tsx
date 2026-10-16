import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClassAccess, getVisibleStudentIds } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { loadClassTrends } from "@/lib/class-trends";
import {
  ClassTrendsTable,
  TrendCounts,
  TrendMonthFilter,
  TREND_FOOTNOTE,
  parsePeriod,
} from "@/components/class-trends-table";

export default async function AssistantTrendsPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { classId } = await params;
  const user = await requireClassAccess(classId);
  const period = parsePeriod(await searchParams);
  const klass = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });
  if (!klass) notFound();
  // Your sub-group only; ranks and standing are still against the whole class.
  const studentIds = await getVisibleStudentIds(classId, user);
  const data = await loadClassTrends(classId, { studentIds, period });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/my/classes/${classId}`} className="link text-sm">← {klass.name}</Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">Trends</h1>
        <p className="text-sm text-muted">Your {data.rows.length} students · ranked against the whole class</p>
      </div>
      <TrendMonthFilter base={`/my/classes/${classId}/trends`} data={data} period={period} />
      <TrendCounts counts={data.counts} />
      <ClassTrendsTable data={data} studentHref={(id) => `/my/classes/${classId}/students/${id}`} />
      <p className="text-xs text-faint">{TREND_FOOTNOTE}</p>
    </div>
  );
}
