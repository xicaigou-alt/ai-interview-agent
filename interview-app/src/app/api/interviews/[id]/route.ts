import { NextResponse } from "next/server";
import { getSession, updateSessionTitle } from "@/db/repositories/interview_sessions";

export const runtime = "nodejs";

// 重命名历史面试（title 便于区分公司/岗位）
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const sessionId = Number(id);
    if (!Number.isInteger(sessionId)) {
      return NextResponse.json({ error: "无效的 id" }, { status: 400 });
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }

    const body = await req.json();
    const title = String(body.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "title 不能为空" }, { status: 400 });
    }

    updateSessionTitle(sessionId, title);
    return NextResponse.json({ id: sessionId, title });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
