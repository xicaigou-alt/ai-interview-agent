import { NextResponse } from "next/server";
import { getJob, parseJobAnalysis } from "@/db/repositories/jobs";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const jobId = Number(id);

  if (!Number.isInteger(jobId)) {
    return NextResponse.json({ error: "无效的 id" }, { status: 400 });
  }

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "未找到该岗位" }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    company: job.company,
    role: job.role,
    jdText: job.jdText,
    jdAnalysis: parseJobAnalysis(job),
  });
}
