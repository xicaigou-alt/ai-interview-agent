import { NextResponse } from "next/server";
import { loadEngineContext } from "@/core/interview/engine";
import { buildReport } from "@/core/report/build-report";
import { listTurns } from "@/db/repositories/interview_turns";
import { completeSession } from "@/db/repositories/interview_sessions";
import { persistPrimaryQuestionsToKnowledge } from "@/core/knowledge/persist-simulated";
import type { Evaluation } from "@/core/engine-types";

export const runtime = "nodejs";

function parseEvaluation(s: string | null): Evaluation | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as Evaluation;
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const sessionId = Number(id);
    if (!Number.isInteger(sessionId)) {
      return NextResponse.json({ error: "无效的 id" }, { status: 400 });
    }

    const ctx = loadEngineContext(sessionId);
    const turns = listTurns(sessionId).map((t) => ({
      question: t.questionText,
      answer: t.answer,
      isFollowUp: t.isFollowUp,
      evaluation: parseEvaluation(t.evaluation),
    }));

    const report = await buildReport({
      company: ctx.job.company,
      role: ctx.job.role,
      plan: ctx.plan,
      candidateState: ctx.state,
      turns,
    });

    completeSession(sessionId);
    // 结束后把母问题沉淀进知识库（失败不影响报告）
    try {
      await persistPrimaryQuestionsToKnowledge(sessionId);
    } catch {
      // 忽略沉淀失败
    }
    // 附带完整问答记录，供报告页展示
    return NextResponse.json({ ...report, turns });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
