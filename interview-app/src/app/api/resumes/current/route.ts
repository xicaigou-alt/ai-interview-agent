import { NextResponse } from "next/server";
import { getCurrentResume, parseResumeRow } from "@/db/repositories/resumes";

export const runtime = "nodejs";

export async function GET() {
  const resume = getCurrentResume();
  if (!resume) {
    return NextResponse.json({ exists: false }, { status: 404 });
  }

  return NextResponse.json({
    exists: true,
    id: resume.id,
    rawText: resume.rawText,
    fileUrl: resume.fileUrl,
    parsedJson: parseResumeRow(resume),
  });
}
