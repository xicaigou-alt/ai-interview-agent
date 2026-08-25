import { chatJson } from "@/llm";
import {
  GapResultSchema,
  type CandidateProfile,
  type CompetencyModel,
  type GapResult,
} from "../types";

const SYSTEM = `你是资深面试教练，擅长对比候选人简历画像与岗位能力模型，找出差距与风险。`;

const TEMPLATE = `{
  "strongMatch": ["强匹配的能力"],
  "mediumMatch": ["中等匹配的能力"],
  "weakMatch": ["弱匹配的能力"],
  "missingCapabilities": ["简历中缺失、但 JD 要求的能力"],
  "resumeRisks": ["简历中可能被追问/质疑的风险点"],
  "highPriorityTopics": ["本场面试应优先考察的 topic"]
}`;

export async function analyzeGap(
  profile: CandidateProfile,
  model: CompetencyModel,
): Promise<GapResult> {
  return chatJson<GapResult>(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `请对比下面的候选人简历画像与岗位能力模型，输出差距分析，严格符合 JSON 结构（camelCase）：

${TEMPLATE}

要求：
1. highPriorityTopics 与 weakMatch / missingCapabilities 强相关，用于后续面试选题。
2. resumeRisks 要具体（指出简历哪句表述有风险、为什么）。
3. 只输出 JSON。

候选人画像：
${JSON.stringify(profile)}

岗位能力模型：
${JSON.stringify(model)}`,
      },
    ],
    { schema: GapResultSchema, temperature: 0.1 },
  );
}
