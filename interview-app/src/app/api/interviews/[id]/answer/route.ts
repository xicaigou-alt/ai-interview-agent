import { NextResponse } from "next/server";
import { loadEngineContext, handleAnswer } from "@/core/interview/engine";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const sessionId = Number(id);
    if (!Number.isInteger(sessionId)) {
      return NextResponse.json({ error: "无效的 id" }, { status: 400 });
    }

    const body = await req.json();
    const answer = String(body.answer ?? "").trim();
    if (!answer) {
      return NextResponse.json({ error: "answer 不能为空" }, { status: 400 });
    }

    const ctx = loadEngineContext(sessionId);
    const result = await handleAnswer(ctx, answer);

    // 统一实时评分反馈
    return NextResponse.json({
      finished: result.finished,
      question: result.question,
      isFollowUp: result.isFollowUp,
      decision: result.decision,
      evaluation: result.evaluation,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
