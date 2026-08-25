import { NextResponse } from "next/server";
import { loadEngineContext } from "@/core/interview/engine";
import { countPrimaryTurns, getLastTurn } from "@/db/repositories/interview_turns";

export const runtime = "nodejs";

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
    const lastTurn = getLastTurn(sessionId);
    const primaryCount = countPrimaryTurns(sessionId);

    return NextResponse.json({
      id: sessionId,
      status: ctx.session.status,
      mode: ctx.mode,
      currentQuestion: lastTurn?.questionText ?? null,
      currentTurnId: lastTurn?.id ?? null,
      primaryCount,
      questionTarget: ctx.plan.primaryQuestionTarget ?? 10,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
