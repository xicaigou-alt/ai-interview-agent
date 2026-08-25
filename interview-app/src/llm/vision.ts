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

// 视觉模型（SiliconFlow Qwen2.5-VL，OpenAI 兼容），根据 prompt 理解图片并返回文本。
// DeepSeek 主 API 不支持视觉，故走 SiliconFlow。
export async function understandImage(imageDataUrl: string, prompt: string): Promise<string> {
  const c = getClient();
  const model = process.env.VISION_MODEL || "Qwen/Qwen2.5-VL-32B-Instruct";
  const res = await c.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    temperature: 0.2,
  });
  return res.choices[0]?.message?.content ?? "";
}
