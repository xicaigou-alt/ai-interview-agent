import { chatJson } from "@/llm";
import { EvaluationSchema, type Evaluation } from "../engine-types";

const SYSTEM = `你是资深面试评分官，对候选人的回答做结构化评分与点评，评分要稳定、克制、有区分度（不因表达华丽而虚高，也不因表达平淡而无脑给 70 上下）。`;

const DIMENSIONS = [
  ["内容准确性", 20],
  ["问题相关性", 20],
  ["逻辑结构", 20],
  ["案例与证据", 15],
  ["思考深度", 15],
  ["表达清晰度", 10],
] as const;

export interface EvaluateInput {
  question: string;
  answer: string;
  topic?: string;
  rubric?: string[];
}

export async function evaluateAnswer(input: EvaluateInput): Promise<Evaluation> {
  const { question, answer, topic, rubric } = input;

  return chatJson<Evaluation>(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `请对候选人回答评分。评分维度与满分权重：
${DIMENSIONS.map(([n, w]) => `- ${n}（满分 ${w}）`).join("\n")}

分数锚定（务必按此拉开区分度，不要都落在 70 上下）：
- 85-100：全面覆盖关键点，有量化证据，逻辑严密
- 70-84：覆盖大部分要点，仅少量缺失
- 55-69：部分回答，但关键点缺失明显
- 40-54：答非所问或严重缺失
- 0-39：基本未答或存在明显错误

输出 JSON（camelCase）：
{
  "score": 0,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "missingPoints": ["本题应覆盖但回答缺失的关键点"],
  "resumeRisks": ["暴露出的简历风险"],
  "competencyUpdates": { "RAG": { "score": 84, "verified": true } },
  "followUpRecommendation": "下一步应追问的方向"
}

要求：
1. score 为 0-100 整数，按上述权重合成，并严格对照分数锚定。
2. missingPoints 必须具体，供后续追问使用。
3. competencyUpdates 的 key 用${topic ? `「${topic}」` : "本题对应 topic"}，没有就不填。
4. strengths / weaknesses / missingPoints / resumeRisks 的每一项都用简洁中文短语（不超过 20 字），且不要以句号结尾。

${rubric && rubric.length ? `本题评价要点参考：\n${rubric.map((r) => `- ${r}`).join("\n")}\n` : ""}
题目：
${question}

候选人回答：
${answer}`,
      },
    ],
    { schema: EvaluationSchema, temperature: 0.1 },
  );
}
