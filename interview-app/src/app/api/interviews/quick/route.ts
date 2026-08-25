import { NextResponse } from "next/server";
import { getCurrentResume } from "@/db/repositories/resumes";
import { getLatestJob } from "@/db/repositories/jobs";
import { createSession } from "@/db/repositories/interview_sessions";
import { analyzeSession, loadEngineContext, startInterview } from "@/core/interview/engine";

export const runtime = "nodejs";

// 「继续模拟」快捷入口：复用已保存的简历+JD，创建会话 → 分析 → 立即开始，返回会话 id
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const resumeId = body.resume_id ?? getCurrentResume()?.id ?? null;
    const jobId = body.job_id ?? getLatestJob()?.id ?? null;

    if (!resumeId || !jobId) {
      return NextResponse.json(
        { error: "请先上传简历并完成岗位分析，再开始模拟" },
        { status: 400 },
      );
    }

    let questionTarget: number | null = null;
    if (body.question_target != null) {
      const n = Number(body.question_target);
      if (Number.isInteger(n) && n >= 3 && n <= 30) questionTarget = n;
    }
    const requirement = String(body.requirement ?? "").trim() || null;

    const session = createSession(resumeId, jobId, "coaching", questionTarget, requirement);
    await analyzeSession(session.id);
    const ctx = loadEngineContext(session.id);
    await startInterview(ctx);

    return NextResponse.json({ id: session.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
