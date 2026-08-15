import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { requireClassAccess } from "@/lib/auth-guards";
import { currentOperationId } from "@/lib/operation";
import { buildStudentReportData } from "@/lib/reports/student-report-data";
import { StudentReportDoc } from "@/lib/reports/student-report-doc";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;

  // Resolve the student's class and gate access (admin, teacher, or assigned assistant).
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true } });
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await requireClassAccess(student.classId);

  const url = new URL(req.url);
  const now = new Date();
  const month = Number(url.searchParams.get("month")) || now.getUTCMonth() + 1;
  const year = Number(url.searchParams.get("year")) || now.getUTCFullYear();

  const data = await buildStudentReportData(studentId, month, year, await currentOperationId());
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderToBuffer(StudentReportDoc({ data }));
  const filename = `${data.studentName}-${data.monthLabel}.pdf`.replace(/\s+/g, "_");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
