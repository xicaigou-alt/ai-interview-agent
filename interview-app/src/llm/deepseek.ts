import OpenAI from "openai";
import { parseJsonContent } from "./json";
import type { ChatMessage, JsonLlmOptions, LlmOptions } from "./types";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    });
  }
  return client;
}

// 纯文本输出（用于提问、追问等自然语言场景）
export async function chatText(
  messages: ChatMessage[],
  opts: LlmOptions = {},
): Promise<string> {
  const c = getClient();
  const res = await c.chat.completions.create({
    model: opts.model ?? process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    messages,
    temperature: opts.temperature ?? 0.3,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
  });
  return res.choices[0]?.message?.content ?? "";
}

// JSON 输出（用于解析、评分、决策等结构化场景），带 Zod 校验与重试
export async function chatJson<T>(
  messages: ChatMessage[],
  opts: JsonLlmOptions<T> = {},
): Promise<T> {
  const c = getClient();
  const model = opts.model ?? process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

  const convo = ensureJsonHint(messages);
  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await c.chat.completions.create({
      model,
      messages: convo,
      temperature: opts.temperature ?? 0.2,
      response_format: { type: "json_object" },
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    });

    const content = res.choices[0]?.message?.content ?? "";
    try {
      return parseJsonContent<T>(content, opts.schema);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      convo.push({
        role: "user",
        content: `你上一次的输出不是合法 JSON（错误：${lastError}）。请只输出合法 JSON，不要包含多余文字或代码块。`,
      });
    }
  }

  throw new Error(`chatJson 多次重试后仍失败：${lastError}`);
}

// DeepSeek 的 json_object 模式要求消息里出现 "json" 字样
function ensureJsonHint(messages: ChatMessage[]): ChatMessage[] {
  const hasJson = messages.some((m) => /json/i.test(m.content));
  if (hasJson) return [...messages];
  return [
    {
      role: "system",
      content:
        "You are a helpful assistant. Always respond with valid JSON only (no markdown fences, no extra text).",
    },
    ...messages,
  ];
}
