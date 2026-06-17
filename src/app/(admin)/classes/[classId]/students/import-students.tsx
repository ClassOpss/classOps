"use client";

import { useState, useTransition } from "react";
import { importStudents, type ImportRow, type ImportResult } from "@/actions/students";
import { uniqueCode } from "@/lib/code";

export function ImportStudents({
  classId,
  existingCodes,
}: {
  classId: string;
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
      const code = uniqueCode(taken);
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
      return [...r, { name: "", code: uniqueCode(taken) }];
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

  const inputCls =
    "w-full rounded-md border border-black/15 bg-white px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
          {parsing ? "Reading PDF…" : "Upload class-list PDF"}
          <input type="file" accept="application/pdf" className="hidden" onChange={onFile} disabled={parsing} />
        </label>
        <button type="button" onClick={addRow} className="text-sm text-blue-600 hover:underline">
          + Add row manually
        </button>
      </div>

      {error ? <p className="text-sm text-amber-600">{error}</p> : null}
      {result ? (
        <p className="text-sm text-green-600">
          {result.added} added{result.skipped ? `, ${result.skipped} skipped (duplicate/blank)` : ""}.
        </p>
      ) : null}

      {rows.length > 0 && (
        <>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
              <tr>
                <th className="w-10 py-2">#</th>
                <th className="py-2">Name</th>
                <th className="w-28 py-2">Code</th>
                <th className="w-16 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-1 text-black/40">{i + 1}</td>
                  <td className="py-1 pr-2">
                    <input value={row.name} onChange={(e) => update(i, { name: e.target.value })} className={inputCls} />
                  </td>
                  <td className="py-1 pr-2">
                    <input value={row.code} onChange={(e) => update(i, { code: e.target.value })} className={inputCls} />
                  </td>
                  <td className="py-1">
                    <button type="button" onClick={() => removeRow(i)} className="text-sm text-red-600 hover:underline">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div>
            <button
              type="button"
              onClick={save}
              disabled={isSaving}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? "Importing…" : `Import ${rows.length} student${rows.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
