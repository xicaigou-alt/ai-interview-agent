import { chatJson } from "@/llm";
import { CompetencyModelSchema, type CompetencyModel } from "../types";

const SYSTEM = `你是资深 AI 产品经理面试官，擅长把岗位 JD 转化为结构化能力模型。`;

const TEMPLATE = `{
  "role": "岗位名",
  "company": "公司名",
  "categories": [
    {
      "name": "Product",
      "competencies": [ { "name": "Requirement Analysis", "description": "..." } ]
    },
    {
      "name": "AI",
      "competencies": [ { "name": "LLM", "description": "..." }, { "name": "RAG" }, { "name": "Agent" } ]
    },
    {
      "name": "Technical",
      "competencies": [ { "name": "API" }, { "name": "Data" }, { "name": "System Architecture" } ]
    },
    {
      "name": "Business",
      "competencies": [ { "name": "Industry" }, { "name": "ROI" } ]
    },
    {
      "name": "Behavioral",
      "competencies": [ { "name": "Communication" }, { "name": "Ownership" } ]
    }
  ],
  "priorityRequirements": ["JD 中最看重的 3-6 条硬性要求"]
}`;

export async function analyzeJd(
  jdText: string,
  company: string,
  role: string,
): Promise<CompetencyModel> {
  const truncated = jdText.slice(0, 12000);

  return chatJson<CompetencyModel>(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `请把下面的 JD 转化为岗位能力模型，输出严格符合下面 JSON 结构（camelCase）：

${TEMPLATE}

要求：
1. categories 必须覆盖 Product / AI / Technical / Business / Behavioral 五类；某类 JD 确实没提可给空数组。
2. competencies 要具体（从 JD 措辞推断），不要塞通用模板。
3. priorityRequirements 只列 JD 中真正强调的硬性要求。
4. 只输出 JSON。

公司：${company}
岗位：${role}

JD 原文：
${truncated}`,
      },
    ],
    { schema: CompetencyModelSchema, temperature: 0.1 },
  );
}
