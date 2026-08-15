import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { currentOperationId } from "@/lib/operation";
import { buildOperationReportData } from "@/lib/reports/operation-report-data";
import { OperationReportDoc } from "@/lib/reports/operation-report-doc";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "teacher")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const now = new Date();
  const month = Number(url.searchParams.get("month")) || now.getUTCMonth() + 1;
  const year = Number(url.searchParams.get("year")) || now.getUTCFullYear();

  const data = await buildOperationReportData(await currentOperationId(), month, year);
  const buffer = await renderToBuffer(OperationReportDoc({ data }));
  const filename = `${data.brandName}-${data.monthLabel}.pdf`.replace(/\s+/g, "_");
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"` },
  });
}
