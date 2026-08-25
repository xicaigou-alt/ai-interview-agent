import { chatText } from "@/llm";
import type { CandidateProfile } from "../types";

const SYSTEM = `你是真实面试场景中的面试官。请把给定问题结合候选人的简历与岗位 JD 改写得更具体、更有针对性，但保持一次只问一个核心问题。`;

export async function personalizeQuestion(input: {
  baseQuestion: string;
  profile: CandidateProfile;
  jdText: string;
  requirement?: string | null;
}): Promise<string> {
  const { baseQuestion, profile, jdText, requirement } = input;

  return chatText([
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `请改写下面这个问题，使其结合候选人的真实经历（简历）与岗位 JD，更贴近真实面试。规则：
1. 一次只问一个核心问题。
2. 不要提前泄露答案、不要评价。
3. 若简历/JD 中没有相关锚点，就保持原问题。
4. 问题以问号结尾，不得出现多余标点（如连续句号、分号堆叠）。

原始问题：
${baseQuestion}

候选人简历要点：
${JSON.stringify({
  skills: profile.skills,
  projects: profile.projects?.map((p) => ({ name: p.name, description: p.description })),
  experience: profile.experience?.map((e) => ({ company: e.company, role: e.role, description: e.description })),
})}

岗位 JD（节选）：
${jdText.slice(0, 2000)}
${requirement ? `\n面试要求/风格（在不改变核心考察点的前提下，让提问方式贴合该要求）：\n${requirement}\n` : ""}

只输出改写后的问题本身，不要任何多余文字。`,
    },
  ]);
}
