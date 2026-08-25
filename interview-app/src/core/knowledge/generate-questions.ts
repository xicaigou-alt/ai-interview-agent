import { chatJson } from "@/llm";
import { z } from "zod";

const SYSTEM = `你是资深面试官，擅长针对特定岗位与 topic 批量生成高质量的面试题。`;

const GeneratedQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string(),
        questionType: z.string().default("AI_KNOWLEDGE"),
        topics: z.array(z.string()).default([]),
        difficulty: z.string().default("medium"),
        knowledgePoints: z.array(z.string()).default([]),
        evaluationRubric: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

export interface GeneratedQuestion {
  question: string;
  questionType: string;
  topics: string[];
  difficulty: string;
  knowledgePoints: string[];
  evaluationRubric: string[];
}

export interface GenerateQuestionsInput {
  role: string;
  topic: string;
  difficulty: string;
  count?: number;
}

export async function generateQuestions(
  input: GenerateQuestionsInput,
): Promise<GeneratedQuestion[]> {
  const { role, topic, difficulty, count = 5 } = input;

  const out = await chatJson<z.infer<typeof GeneratedQuestionsSchema>>(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `请为「${role}」岗位生成 ${count} 道关于「${topic}」的面试题（难度：${difficulty}）。

输出 JSON（camelCase）：
{
  "questions": [
    {
      "question": "...",
      "questionType": "AI_KNOWLEDGE",
      "topics": ["${topic}"],
      "difficulty": "${difficulty}",
      "knowledgePoints": ["本题应考察的知识点"],
      "evaluationRubric": ["评价要点"]
    }
  ]
}

要求：
1. 题目要有区分度，避免重复。
2. knowledgePoints 与 evaluationRubric 用于后续稳定评分。
3. 只输出 JSON。`,
      },
    ],
    { schema: GeneratedQuestionsSchema, temperature: 0.6 },
  );

  return out.questions;
}
