import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { currentOperationId } from "@/lib/operation";
import { TopicChart, type TopicDatum } from "./topic-chart";

const STOPWORDS = new Set([
  "the", "and", "with", "for", "this", "that", "they", "their", "them", "was", "were", "had",
  "has", "have", "not", "but", "are", "his", "her", "she", "him", "out", "all", "any", "can",
  "did", "does", "from", "into", "more", "some", "than", "then", "when", "what", "which", "who",
  "will", "would", "about", "still", "very", "much",
]);

function topKeywords(texts: (string | null)[], limit = 12): { word: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const t of texts) {
    if (!t) continue;
    for (const raw of t.toLowerCase().split(/[^a-z]+/)) {
      if (raw.length < 3 || STOPWORDS.has(raw)) continue;
      counts.set(raw, (counts.get(raw) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([word, n]) => ({ word, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, limit);
}

export default async function InsightsPage() {
  await requireRole("admin", "teacher");
  const operationId = await currentOperationId();

  const [grades, attendance, classes, weakSubs, assistants, absenceGroups] = await Promise.all([
    prisma.assessmentGrade.findMany({
      where: {
        assessment: { isDiagnostic: false, topicId: { not: null }, class: { operationId } },
        percentage: { not: null },
      },
      select: { percentage: true, assessment: { select: { topic: { select: { title: true } } } } },
    }),
    prisma.attendance.findMany({
      where: { session: { class: { operationId } } },
      select: { status: true, session: { select: { classId: true } } },
    }),
    prisma.class.findMany({ where: { active: true, operationId }, select: { id: true, name: true } }),
    prisma.homeworkSubmission.findMany({
      where: { weakPoints: { not: null }, homework: { class: { operationId } } },
      select: { weakPoints: true },
    }),
    prisma.assistant.findMany({
      where: { active: true, operationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { incidents: true, officeHours: true } } },
    }),
    prisma.attendance.groupBy({
      by: ["studentId"],
      where: { status: "absent", session: { class: { operationId } } },
      _count: { _all: true },
    }),
  ]);

  // Topic performance (diagnostics excluded)
  const topicAgg = new Map<string, { sum: number; n: number }>();
  for (const g of grades) {
    const title = g.assessment.topic?.title;
    if (!title) continue;
    const a = topicAgg.get(title) ?? { sum: 0, n: 0 };
    a.sum += Number(g.percentage);
    a.n += 1;
    topicAgg.set(title, a);
  }
  const topicData: TopicDatum[] = [...topicAgg.entries()]
    .map(([topic, a]) => ({ topic, avg: a.sum / a.n, n: a.n }))
    .sort((a, b) => a.avg - b.avg);
  const overallAvg = topicData.length
    ? topicData.reduce((s, d) => s + d.avg * d.n, 0) / topicData.reduce((s, d) => s + d.n, 0)
    : 0;

  // Attendance per class
  const classNames = new Map(classes.map((c) => [c.id, c.name]));
  const attAgg = new Map<string, { present: number; total: number }>();
  for (const a of attendance) {
    const cid = a.session.classId;
    const x = attAgg.get(cid) ?? { present: 0, total: 0 };
    x.total += 1;
    if (a.status === "present") x.present += 1;
    attAgg.set(cid, x);
  }
  const attRows = [...attAgg.entries()]
    .map(([cid, x]) => ({ name: classNames.get(cid) ?? "—", rate: (x.present / x.total) * 100 }))
    .sort((a, b) => a.rate - b.rate);

  // Students with >3 absences
  const flaggedIds = absenceGroups.filter((g) => g._count._all > 3);
  const flagged = flaggedIds.length
    ? await prisma.student.findMany({
        where: { id: { in: flaggedIds.map((f) => f.studentId) } },
        select: { id: true, name: true, class: { select: { name: true } } },
      })
    : [];
  const absenceCount = new Map(flaggedIds.map((f) => [f.studentId, f._count._all]));

  const keywords = topKeywords(weakSubs.map((s) => s.weakPoints));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="page-title">Insights</h1>
        <p className="page-subtitle">Performance, attendance and assistant activity across classes.</p>
      </div>

      <section className="card p-5">
        <h2 className="section-title">Topic performance</h2>
        <p className="mb-4 mt-0.5 text-xs text-muted">
          Average assessment score per topic (diagnostics excluded). Green above the overall
          average, red below.
        </p>
        <TopicChart data={topicData} overallAvg={overallAvg} />
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">Attendance by class</h2>
        </div>
        {attRows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No attendance logged yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Class</th><th>Attendance rate</th></tr>
            </thead>
            <tbody>
              {attRows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className={r.rate < 85 ? "font-medium text-warn" : "font-medium text-success"}>{r.rate.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {flagged.length > 0 && (
          <div className="border-t border-border px-5 py-4 text-sm">
            <p className="font-medium text-danger">Students with &gt;3 absences</p>
            <ul className="mt-2 flex flex-col gap-1">
              {flagged.map((s) => (
                <li key={s.id}>
                  {s.name} <span className="text-faint">· {s.class.name} · {absenceCount.get(s.id)} absences</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="section-title mb-3">Common weak points</h2>
        {keywords.length === 0 ? (
          <p className="text-sm text-muted">No weak-point notes yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <span key={k.word} className="badge-neutral">
                {k.word} <span className="text-faint">×{k.n}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">Assistant activity</h2>
        </div>
        {assistants.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No assistants yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Assistant</th><th>Late incidents</th><th>Office hours</th></tr>
            </thead>
            <tbody>
              {assistants.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium">{a.name}</td>
                  <td className={a._count.incidents > 0 ? "text-warn" : "text-muted"}>{a._count.incidents}</td>
                  <td className="text-muted">{a._count.officeHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
