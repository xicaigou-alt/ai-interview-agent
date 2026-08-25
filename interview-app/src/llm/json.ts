import type { ZodType, ZodTypeDef } from "zod";

// 解析 LLM 返回的 JSON：容忍 markdown 代码块包裹，再经 Zod 校验
export function parseJsonContent<T>(raw: string, schema?: ZodType<T, ZodTypeDef, any>): T {
  let cleaned = raw.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1].trim();

  const parsed = JSON.parse(cleaned) as T;
  return schema ? schema.parse(parsed) : parsed;
}
