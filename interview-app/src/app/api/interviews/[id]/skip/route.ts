import { NextResponse } from "next/server";
import { loadEngineContext, skipQuestion } from "@/core/interview/engine";

export const runtime = "nodejs";

// 跳过当前问题，直接进入下一主问题
export async function POST(
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
    const result = await skipQuestion(ctx);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
