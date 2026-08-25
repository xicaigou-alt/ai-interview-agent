import { chatJson } from "@/llm";
import { z } from "zod";

const SYSTEM = `你是面试情报整理助手，擅长从面经文本中抽取、归一化、分类面试题，并按面试轮次切分。`;

const QuestionSchema = z.object({
  question: z.string(),
  questionType: z.string().default("AI_KNOWLEDGE"),
  topics: z.array(z.string()).default([]),
  difficulty: z.string().default("medium"),
  knowledgePoints: z.array(z.string()).default([]),
  evaluationRubric: z.array(z.string()).default([]),
});

export const ImportedTextSchema = z.object({
  company: z.string().optional(),
  role: z.string().optional(),
  warnings: z.array(z.string()).default([]),
  rounds: z
    .array(
      z.object({
        round: z.string().optional(),
        summary: z.string().optional(),
        questions: z.array(QuestionSchema).default([]),
      }),
    )
    .default([]),
});

export interface ExtractedQuestion {
  question: string;
  questionType: string;
  topics: string[];
  difficulty: string;
  knowledgePoints: string[];
  evaluationRubric: string[];
}

export interface ImportRound {
  round?: string;
  summary?: string;
  questions: ExtractedQuestion[];
}

export interface ImportResult {
  company?: string;
  role?: string;
  warnings?: string[];
  rounds: ImportRound[];
}

export async function importText(text: string): Promise<ImportResult> {
  const out = await chatJson<z.infer<typeof ImportedTextSchema>>(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `请从下面的面经文本中抽取面试题，做归一化、分类、去重，并按面试轮次切分（可能包含多轮）。

输出 JSON（camelCase）：
{
  "company": "公司名（若可推断）",
  "role": "岗位名（若可推断）",
  "warnings": ["需要用户注意的信息，如：检测到多个公司/岗位、部分内容无法归入某轮等；没有则留空数组"],
  "rounds": [
    {
      "round": "一面 / 二面 / 三面 / HR面 / 技术面 / 笔试 / 终面",
      "summary": "该轮面试的整体感受/总结（作者若有个人反思、风格评价、经验教训就提炼成一段，没有则省略）",
      "questions": [
        {
          "question": "归一化后的完整问题",
          "questionType": "AI_KNOWLEDGE / RESUME_DEEP_DIVE / PRODUCT_DESIGN / BEHAVIORAL / JD_GAP",
          "topics": ["相关 topic"],
          "difficulty": "easy / medium / hard",
          "knowledgePoints": ["考察知识点"],
          "evaluationRubric": ["评价要点"]
        }
      ]
    }
  ]
}

要求：
1. 问题要归一化成可直接提问的形式，去除「他问了我……」「然后聊了……」等叙述。
2. 同一轮内合并重复问题。
3. 按文本中的轮次标记（一面/二面/三面/HR面/技术面/笔试/终面等）把问题切分到对应轮次；若文本没有明显轮次标记，把全部问题归为一个轮次（round 省略）。
4. summary 属于「该轮面试」而非某一题，没有感受/总结就省略。
5. company/role 取第一个识别到的；若文本中出现多个公司或岗位，在 warnings 里说明。
6. 只输出 JSON。

面经原文：
${text.slice(0, 24000)}`,
      },
    ],
    { schema: ImportedTextSchema, temperature: 0.2 },
  );

  return out;
}
