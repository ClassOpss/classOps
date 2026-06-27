"use client";

import { useState, useTransition } from "react";
import { importStudents, type ImportRow, type ImportResult } from "@/actions/students";
import { uniqueStudentCode } from "@/lib/code";

export function ImportStudents({
  classId,
  prefix,
  existingCodes,
}: {
  classId: string;
  prefix: string;
  existingCodes: string[];
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isSaving, startSaving] = useTransition();

  function makeRows(names: string[]): ImportRow[] {
    const taken = new Set(existingCodes);
    return names.map((name) => {
      const code = uniqueStudentCode(prefix, taken);
      taken.add(code);
      return { name, code };
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setResult(null);
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import/parse-pdf", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not parse the PDF.");
      } else {
        setRows(makeRows(data.names ?? []));
        if (data.warning) setError(data.warning);
      }
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setParsing(false);
    }
  }

  function update(i: number, patch: Partial<ImportRow>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }
  function addRow() {
    setRows((r) => {
      const taken = new Set([...existingCodes, ...r.map((x) => x.code)]);
      return [...r, { name: "", code: uniqueStudentCode(prefix, taken) }];
    });
  }

  function save() {
    setResult(null);
    setError(null);
    startSaving(async () => {
      const res = await importStudents(classId, rows);
      if (res.error) setError(res.error);
      else {
        setResult(res);
        setRows([]);
      }
    });
  }

  const inputCls = "input !py-1.5";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-secondary cursor-pointer">
          {parsing ? "Reading PDF…" : "Upload class-list PDF"}
          <input type="file" accept="application/pdf" className="hidden" onChange={onFile} disabled={parsing} />
        </label>
        <button type="button" onClick={addRow} className="link text-sm">
          + Add row manually
        </button>
      </div>

      {error ? <p className="text-sm text-warn">{error}</p> : null}
      {result ? (
        <p className="text-sm text-success">
          {result.added} added{result.skipped ? `, ${result.skipped} skipped (duplicate/blank)` : ""}.
        </p>
      ) : null}

      {rows.length > 0 && (
        <>
          <div className="card overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>Name</th>
                  <th className="w-28">Code</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="text-faint">{i + 1}</td>
                    <td className="pr-2">
                      <input value={row.name} onChange={(e) => update(i, { name: e.target.value })} className={inputCls} />
                    </td>
                    <td className="pr-2">
                      <input value={row.code} onChange={(e) => update(i, { code: e.target.value })} className={inputCls} />
                    </td>
                    <td>
                      <button type="button" onClick={() => removeRow(i)} className="font-medium text-danger hover:underline">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <button type="button" onClick={save} disabled={isSaving} className="btn-primary">
              {isSaving ? "Importing…" : `Import ${rows.length} student${rows.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
