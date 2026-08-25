import { NextResponse } from "next/server";
import { parseResume } from "@/core/resume/parse-resume";
import { createResume, updateResumeParsed } from "@/db/repositories/resumes";
import { extractTextFromFile } from "@/lib/file-parser";
import { saveUpload } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let rawText = "";
    let fileUrl: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (file instanceof File) {
        rawText = await extractTextFromFile(file);
        fileUrl = await saveUpload(file);
      } else {
        rawText = String(formData.get("raw_text") ?? "");
      }
    } else {
      const body = await req.json();
      rawText = String(body.raw_text ?? "");
    }

    rawText = rawText.trim();
    if (!rawText) {
      return NextResponse.json({ error: "请提供简历文本或简历文件" }, { status: 400 });
    }

    const resume = createResume(rawText, fileUrl);
    const profile = await parseResume(rawText);
    updateResumeParsed(resume.id, profile);

    return NextResponse.json({ id: resume.id, parsedJson: profile });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
