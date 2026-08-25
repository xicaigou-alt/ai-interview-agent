import { NextResponse } from "next/server";
import { importImages } from "@/core/knowledge/import-images";

export const runtime = "nodejs";

// 批量图片导入：同一公司/岗位不同轮次的截图，合并后做内容分割（不落库，等用户确认后保存）
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { imageDataUrls?: string[] };
    const urls = Array.isArray(body.imageDataUrls) ? body.imageDataUrls : [];
    if (urls.length === 0) {
      return NextResponse.json({ error: "imageDataUrls 不能为空" }, { status: 400 });
    }
    if (urls.some((u) => typeof u !== "string" || !u.startsWith("data:image"))) {
      return NextResponse.json(
        { error: "imageDataUrls 需为 data:image 格式的图片数据数组" },
        { status: 400 },
      );
    }

    const result = await importImages(urls);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
