import { renderToBuffer } from "@react-pdf/renderer";
import { promises as fs } from "fs";
import { OperationReportDoc } from "../src/lib/reports/operation-report-doc";
import type { OperationReportData } from "../src/lib/reports/operation-report-data";

const data: OperationReportData = {
  logoDataUri: null,
  brandName: "Math by Mo",
  generatedAt: "18 Aug 2026",
  monthLabel: "August 2026",
  currency: "EGP",
  kpis: {
    sessionsDelivered: 34, sessionsPlanned: 40, avgAttendance: "89%", avgGrade: "77%",
    students: 128, activeClasses: 6, activeAssistants: 4, hwCompletion: "82%",
    needsAttention: 5, payTotal: "18,400 EGP",
  },
  classes: [
    { name: "Y9 — Citadel", school: "Citadel International", students: 24, attendance: "92%", avgGrade: "78%" },
    { name: "Y10 — Noon", school: "Noon School", students: 18, attendance: "85%", avgGrade: "74%" },
    { name: "S1 — Summits", school: "Summits Academy", students: 21, attendance: "90%", avgGrade: "81%" },
  ],
  assistants: [
    { name: "Sara Ahmed", sessions: 12, officeHours: 4, incidents: 0, netPay: "5,400 EGP" },
    { name: "Omar Khaled", sessions: 10, officeHours: 2, incidents: 1, netPay: "4,600 EGP" },
    { name: "Layla Hassan", sessions: 8, officeHours: 6, incidents: 0, netPay: "4,800 EGP" },
  ],
};

async function main() {
  const buf = await renderToBuffer(OperationReportDoc({ data }));
  const out = process.argv[2] ?? "operation-report-preview.pdf";
  await fs.writeFile(out, buf);
  console.log("wrote", out, buf.length, "bytes");
}
main();
