import { chatJson } from "@/llm";
import { z } from "zod";
import type { CandidateState, Evaluation, InterviewPlan } from "../engine-types";

export const ReportResumeRiskSchema = z.object({
  claim: z.string(),
  risk: z.string(),
  recommendation: z.string(),
});

export const ReportSchema = z.object({
  overallScore: z.number(),
  competencyScores: z.record(z.string(), z.number()).default({}),
  strengths: z.array(z.string()).default([]),
  riskAreas: z.array(z.string()).default([]),
  resumeRisks: z.array(ReportResumeRiskSchema).default([]),
  learningPlan: z.array(z.string()).default([]),
});
export type InterviewReport = z.infer<typeof ReportSchema>;

export interface BuildReportInput {
  company: string;
  role: string;
  plan: InterviewPlan;
  candidateState: CandidateState;
  turns: Array<{
    question: string;
    answer: string | null;
    isFollowUp: boolean;
    evaluation: Evaluation | null;
  }>;
}

const SYSTEM = `你是资深面试教练，根据整场模拟面试的作答与候选人状态，生成一份客观、可执行的面试复盘报告。`;

export async function buildReport(input: BuildReportInput): Promise<InterviewReport> {
  const primaryTurns = input.turns.filter((t) => !t.isFollowUp);

  const turnLog = primaryTurns.map((t) => ({
    question: t.question,
    answer: (t.answer ?? "").slice(0, 400),
    score: t.evaluation?.score ?? null,
  }));

  return chatJson<InterviewReport>(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `请根据下面的面试数据生成复盘报告，输出严格符合 JSON（camelCase）：

{
  "overallScore": 0,
  "competencyScores": { "RAG": 84, "Agent": 55 },
  "strengths": ["..."],
  "riskAreas": ["..."],
  "resumeRisks": [ { "claim": "简历表述", "risk": "为什么有风险", "recommendation": "建议" } ],
  "learningPlan": ["按优先级排列的学习主题"]
}

要求：
1. overallScore 0-100；competencyScores 覆盖被考察过的 topic。
2. riskAreas 找能力薄弱点；resumeRisks 找简历证据缺失（如效率40%无计算说明）。
3. learningPlan 按优先级排序（最弱的排最前）。
4. 只输出 JSON。

公司：${input.company}
岗位：${input.role}
计划：${JSON.stringify(input.plan)}

候选人状态：
${JSON.stringify(input.candidateState)}

作答记录（仅主问题）：
${JSON.stringify(turnLog)}`,
      },
    ],
    { schema: ReportSchema, temperature: 0.2 },
  );
}
