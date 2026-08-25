import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.SILICONFLOW_API_KEY,
      baseURL: process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1",
    });
  }
  return client;
}

// 半双工语音转文字（SiliconFlow SenseVoice，OpenAI 兼容 /audio/transcriptions）
// 用于「面试完语音复盘」：录音 → 转写 → 交给 parse-debrief 结构化。
export async function transcribeAudio(
  buffer: Buffer,
  filename: string,
  mimeType = "audio/webm",
): Promise<string> {
  const c = getClient();
  const model = process.env.STT_MODEL || "FunAudioLLM/SenseVoiceSmall";
  const file = new File([new Uint8Array(buffer)], filename || "audio.webm", { type: mimeType });
  const res = await c.audio.transcriptions.create({ model, file });
  return res.text;
}
