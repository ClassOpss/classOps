import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { currentOperationId } from "@/lib/operation";
import { loadClassTrends } from "@/lib/class-trends";
import {
  ClassTrendsTable,
  TrendCounts,
  TrendMonthFilter,
  TREND_FOOTNOTE,
  parsePeriod,
} from "@/components/class-trends-table";

export default async function ClassTrendsPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  await requireRole("admin", "teacher");
  const { classId } = await params;
  const period = parsePeriod(await searchParams);
  const klass = await prisma.class.findFirst({
    where: { id: classId, operationId: await currentOperationId() },
    select: { name: true, school: { select: { name: true } } },
  });
  if (!klass) notFound();
  const data = await loadClassTrends(classId, { period });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/classes/${classId}`} className="link text-sm">← {klass.name}</Link>
        <h1 className="page-title mt-1">Trends</h1>
        <p className="page-subtitle">{klass.school.name} · who needs remedial, who&apos;s improving, who&apos;s plateauing</p>
      </div>
      <TrendMonthFilter base={`/classes/${classId}/trends`} data={data} period={period} />
      <TrendCounts counts={data.counts} />
      <ClassTrendsTable data={data} />
      <p className="text-xs text-faint">{TREND_FOOTNOTE}</p>
    </div>
  );
}
