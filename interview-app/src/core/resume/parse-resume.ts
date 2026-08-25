import { chatJson } from "@/llm";
import { CandidateProfileSchema, type CandidateProfile } from "../types";

const SYSTEM = `你是资深招聘面试官和技术负责人，擅长从简历中提取结构化信息，并预判面试官会如何追问。`;

const TEMPLATE = `{
  "basicInfo": { "name": "", "email": "", "phone": "", "yearsOfExperience": "", "currentRole": "" },
  "education": [ { "school": "", "degree": "", "major": "", "period": "" } ],
  "experience": [ { "company": "", "role": "", "period": "", "description": "" } ],
  "projects": [ { "name": "", "role": "", "description": "", "techStack": ["..."] } ],
  "skills": ["..."],
  "aiExperience": ["简历中与 AI 相关的经历/项目要点"],
  "productExperience": ["简历中与产品相关的经历/要点"],
  "metrics": ["简历中出现的所有量化指标，如效率提升40%"],
  "strengths": ["候选人的明显强项"],
  "riskPoints": ["简历中夸大、无证据、可能被质疑的表述"],
  "followUpPoints": ["面试官最可能追问的具体问题"]
}`;

export async function parseResume(rawText: string): Promise<CandidateProfile> {
  const truncated = rawText.slice(0, 12000);

  return chatJson<CandidateProfile>(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `请解析以下简历，输出严格符合下面 JSON 结构（字段名用 camelCase）：

${TEMPLATE}

要求：
1. riskPoints 专门找「夸大 / 无证据」的表述（例如「提升效率 40%」但没有说明计算方法）。
2. followUpPoints 必须具体可追问（例如「为什么用 RAG 而不是长上下文」「40% 是如何计算的」「你的个人贡献是什么」），不要泛泛而谈。
3. 只输出 JSON，不要任何多余文字。

简历原文：
${truncated}`,
      },
    ],
    { schema: CandidateProfileSchema, temperature: 0.1 },
  );
}
