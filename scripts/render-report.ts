// Renders the report doc with mock data to a PDF so the design can be eyeballed.
import { renderToBuffer } from "@react-pdf/renderer";
import { promises as fs } from "fs";
import { ClassReportDoc } from "../src/lib/reports/class-report-doc";
import type { ClassReportData } from "../src/lib/reports/class-report-data";

const data: ClassReportData = {
  logoDataUri: null,
  brandName: "Math by Mo",
  generatedAt: "14 Aug 2026",
  className: "Y9 — Citadel",
  schoolName: "Citadel International School",
  yearGroup: "Y9",
  assistants: ["Sara Ahmed", "Omar Khaled"],
  monthLabel: "August 2026",
  summary: { sessionsDelivered: 6, avgAttendance: "92%", classAverage: "78%", students: 24 },
  sessions: [
    { lesson: "1", date: "03 Aug 2026", topic: "Algebraic Expressions", attendanceRate: "96%" },
    { lesson: "2", date: "10 Aug 2026", topic: "Linear Equations", attendanceRate: "88%" },
    { lesson: "3", date: "17 Aug 2026", topic: "Coordinate Geometry", attendanceRate: "92%" },
    { lesson: "—", date: "24 Aug 2026", topic: "Day off", attendanceRate: "—" },
    { lesson: "4", date: "31 Aug 2026", topic: "Angles & Polygons", attendanceRate: "90%" },
  ],
  assessments: [
    { label: "Algebra Quiz 1", date: "10 Aug 2026", max: 20, classAvg: "78%" },
    { label: "Geometry Check", date: "31 Aug 2026", max: 15, classAvg: "81%" },
  ],
  students: [
    { code: "C4772", average: "84%", absences: 0 },
    { code: "C5031", average: "72%", absences: 2 },
    { code: "C6890", average: "91%", absences: 1 },
  ],
  homeworks: [
    { description: "Exercise 3A, Q1–10", due: "10 Aug 2026", submissionRate: "88%" },
    { description: "Past paper section B", due: "31 Aug 2026", submissionRate: "75%" },
  ],
};

async function main() {
  const buf = await renderToBuffer(ClassReportDoc({ data }));
  const out = process.argv[2] ?? "report-preview.pdf";
  await fs.writeFile(out, buf);
  console.log("wrote", out, buf.length, "bytes");
}
main();
