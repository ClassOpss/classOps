import "server-only";
import { PDFParse } from "pdf-parse";

// Extract concatenated plain text from a PDF buffer (pdf-parse v2 API).
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy().catch(() => {});
  }
}
