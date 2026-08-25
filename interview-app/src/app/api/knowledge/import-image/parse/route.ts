import { NextResponse } from "next/server";
import { importImage } from "@/core/knowledge/import-image";

export const runtime = "nodejs";

// 解析面试经验截图，返回结构化草稿（不落库，等用户确认后再 POST /api/knowledge/import-text）
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { imageDataUrl?: string };
    const imageDataUrl = String(body.imageDataUrl ?? "").trim();
    if (!imageDataUrl.startsWith("data:image")) {
      return NextResponse.json({ error: "imageDataUrl 需为 data:image 格式的图片数据" }, { status: 400 });
    }

    const result = await importImage(imageDataUrl);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
