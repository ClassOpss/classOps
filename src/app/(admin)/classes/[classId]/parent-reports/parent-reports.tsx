"use client";

import { useActionState, useState } from "react";
import { setParentNotes, type FormState } from "@/actions/students";
import { normalizePhone, studentCodeMessage, parentCodeMessage, parentReportMessage } from "@/lib/invites";
import { WhatsAppSend } from "@/components/whatsapp-send";

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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ParentReports({
  brandName,
  signature,
  className,
  students,
}: {
  brandName: string;
  signature: string;
  className: string;
  students: PRStudent[];
}) {
  const now = new Date();
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [year, setYear] = useState(now.getUTCFullYear());

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
      </div>

      <ul className="flex flex-col gap-3">
        {students.map((s) => (
          <Row key={s.id} s={s} brandName={brandName} signature={signature} className={className} month={month} year={year} />
        ))}
      </ul>
    </div>
  );
}

function Row({
  s,
  brandName,
  signature,
  className,
  month,
  year,
}: {
  s: PRStudent;
  brandName: string;
  signature: string;
  className: string;
  month: number;
  year: number;
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
  const reportParentMsg = parentReportMessage({
    brandName,
    className,
    studentName: s.name,
    parentPrefix: s.parentPrefix,
    parentName: s.parentName,
    attendance: { present: s.present, total: s.total },
    avgPercent: s.avg,
    hw: s.hw,
  });
  const pdfHref = `/api/reports/student/${s.id}?month=${month}&year=${year}`;

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-40">
          <p className="font-medium">{s.name}</p>
          <p className="text-xs text-faint">
            {s.code} · att {s.total > 0 ? `${s.present}/${s.total}` : "—"} · avg {s.avg == null ? "—" : `${Math.round(s.avg)}%`} ·
            hw <span className="text-danger">{s.hw.missing}</span> missing
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <a href={pdfHref} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm">PDF report</a>
          {normalizePhone(s.parentPhone) && <WhatsAppSend phone={s.parentPhone} message={reportParentMsg} label="Report → parent" />}
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
