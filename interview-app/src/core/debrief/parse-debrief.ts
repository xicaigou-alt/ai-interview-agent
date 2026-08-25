import { chatJson } from "@/llm";
import { z } from "zod";

const SYSTEM = `你是面试复盘助手，擅长把用户的真实面试叙述结构化。`;

const DebriefSchema = z.object({
  company: z.string(),
  role: z.string(),
  round: z.string().default("一面"),
  date: z.string().optional(),
  questions: z
    .array(
      z.object({
        question: z.string(),
        type: z.string().default("AI_KNOWLEDGE"),
        topics: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  notes: z.string().default(""),
});

export interface DebriefQuestion {
  question: string;
  type: string;
  topics: string[];
}

export interface DebriefResult {
  company: string;
  role: string;
  round: string;
  date?: string;
  questions: DebriefQuestion[];
  notes: string;
}

export async function parseDebrief(text: string): Promise<DebriefResult> {
  const out = await chatJson<z.infer<typeof DebriefSchema>>(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `请把下面的真实面试叙述结构化，抽取面试官问过的问题。

输出 JSON（camelCase）：
{
  "company": "公司名",
  "role": "岗位名",
  "round": "一面",
  "date": "2026-08",
  "questions": [
    { "question": "归一化后的问题", "type": "AI_KNOWLEDGE / RESUME_DEEP_DIVE / PRODUCT_DESIGN / BEHAVIORAL", "topics": ["..."] }
  ],
  "notes": "其他值得记录的备注"
}

要求：
1. 问题归一化成可直接检索的形式。
2. company / role 若无法从文本判断，用「未知」占位（后续用户确认时可改）。
3. round 用中文短标签（一面 / 二面 / 三面 / HR面 / 技术面 / 笔试 / 终面）。
4. 只输出 JSON。

真实面试叙述：
${text.slice(0, 8000)}`,
      },
    ],
    { schema: DebriefSchema, temperature: 0.1 },
  );

  return out;
}
