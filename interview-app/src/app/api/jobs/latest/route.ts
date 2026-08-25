import { NextResponse } from "next/server";
import { getLatestJob, parseJobAnalysis } from "@/db/repositories/jobs";

export const runtime = "nodejs";

export async function GET() {
  try {
    const job = getLatestJob();
    if (!job) {
      return NextResponse.json({ job: null });
    }
    return NextResponse.json({
      job: {
        id: job.id,
        company: job.company,
        role: job.role,
        jdAnalysis: parseJobAnalysis(job),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
