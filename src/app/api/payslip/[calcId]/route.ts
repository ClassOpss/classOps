import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { currentOperationId } from "@/lib/operation";
import { buildPayslipData } from "@/lib/reports/payslip-data";
import { PayslipDoc } from "@/lib/reports/payslip-doc";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ calcId: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { calcId } = await params;

  const data = await buildPayslipData(calcId, await currentOperationId());
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderToBuffer(PayslipDoc({ data }));
  const filename = `Payslip-${data.assistantName}-${data.periodLabel}.pdf`.replace(/\s+/g, "_");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
