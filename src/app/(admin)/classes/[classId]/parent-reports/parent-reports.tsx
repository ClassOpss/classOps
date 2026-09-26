"use client";

import { useActionState, useState } from "react";
import { setParentNotes, type FormState } from "@/actions/students";
import { logParentReportSent } from "@/actions/parent-reports";
import { normalizePhone, studentCodeMessage, parentCodeMessage, parentReportMessage } from "@/lib/invites";
import { WhatsAppSend } from "@/components/whatsapp-send";
import { SendReportPdf } from "@/components/send-report-pdf";

export type PRStudent = {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  parentPrefix: string | null;
  parentName: string | null;
  parentPhone: string | null;
  parentNotes: string | null;
  present: number;
  total: number;
  avg: number | null;
  hw: { onTime: number; late: number; missing: number };
};

// A monthly report already sent (ParentReportLog), as plain data for the client.
export type PRSentLog = { studentId: string; year: number; month: number; sentAt: string };

const sentKey = (studentId: string, year: number, month: number) => `${studentId}|${year}|${month}`;
const sentFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Cairo" });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function ParentReports({
  signature,
  students,
  sentLogs = [],
  countIds,
  initialMonth,
  initialYear,
}: {
  brandName: string;
  signature: string;
  className: string;
  students: PRStudent[];
  sentLogs?: PRSentLog[];
  // Students whose reports count toward "N of M sent" (an assistant's sub-group);
  // defaults to the whole class.
  countIds?: string[];
  initialMonth?: number;
  initialYear?: number;
}) {
  const now = new Date();
  const [month, setMonth] = useState(initialMonth ?? now.getUTCMonth() + 1);
  const [year, setYear] = useState(initialYear ?? now.getUTCFullYear());
  const [sent, setSent] = useState<Record<string, string>>(() =>
    Object.fromEntries(sentLogs.map((l) => [sentKey(l.studentId, l.year, l.month), l.sentAt])),
  );

  async function markSent(studentId: string) {
    const k = sentKey(studentId, year, month);
    const optimistic = new Date().toISOString();
    setSent((m) => ({ ...m, [k]: m[k] ?? optimistic }));
    const res = await logParentReportSent(studentId, year, month);
    if (res.ok) setSent((m) => ({ ...m, [k]: res.sentAt }));
  }

  const counted = new Set(countIds ?? students.map((s) => s.id));
  const reachable = students.filter((s) => counted.has(s.id) && normalizePhone(s.parentPhone));
  const sentCount = reachable.filter((s) => sent[sentKey(s.id, year, month)]).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">PDF report period:</span>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="input !w-auto !py-1.5 text-sm">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input !w-auto !py-1.5 text-sm">
          {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {reachable.length > 0 && (
          <span className={`ml-auto ${sentCount === reachable.length ? "badge-success" : "badge-warn"}`}>
            {MONTH_NAMES[month - 1]} reports sent: {sentCount} of {reachable.length}
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-3">
        {students.map((s) => (
          <Row
            key={s.id}
            s={s}
            signature={signature}
            month={month}
            year={year}
            sentAt={sent[sentKey(s.id, year, month)] ?? null}
            onSent={() => markSent(s.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function Row({
  s,
  signature,
  month,
  year,
  sentAt,
  onSent,
}: {
  s: PRStudent;
  signature: string;
  month: number;
  year: number;
  sentAt: string | null;
  onSent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(setParentNotes.bind(null, s.id), undefined);

  const codeStudentMsg = studentCodeMessage({ studentName: s.name, code: s.code, signature });
  const codeParentMsg = parentCodeMessage({
    studentName: s.name,
    code: s.code,
    signature,
    parentPrefix: s.parentPrefix,
    parentName: s.parentName,
  });
  const monthLabel = MONTH_NAMES[month - 1];
  const reportParentMsg = parentReportMessage({
    studentName: s.name,
    monthLabel,
    signature,
    parentPrefix: s.parentPrefix,
    parentName: s.parentName,
  });
  const pdfHref = `/api/reports/student/${s.id}?month=${month}&year=${year}`;
  const pdfFilename = `${s.name} - ${monthLabel} ${year} report.pdf`;

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-40">
          <p className="flex items-center gap-2 font-medium">
            {s.name}
            {sentAt && <span className="badge-success">Report sent {sentFmt.format(new Date(sentAt))}</span>}
          </p>
          <p className="text-xs text-faint">
            {s.code} · att {s.total > 0 ? `${s.present}/${s.total}` : "—"} · avg {s.avg == null ? "—" : `${Math.round(s.avg)}%`} ·
            hw <span className="text-danger">{s.hw.missing}</span> missing
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <a href={pdfHref} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm">PDF report</a>
          {normalizePhone(s.parentPhone) && <SendReportPdf pdfHref={pdfHref} filename={pdfFilename} phone={s.parentPhone} message={reportParentMsg} onSent={onSent} />}
          {normalizePhone(s.phone) && <WhatsAppSend phone={s.phone} message={codeStudentMsg} label="Code → student" />}
          {normalizePhone(s.parentPhone) && <WhatsAppSend phone={s.parentPhone} message={codeParentMsg} label="Code → parent" />}
          <button type="button" onClick={() => setOpen((o) => !o)} className="link text-sm">{open ? "Hide notes" : "Notes"}</button>
        </div>
      </div>

      {open && (
        <form action={action} className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          <textarea
            name="parentNotes"
            defaultValue={s.parentNotes ?? ""}
            rows={2}
            placeholder="Notes for the parent (appear on the PDF report)…"
            className="textarea text-sm"
          />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending} className="btn-secondary btn-sm">{pending ? "Saving…" : "Save notes"}</button>
            {state?.ok && <span className="text-xs text-success">Saved ✓</span>}
            {state?.error && <span className="text-xs text-danger">{state.error}</span>}
          </div>
        </form>
      )}
    </li>
  );
}
