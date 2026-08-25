import { NextResponse } from "next/server";
import { getCurrentResume } from "@/db/repositories/resumes";
import { getLatestJob } from "@/db/repositories/jobs";
import { createSession, listSessionsWithJob } from "@/db/repositories/interview_sessions";
import { getSessionAvgScore } from "@/db/repositories/interview_turns";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const resumeId = body.resume_id ?? getCurrentResume()?.id ?? null;
    const jobId = body.job_id ?? getLatestJob()?.id ?? null;

    if (!resumeId || !jobId) {
      return NextResponse.json(
        { error: "请先上传简历并完成岗位分析，再创建面试" },
        { status: 400 },
      );
    }

    // 目标主问题数：用户可选，未填则用规划器默认（10）
    let questionTarget: number | null = null;
    if (body.question_target != null) {
      const n = Number(body.question_target);
      if (Number.isInteger(n) && n >= 3 && n <= 30) {
        questionTarget = n;
      }
    }

    const requirement = String(body.requirement ?? "").trim() || null;

    // 训练模式已移除：统一实时评分反馈（内部固定 coaching 行为）
    const session = createSession(resumeId, jobId, "coaching", questionTarget, requirement);
    return NextResponse.json({ id: session.id, questionTarget, requirement });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sessions = listSessionsWithJob().map((s) => {
      let weaknesses: string[] = [];
      try {
        const state = s.candidateState ? JSON.parse(s.candidateState) : null;
        weaknesses = state?.weaknesses ?? [];
      } catch {
        weaknesses = [];
      }
      return {
        id: s.id,
        mode: s.mode,
        status: s.status,
        title: s.title,
        company: s.company,
        role: s.role,
        resumeId: s.resumeId,
        jobId: s.jobId,
        questionTarget: s.questionTarget,
        requirement: s.requirement,
        avgScore: getSessionAvgScore(s.id),
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        createdAt: s.createdAt,
        weaknesses,
      };
    });
    return NextResponse.json({ sessions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
