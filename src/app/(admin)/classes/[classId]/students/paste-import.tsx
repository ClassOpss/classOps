"use client";

import { useState, useTransition } from "react";
import { importStudents, type ImportRow, type ImportResult } from "@/actions/students";

type Parsed = ImportRow & { _issue?: string };

// Map a header cell to one of our fields.
function fieldFor(header: string): keyof ImportRow | null {
  const h = header.toLowerCase();
  if (h.includes("parent") && h.includes("phone")) return "parentPhone";
  if (h.includes("parent") && h.includes("name")) return "parentName";
  if (h.includes("parent")) return "parentName";
  if (h.includes("student") && h.includes("phone")) return "phone";
  if (h.includes("phone") || h.includes("mobile")) return "phone";
  if (h.includes("email")) return "email";
  if (h.includes("code")) return "code";
  if (h.includes("name")) return "name"; // "Student Name" / "Name"
  return null;
}

// Default column order if no header is detected (matches the collected form).
const DEFAULT_ORDER: (keyof ImportRow | null)[] = ["name", "email", null, "phone", "parentName", "parentPhone"];

function parse(text: string): Parsed[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const delim = lines[0].includes("\t") ? "\t" : ",";
  const cells = (line: string) => line.split(delim).map((c) => c.trim());

  const first = cells(lines[0]);
  const headerLooksReal = first.some((c) => /name|email|phone|parent/i.test(c));
  const map = headerLooksReal ? first.map(fieldFor) : DEFAULT_ORDER;
  const dataLines = headerLooksReal ? lines.slice(1) : lines;

  const out: Parsed[] = [];
  for (const line of dataLines) {
    const c = cells(line);
    const row: Parsed = { name: "", code: "" };
    map.forEach((field, i) => {
      if (field) (row as Record<string, string>)[field] = c[i] ?? "";
    });
    row.name = (row.name ?? "").trim();
    if (!row.name) row._issue = "no name — will be skipped";
    out.push(row);
  }
  return out;
}

export function PasteImport({ classId }: { classId: string }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Parsed[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  const valid = rows?.filter((r) => r.name) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="label">Paste from your spreadsheet</label>
        <p className="mb-2 text-xs text-faint">
          Copy the rows from Excel/Google Sheets (including the header) and paste below. Columns:
          Student Name, Email, School, Student phone, Parent name, Parent phone.
        </p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          rows={5}
          placeholder={"Student Name\tEmail\tSchool\tStudent phone\tParent name\tParent phone\nAhmed Ali\tahmed@mail.com\tCitadel\t01001234567\tMona\t01109876543"}
          className="textarea font-mono text-xs"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => { setRows(parse(text)); setResult(null); }}
          disabled={!text.trim()}
          className="btn-secondary btn-sm"
        >
          Preview
        </button>
        {rows && (
          <span className="text-sm text-muted">
            {valid.length} student{valid.length === 1 ? "" : "s"} ready
            {rows.length - valid.length > 0 ? ` · ${rows.length - valid.length} will be skipped` : ""}
          </span>
        )}
      </div>

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Student phone</th><th>Parent</th><th>Parent phone</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={r._issue ? "opacity-50" : ""}>
                  <td className="font-medium">{r.name || <span className="text-danger">—</span>}</td>
                  <td className="text-muted">{r.email || "—"}</td>
                  <td className="text-muted">{r.phone || "—"}</td>
                  <td className="text-muted">{r.parentName || "—"}</td>
                  <td className="text-muted">{r.parentPhone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows && valid.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await importStudents(classId, valid.map((r) => ({ ...r })));
                setResult(res);
                if (!res.error) { setRows(null); setText(""); }
              })
            }
            className="btn-primary btn-sm"
          >
            {pending ? "Importing…" : `Import ${valid.length} students`}
          </button>
        </div>
      )}

      {result && (
        <p className={`text-sm ${result.error ? "text-danger" : "text-success"}`}>
          {result.error ?? `Imported ${result.added}${result.skipped ? ` · skipped ${result.skipped} duplicate(s)` : ""} ✓`}
        </p>
      )}
    </div>
  );
}
