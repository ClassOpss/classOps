import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClassAccess, getVisibleStudentIds } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { studentProfile, type HwOutcome } from "@/lib/student-profile";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x)}%`);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

const HW_BADGE: Record<HwOutcome, { cls: string; label: string }> = {
  on_time: { cls: "badge-success", label: "On time" },
  late: { cls: "badge-warn", label: "Late" },
  missing: { cls: "badge-danger", label: "Missing" },
  pending: { cls: "badge-neutral", label: "Not due yet" },
};

// Green above the class average, red below (spec: relative, not fixed thresholds).
function vsClass(value: number | null, baseline: number | null) {
  if (value == null || baseline == null || Math.round(value) === Math.round(baseline)) return "text-fg";
  return value > baseline ? "text-success" : "text-danger";
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="section-title">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const Empty = ({ text }: { text: string }) => <p className="px-4 py-4 text-sm text-muted">{text}</p>;

export default async function StudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string; studentId: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { classId, studentId } = await params;
  const user = await requireClassAccess(classId);
  // Assistants only see their own sub-group (same rule as progress / HW / grades).
  if (!(await getVisibleStudentIds(classId, user)).includes(studentId)) notFound();

  const sp = await searchParams;
  const m = Number(sp.month);
  const y = Number(sp.year);
  const period = m >= 1 && m <= 12 && y > 2000 ? { month: m, year: y } : null;

  const [klass, profile] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, select: { name: true } }),
    studentProfile(classId, studentId, period),
  ]);
  if (!klass || !profile) notFound();
  const { student, attendance, homework, grades, officeHours, months } = profile;

  const absences = attendance.filter((a) => a.status === "absent");
  const excused = attendance.filter((a) => a.status === "excused");
  const counted = attendance.length - excused.length;
  const present = counted - absences.length;
  const missing = homework.filter((h) => h.outcome === "missing");
  const late = homework.filter((h) => h.outcome === "late");
  const due = homework.filter((h) => h.outcome !== "pending").length;
  const scored = grades.filter((g) => !g.isDiagnostic && g.percentage != null && !g.absent);
  const average = mean(scored.map((g) => g.percentage!));
  const classAverage = mean(scored.flatMap((g) => (g.classAverage == null ? [] : [g.classAverage])));

  const base = `/my/classes/${classId}/students/${studentId}`;
  const periodLabel = period ? `${MONTHS[period.month - 1]} ${period.year}` : "the whole year";
  const parent = [student.parentPrefix, student.parentName].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/my/classes/${classId}/progress`} className="link text-sm">← Student progress</Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">{student.name}</h1>
        <p className="text-sm text-muted">
          {klass.name} · {student.code}
          {(parent || student.parentPhone) && (
            <>
              {" · Parent: "}
              {parent}
              {student.parentPhone && (
                <a href={`tel:${student.parentPhone}`} className="link ml-1 tabular-nums">{student.parentPhone}</a>
              )}
            </>
          )}
        </p>
      </div>

      {/* Month filter — the default is the whole year; a month matches that month's parent report. */}
      <nav className="-mx-1 flex flex-wrap gap-1.5 px-1">
        <Link href={base} className={period ? "badge-neutral" : "badge-brand"}>Whole year</Link>
        {months.map((mo) => {
          const active = period?.month === mo.month && period.year === mo.year;
          return (
            <Link
              key={`${mo.year}-${mo.month}`}
              href={`${base}?month=${mo.month}&year=${mo.year}`}
              className={active ? "badge-brand" : "badge-neutral"}
            >
              {MONTHS[mo.month - 1]} {mo.year}
            </Link>
          );
        })}
      </nav>

      {/* Quick answers — the questions parents ask most, in one glance. */}
      <section className="card p-4">
        <h2 className="section-title mb-2">Quick answers · {periodLabel}</h2>
        <ul className="flex flex-col gap-1.5 text-sm">
          <li>
            <span className="text-muted">Attendance: </span>
            {counted === 0 ? (
              "No sessions logged."
            ) : (
              <>
                attended <b className="tabular-nums">{present}/{counted}</b>
                {absences.length === 0
                  ? " — never absent."
                  : ` — absent ${absences.length}×: ${absences.map((a) => dayFmt.format(a.date)).join(", ")}.`}
                {excused.length > 0 && ` ${excused.length} excused.`}
              </>
            )}
          </li>
          <li>
            <span className="text-muted">Homework: </span>
            {due === 0 ? (
              "None due yet."
            ) : (
              <>
                <b className="tabular-nums">{due - missing.length}/{due}</b> handed in
                {late.length > 0 && ` (${late.length} late)`}
                {missing.length === 0
                  ? " — none missed."
                  : ` — missed: ${missing.map((h) => `${h.description} (due ${dayFmt.format(h.deadline)})`).join("; ")}.`}
              </>
            )}
          </li>
          <li>
            <span className="text-muted">Grades: </span>
            {average == null ? (
              "No graded assessments yet."
            ) : (
              <>
                average <b className={`tabular-nums ${vsClass(average, classAverage)}`}>{pct(average)}</b> vs class{" "}
                {pct(classAverage)} across {scored.length} assessment{scored.length === 1 ? "" : "s"}.
              </>
            )}
          </li>
          {officeHours.length > 0 && (
            <li>
              <span className="text-muted">Office hours: </span>
              {officeHours.length} session{officeHours.length === 1 ? "" : "s"}.
            </li>
          )}
        </ul>
        {period && (
          <a
            href={`/api/reports/student/${studentId}?month=${period.month}&year=${period.year}`}
            target="_blank"
            rel="noreferrer"
            className="link mt-3 inline-block text-sm"
          >
            Open {periodLabel} parent report (PDF) →
          </a>
        )}
      </section>

      <Section title="Attendance" hint="Newest first. Excused sessions don't count toward the rate.">
        {attendance.length === 0 ? (
          <Empty text="No sessions logged." />
        ) : (
          <ul className="divide-y divide-border">
            {attendance.map((a, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-24 shrink-0 tabular-nums text-muted">{dayFmt.format(a.date)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {a.topic}
                  {a.status === "excused" && a.reason && <span className="block text-xs text-faint">{a.reason}</span>}
                </span>
                <span
                  className={
                    a.status === "present" ? "badge-success" : a.status === "absent" ? "badge-danger" : "badge-neutral"
                  }
                >
                  {a.status === "present" ? "Present" : a.status === "absent" ? "Absent" : "Excused"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Homework" hint="By due date, newest first.">
        {homework.length === 0 ? (
          <Empty text="No homework set." />
        ) : (
          <ul className="divide-y divide-border">
            {homework.map((h) => (
              <li key={h.id} className="px-4 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{h.description}</span>
                    <span className="block text-xs text-faint">
                      Due {dayFmt.format(h.deadline)}
                      {h.submittedOn && ` · handed in ${dayFmt.format(h.submittedOn)}`}
                    </span>
                  </span>
                  <span className={HW_BADGE[h.outcome].cls}>{HW_BADGE[h.outcome].label}</span>
                </div>
                {h.weakPoints && <p className="mt-1 text-xs text-muted">Weak points: {h.weakPoints}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Grades" hint="Colour is relative to the class average for that assessment.">
        {grades.length === 0 ? (
          <Empty text="No assessments yet." />
        ) : (
          <ul className="divide-y divide-border">
            {grades.map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{g.label}</span>
                  {g.isDiagnostic && <span className="badge-neutral ml-1.5 text-[0.65rem]">Diagnostic</span>}
                  <span className="block text-xs text-faint">{dayFmt.format(g.date)}</span>
                </span>
                <span className="text-right tabular-nums">
                  {g.absent ? (
                    <span className="badge-warn">Absent</span>
                  ) : g.percentage == null ? (
                    <span className="text-faint">Not marked</span>
                  ) : (
                    <>
                      <span className={`font-medium ${vsClass(g.percentage, g.classAverage)}`}>{pct(g.percentage)}</span>
                      {g.rawMark != null && g.maxMark != null && (
                        <span className="block text-xs text-faint">{g.rawMark}/{g.maxMark}</span>
                      )}
                    </>
                  )}
                </span>
                <span className="w-16 text-right text-xs tabular-nums text-faint">class {pct(g.classAverage)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {officeHours.length > 0 && (
        <Section title="Office hours">
          <ul className="divide-y divide-border">
            {officeHours.map((o, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-24 shrink-0 tabular-nums text-muted">{dayFmt.format(o.date)}</span>
                <span className="min-w-0 flex-1 truncate">{o.topic ?? "—"}</span>
                {o.durationMin != null && <span className="text-xs text-faint">{o.durationMin} min</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
