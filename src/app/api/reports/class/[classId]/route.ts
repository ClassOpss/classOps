import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { buildClassReportData } from "@/lib/reports/class-report-data";
import { ClassReportDoc } from "@/lib/reports/class-report-doc";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "teacher")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { classId } = await params;
  const url = new URL(req.url);
  const now = new Date();
  const month = Number(url.searchParams.get("month")) || now.getUTCMonth() + 1;
  const year = Number(url.searchParams.get("year")) || now.getUTCFullYear();

  const data = await buildClassReportData(classId, month, year);
  if (!data) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const buffer = await renderToBuffer(ClassReportDoc({ data }));
  const filename = `${data.className}-${data.monthLabel}.pdf`.replace(/\s+/g, "_");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
