import { renderToBuffer } from "@react-pdf/renderer";
import { promises as fs } from "fs";
import { StudentReportDoc } from "../src/lib/reports/student-report-doc";
import type { StudentReportData } from "../src/lib/reports/student-report-data";

const data: StudentReportData = {
  logoDataUri: null,
  brandName: "Math by Mo",
  generatedAt: "18 Aug 2026",
  studentName: "Youssef Adel",
  code: "C4772",
  className: "Y9 — Citadel",
  schoolName: "Citadel International School",
  monthLabel: "August 2026",
  parentNotes: "Youssef has improved noticeably on algebra. Please encourage him to attempt the harder past-paper questions before the next quiz.",
  summary: { attendanceRate: "83%", average: "76%", missedHw: 1, absences: 1 },
  trend: { averageDelta: 8, attendanceDelta: -5 },
  absences: [{ date: "24 Aug 2026", topic: "Coordinate Geometry" }],
  missedHomework: [{ description: "Exercise 3A, Q1–10", due: "10 Aug 2026" }],
  grades: [
    { label: "Algebra Quiz 1", date: "10 Aug 2026", score: "84%", classAvg: "72%", standing: "above" },
    { label: "Geometry Check", date: "31 Aug 2026", score: "68%", classAvg: "78%", standing: "below" },
  ],
};

async function main() {
  const buf = await renderToBuffer(StudentReportDoc({ data }));
  const out = process.argv[2] ?? "student-report-preview.pdf";
  await fs.writeFile(out, buf);
  console.log("wrote", out, buf.length, "bytes");
}
main();
