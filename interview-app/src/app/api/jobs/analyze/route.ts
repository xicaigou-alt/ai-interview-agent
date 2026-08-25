import { NextResponse } from "next/server";
import { analyzeJd } from "@/core/jd/analyze-jd";
import { createJob, updateJobAnalysis } from "@/db/repositories/jobs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const company = String(body.company ?? "").trim();
    const role = String(body.role ?? "").trim();
    const jdText = String(body.jd_text ?? "").trim();

    if (!company || !role || !jdText) {
      return NextResponse.json({ error: "company / role / jd_text 均必填" }, { status: 400 });
    }

    const model = await analyzeJd(jdText, company, role);
    const job = createJob(company, role, jdText);
    updateJobAnalysis(job.id, model);

    return NextResponse.json({ id: job.id, jdAnalysis: model });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
