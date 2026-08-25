import { NextResponse } from "next/server";
import { transcribeAudio } from "@/llm/asr";

export const runtime = "nodejs";

// 半双工语音转写：接收音频文件（multipart form-data），返回转写文本
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "需要上传音频文件（file 字段）" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await transcribeAudio(buffer, file.name || "audio.webm", file.type || "audio/webm");
    return NextResponse.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
