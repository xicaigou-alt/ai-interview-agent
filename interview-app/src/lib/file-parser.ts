import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export async function extractTextFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) return extractPdf(buffer);
  if (name.endsWith(".docx")) return extractDocx(buffer);
  if (name.endsWith(".txt") || name.endsWith(".md")) return buffer.toString("utf-8");

  throw new Error("不支持的简历格式：仅支持 PDF / DOCX / TXT / MD");
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return (data.text ?? "").trim();
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return (result.value ?? "").trim();
}
