import { chatJson, chatText } from "@/llm";
import { z } from "zod";

const SYSTEM = `你是资深面试官，擅长针对特定 topic 生成高质量、可追问的面试主问题。`;

const GeneratedQuestionSchema = z.object({
  question: z.string(),
  questionType: z.string().default("AI_KNOWLEDGE"),
  topics: z.array(z.string()).default([]),
  difficulty: z.string().default("medium"),
});

export interface KnowledgeQuestionInput {
  role: string;
  topic: string;
  difficulty: string;
  jdText: string;
  priorityRequirements?: string[];
  askedQuestions?: string[];
}

// KNOWLEDGE 知识题：通用、不绑定任何候选人简历经历（问题方案 v2 §3.1）
export async function generateKnowledgeQuestion(
  input: KnowledgeQuestionInput,
): Promise<{ question: string; questionType: string; topics: string[]; difficulty: string }> {
  const { role, topic, difficulty, jdText, priorityRequirements, askedQuestions } = input;

  const out = await chatJson<z.infer<typeof GeneratedQuestionSchema>>(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `请为「${role}」岗位出一道关于「${topic}」的**知识考察题**（难度：${difficulty}）。

要求：
1. 这是一道通用的知识/专业能力考察题：**只考察知识点本身**，绝不涉及任何候选人简历经历、项目或公司。
2. 可以结合岗位 JD 的业务语境（一句话场景），让题目更贴近实际工作。
3. 只问一个核心问题，不要连环问；不要给出答案或提示。
4. 避免与「已问过的问题」重复或角度雷同。

输出 JSON（camelCase）：
{ "question": "...", "questionType": "AI_KNOWLEDGE", "topics": ["${topic}"], "difficulty": "${difficulty}" }

岗位 JD 重点要求（priorityRequirements，作业务语境参考）：
${(priorityRequirements ?? []).length ? priorityRequirements!.map((r) => `- ${r}`).join("\n") : "（无）"}

已问过的问题（避免重复）：
${(askedQuestions ?? []).length ? askedQuestions!.map((q) => `- ${q}`).join("\n") : "（暂无）"}

岗位 JD（节选）：
${jdText.slice(0, 1500)}`,
      },
    ],
    { schema: GeneratedQuestionSchema, temperature: 0.5 },
  );

  return out;
}

export interface ScenarioQuestionInput {
  role: string;
  scenario: string;
  difficulty: string;
  jdText: string;
  askedQuestions?: string[];
}

// JD_SCENARIO 情景设计题：结合 JD 业务场景，不绑定候选人简历（问题方案 v2 §6.4）
export async function generateScenarioQuestion(
  input: ScenarioQuestionInput,
): Promise<{ question: string; questionType: string; topics: string[]; difficulty: string }> {
  const { role, scenario, difficulty, jdText, askedQuestions } = input;

  const out = await chatJson<z.infer<typeof GeneratedQuestionSchema>>(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `请为「${role}」岗位出一道**业务情景设计题**（难度：${difficulty}）。

场景要求：
${scenario}

要求：
1. 围绕上述 JD 业务场景，让候选人现场设计方案或思路；只问一个核心问题，不要连环问。
2. 不绑定候选人简历经历，也不假设候选人做过某个具体项目。
3. 避免与「已问过的问题」重复或角度雷同。

输出 JSON（camelCase）：
{ "question": "...", "questionType": "PRODUCT_DESIGN", "topics": ["${scenario.slice(0, 20)}"], "difficulty": "${difficulty}" }

已问过的问题（避免重复）：
${(askedQuestions ?? []).length ? askedQuestions!.map((q) => `- ${q}`).join("\n") : "（暂无）"}

岗位 JD（节选）：
${jdText.slice(0, 1500)}`,
      },
    ],
    { schema: GeneratedQuestionSchema, temperature: 0.5 },
  );

  return out;
}

// 去锚点：把知识库检索到的题改写成"不含任何个人经历"的通用题（问题方案 v2 §7.2 / 去锚点后复用）
export async function rewriteToGenericQuestion(baseQuestion: string): Promise<string> {
  return chatText([
    {
      role: "system",
      content:
        "你是资深面试官。下面这道面试题可能含有原答主的个人经历锚点（如「你上一段实习做的XX项目」「你们公司的XX」）。请把它改写为一道通用的知识考察题：去掉所有具体个人/公司/项目经历，保留并聚焦原考察点。不要评价、不要泄露答案。",
    },
    {
      role: "user",
      content: `原题：
${baseQuestion}

只输出改写后的题目本身（以问号结尾），不要任何多余文字。`,
    },
  ]);
}

// 结合 JD 业务语境改写面经题：保留真实面经的考察点，注入目标公司业务语境。
// （评测修复项：替代「去锚点」——去锚点会删掉公司上下文、丢失岗位针对性）
export async function rewriteWithJdContext(
  baseQuestion: string,
  company: string,
  role: string,
  jdText: string,
): Promise<string> {
  return chatText([
    { role: "system", content: "你是资深面试官。" },
    {
      role: "user",
      content: `下面是一道来自「真实面经」的面试题（可能较简短），以及目标公司/岗位的 JD。

请以这道面经题所考察的「知识点/能力点」为内核，结合 JD 中的业务语境，改写为一道**有具体场景、有深度、可追问**的面试题：
1. 保留原题的核心考察点（不要换成别的知识点、不要偏题）。
2. 用 JD 里的具体业务场景开场，让题目明显贴合「${company}」，而不是通用套话。
3. 只问一个核心问题，不要连环问，不要给答案或提示。

真实面经原题：${baseQuestion}
目标公司/岗位：${company} / ${role}

岗位 JD（节选）：
${jdText.slice(0, 1500)}

只输出改写后的题目本身（以问号结尾），不要任何多余文字。`,
    },
  ]);
}
