import { chatJson } from "@/llm";
import { z } from "zod";
import type { CandidateProfile } from "../types";

const SYSTEM = `你是资深面试官，擅长针对特定 topic 生成高质量、可追问的面试主问题。`;

const GeneratedQuestionSchema = z.object({
  question: z.string(),
  questionType: z.string().default("AI_KNOWLEDGE"),
  topics: z.array(z.string()).default([]),
  difficulty: z.string().default("medium"),
});

export interface GenerateQuestionInput {
  role: string;
  topic: string;
  difficulty: string;
  profile: CandidateProfile;
  jdText: string;
}

export async function generateQuestion(
  input: GenerateQuestionInput,
): Promise<{ question: string; questionType: string; topics: string[]; difficulty: string }> {
  const { role, topic, difficulty, profile, jdText } = input;

  const out = await chatJson<z.infer<typeof GeneratedQuestionSchema>>(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `请为「${role}」岗位生成一道关于「${topic}」的面试主问题（难度：${difficulty}）。

要求：
1. 只问一个核心问题，不要连环问。
2. 不要给出答案或提示。
3. 结合岗位背景，但保留后续由 Interviewer 做简历个性化。

输出 JSON（camelCase）：
{ "question": "...", "questionType": "AI_KNOWLEDGE", "topics": ["${topic}"], "difficulty": "${difficulty}" }

岗位 JD（节选）：
${jdText.slice(0, 2000)}

候选人技能关键词：
${(profile.skills ?? []).slice(0, 20).join("、")}`,
      },
    ],
    { schema: GeneratedQuestionSchema, temperature: 0.5 },
  );

  return out;
}
