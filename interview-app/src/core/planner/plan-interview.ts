import { chatJson } from "@/llm";
import { InterviewPlanSchema, type CandidateState, type InterviewPlan } from "../engine-types";
import type { CandidateProfile, CompetencyModel, GapResult } from "../types";

const SYSTEM = `你是资深面试规划师，负责根据候选人画像、岗位能力模型、差距分析和历史表现，制定一场模拟面试的考试计划（决定「考什么」，不决定具体题目）。`;

const TEMPLATE = `{
  "durationMinutes": 40,
  "primaryQuestionTarget": 10,
  "difficulty": "medium",
  "sections": [
    { "type": "RESUME_DEEP_DIVE", "weight": 0.30 },
    { "type": "AI_KNOWLEDGE", "weight": 0.25 },
    { "type": "PRODUCT_DESIGN", "weight": 0.20 },
    { "type": "JD_GAP", "weight": 0.15 },
    { "type": "BEHAVIORAL", "weight": 0.10 }
  ],
  "priorityTopics": ["RAG", "Agent", "Evaluation"]
}`;

export interface PlanInterviewInput {
  profile: CandidateProfile;
  model: CompetencyModel;
  gap: GapResult;
  company: string;
  role: string;
  mode: string;
  history: CandidateState | null;
  requirement?: string | null;
}

export async function planInterview(input: PlanInterviewInput): Promise<InterviewPlan> {
  const { profile, model, gap, company, role, mode, history, requirement } = input;

  return chatJson<InterviewPlan>(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `请制定面试计划，输出严格符合 JSON 结构（camelCase）：

${TEMPLATE}

要求：
1. priorityTopics 以差距分析里的 highPriorityTopics 为主；若历史表现存在弱项，把弱项 topic 提权。
2. sections 的 weight 相加必须等于 1；弱项对应的 section 权重适当提高。
3. 面试模式：${mode === "mock" ? "mock（接近真实面试）" : "coaching（边练边学）"}。
4. 只输出 JSON。
${requirement ? `\n用户的面试要求/考察侧重（务必据此调整 sections 权重与 priorityTopics）：\n${requirement}\n` : ""}

公司：${company}
岗位：${role}

候选人画像：
${JSON.stringify(profile)}

能力模型：
${JSON.stringify(model)}

差距分析：
${JSON.stringify(gap)}

历史表现（可能为空）：
${JSON.stringify(history)}`,
      },
    ],
    { schema: InterviewPlanSchema, temperature: 0.2 },
  );
}
