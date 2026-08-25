import { NextResponse } from "next/server";
import { parseDebrief } from "@/core/debrief/parse-debrief";

export const runtime = "nodejs";

// 解析复盘文本，返回结构化草稿（不落库，等用户确认后再 POST /api/real-interviews）
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = String(body.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "text 不能为空" }, { status: 400 });
    }

    const result = await parseDebrief(text);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
