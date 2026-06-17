import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { extractTextFromPdf } from "@/lib/pdf";
import { extractStudentNames } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

// Admin-only: PDF -> text (pdf-parse) -> names (Claude). PDF itself is never stored.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Short-circuit before any parsing if name extraction isn't configured.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Name extraction is not configured (missing ANTHROPIC_API_KEY)." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json({ error: "File must be a PDF." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;
  try {
    text = await extractTextFromPdf(buffer);
  } catch {
    return NextResponse.json(
      { error: "Could not read the PDF. Try another file or enter students manually." },
      { status: 422 },
    );
  }

  if (!text.trim()) {
    return NextResponse.json(
      { names: [], warning: "No text found in the PDF (it may be a scanned image)." },
    );
  }

  try {
    const names = await extractStudentNames(text);
    return NextResponse.json({ names });
  } catch {
    return NextResponse.json(
      { error: "Name extraction failed. Enter students manually." },
      { status: 502 },
    );
  }
}
