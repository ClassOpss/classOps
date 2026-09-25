"use client";

import { useState } from "react";

export const DEFAULT_EXCUSE = "Schedule clash with another subject";

// One roster row: present checkbox + an "Excused" toggle that reveals a reason.
// Excused students aren't counted in attendance rates (see actions/attendance).
export function AttendanceRow({
  student,
  status,
  reason,
}: {
  student: { id: string; name: string; code: string };
  status: "present" | "absent" | "excused" | undefined;
  reason: string | null;
}) {
  const [excused, setExcused] = useState(status === "excused");

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          name="present"
          value={student.id}
          defaultChecked={status !== "absent" && status !== "excused"}
          disabled={excused}
          aria-label={`${student.name} present`}
          className="h-5 w-5 accent-brand disabled:opacity-30"
        />
        <span className={`flex-1 font-medium ${excused ? "text-muted" : ""}`}>{student.name}</span>
        <span className="text-xs text-faint">{student.code}</span>
        <label
          className={`cursor-pointer rounded-md px-2 py-1 text-xs font-medium ${
            excused ? "bg-brand-soft text-brand-softfg" : "text-faint hover:bg-card-muted"
          }`}
        >
          <input
            type="checkbox"
            name="excused"
            value={student.id}
            checked={excused}
            onChange={(e) => setExcused(e.target.checked)}
            className="sr-only"
          />
          Excused
        </label>
      </div>
      {excused && (
        <input
          name={`reason_${student.id}`}
          defaultValue={reason ?? DEFAULT_EXCUSE}
          placeholder="Reason (shown to parents)"
          maxLength={200}
          className="input mt-2 text-sm"
        />
      )}
    </li>
  );
}
