import { NextResponse } from "next/server";
import { importText } from "@/core/knowledge/import-text";

export const runtime = "nodejs";

// 只解析、不落库：返回结构化草稿，供前端预览、用户确认后再保存
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = String(body.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "text 不能为空" }, { status: 400 });
    }

    const result = await importText(text);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
