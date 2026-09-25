import Link from "next/link";
import { requireClassAccess, getVisibleStudentIds } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { classProgress, type StudentProgress } from "@/lib/student-progress";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x)}%`);
const rate = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);

// Green above the class baseline, red below (spec: relative, not fixed thresholds).
function vsClass(value: number | null, baseline: number | null) {
  if (value == null || baseline == null || Math.round(value) === Math.round(baseline)) return "text-fg";
  return value > baseline ? "text-success" : "text-danger";
}

function Stat({
  label,
  value,
  baseline,
  tone,
}: {
  label: string;
  value: string;
  baseline: string;
  tone: string;
}) {
  return (
    <div className="card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-faint">Class {baseline}</p>
    </div>
  );
}

function StudentCard({ s }: { s: StudentProgress }) {
  const hwTotal = s.hw.onTime + s.hw.late + s.hw.missing;
  return (
    <li className="card p-3.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="font-semibold">{s.name}</p>
        <span className="ml-auto flex flex-wrap gap-1.5">
          {s.reasons.length === 0 ? (
            <span className="badge-success">On track</span>
          ) : (
            s.reasons.map((r) => (
              <span key={r} className="badge-danger">{r}</span>
            ))
          )}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted">Attendance</dt>
          <dd className="tabular-nums">
            {s.attendanceTotal ? `${s.attended}/${s.attendanceTotal}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Homework</dt>
          <dd className="tabular-nums">
            {hwTotal === 0 ? (
              "—"
            ) : (
              <>
                <span className="text-success">{s.hw.onTime}</span>
                {" · "}
                <span className="text-warn">{s.hw.late}</span>
                {" · "}
                <span className="text-danger">{s.hw.missing}</span>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Average</dt>
          <dd className="tabular-nums">{pct(s.average)}</dd>
        </div>
      </dl>

      {(s.lastGrade || s.weakPoints) && (
        <div className="mt-2.5 flex flex-col gap-1 border-t border-border pt-2.5 text-xs text-muted">
          {s.lastGrade && (
            <p>
              Last: {s.lastGrade.label}{" "}
              <span className={`font-medium ${vsClass(s.lastGrade.percentage, s.lastGrade.classAverage)}`}>
                {pct(s.lastGrade.percentage)}
              </span>{" "}
              (class {pct(s.lastGrade.classAverage)})
            </p>
          )}
          {s.weakPoints && <p>Weak points: {s.weakPoints}</p>}
        </div>
      )}
    </li>
  );
}

export default async function AssistantProgressPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const user = await requireClassAccess(classId);

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { name: true, school: { select: { name: true } } },
  });
  if (!klass) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Class not found</h1>
        <Link href="/my" className="link text-sm">← My Classes</Link>
      </div>
    );
  }

  const visible = await getVisibleStudentIds(classId, user);
  const { students, group, klass: cls, assessments } = await classProgress(classId, visible);
  const flagged = students.filter((s) => s.reasons.length > 0).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/my/classes/${classId}`} className="link text-sm">← {klass.name}</Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">Student progress</h1>
        <p className="text-sm text-muted">
          {klass.school.name} · your {students.length} student{students.length === 1 ? "" : "s"}
          {flagged > 0 && (
            <>
              {" · "}
              <span className="text-danger">{flagged} need attention</span>
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat
          label="Attendance"
          value={rate(group.attendanceRate)}
          baseline={rate(cls.attendanceRate)}
          tone={vsClass(group.attendanceRate, cls.attendanceRate)}
        />
        <Stat
          label="HW on time"
          value={rate(group.hwOnTimeRate)}
          baseline={rate(cls.hwOnTimeRate)}
          tone={vsClass(group.hwOnTimeRate, cls.hwOnTimeRate)}
        />
        <Stat
          label="Average"
          value={pct(group.average)}
          baseline={pct(cls.average)}
          tone={vsClass(group.average, cls.average)}
        />
      </div>

      {assessments.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="section-title">Assessments</h2>
            <p className="mt-0.5 text-xs text-muted">Your students&apos; average vs the whole class.</p>
          </div>
          <ul className="divide-y divide-border">
            {assessments.slice(0, 6).map((a) => (
              <li key={a.id}>
                <Link
                  href={`/my/classes/${classId}/assessments/${a.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-card-muted"
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{a.label}</span>
                    {a.isDiagnostic && <span className="badge-neutral ml-1.5 text-[0.65rem]">Diagnostic</span>}
                    <span className="block text-xs text-faint">
                      {dateFmt.format(a.date)} · {a.graded} graded
                    </span>
                  </span>
                  <span className={`tabular-nums font-medium ${vsClass(a.groupAverage, a.classAverage)}`}>
                    {pct(a.groupAverage)}
                  </span>
                  <span className="w-16 text-right text-xs tabular-nums text-faint">class {pct(a.classAverage)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="section-title">Students</h2>
          <p className="text-xs text-faint">
            HW: <span className="text-success">on time</span> · <span className="text-warn">late</span> ·{" "}
            <span className="text-danger">missing</span>
          </p>
        </div>
        {students.length === 0 ? (
          <p className="card px-4 py-6 text-center text-sm text-muted">No students in your group yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {students.map((s) => (
              <StudentCard key={s.id} s={s} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
