import { renderToBuffer } from "@react-pdf/renderer";
import { promises as fs } from "fs";
import { PayslipDoc } from "../src/lib/reports/payslip-doc";
import type { PayslipData } from "../src/lib/reports/payslip-data";

const data: PayslipData = {
  logoDataUri: null,
  brandName: "Math by Mo",
  currency: "EGP",
  generatedAt: "18 Aug 2026",
  assistantName: "Sara Ahmed",
  periodLabel: "August 2026",
  status: "sent",
  classesCovered: 3,
  lines: [
    { label: "Base salary (3 classes)", amount: 3000 },
    { label: "Office-hour bonus", amount: 200 },
    { label: "Coverage adjustment", amount: 50 },
    { label: "Late deductions", amount: -100 },
    { label: "Manual adjustment", amount: 150, note: "Eid bonus" },
  ],
  total: 3300,
};

async function main() {
  const buf = await renderToBuffer(PayslipDoc({ data }));
  const out = process.argv[2] ?? "payslip-preview.pdf";
  await fs.writeFile(out, buf);
  console.log("wrote", out, buf.length, "bytes");
}
main();
