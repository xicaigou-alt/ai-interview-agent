import type { CandidateState, Evaluation, InterviewPlan, PlanQuestion } from "../engine-types";

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

// 主问题的稳定标识：dimension + target（+ angle 区分"换角度"题）
export function planQuestionKey(q: PlanQuestion): string {
  return `${q.dimension}:${q.target}${q.angle ? "#" + q.angle : ""}`;
}

// 每次回答后更新候选人工作记忆（§26）
export function updateCandidateState(
  state: CandidateState,
  evaluation: Evaluation,
  topic?: string,
): CandidateState {
  const next: CandidateState = {
    competencies: { ...(state.competencies ?? {}) },
    verifiedStrengths: [...(state.verifiedStrengths ?? [])],
    weaknesses: [...(state.weaknesses ?? [])],
    knowledgeGaps: [...(state.knowledgeGaps ?? [])],
    resumeRisks: [...(state.resumeRisks ?? [])],
    communicationIssues: [...(state.communicationIssues ?? [])],
    inconsistencies: [...(state.inconsistencies ?? [])],
    coveredTopics: [...(state.coveredTopics ?? [])],
    remainingTopics: [...(state.remainingTopics ?? [])],
    difficulty: state.difficulty ?? "medium",
  };

  if (topic) {
    next.competencies[topic] = { score: evaluation.score, verified: evaluation.score >= 70 };
    if (!next.coveredTopics.includes(topic)) next.coveredTopics.push(topic);
    next.remainingTopics = next.remainingTopics.filter((t) => t !== topic);
  }

  if (evaluation.competencyUpdates) {
    for (const [k, v] of Object.entries(evaluation.competencyUpdates)) {
      next.competencies[k] = v;
    }
  }

  next.weaknesses = dedupe([
    ...next.weaknesses,
    ...(evaluation.weaknesses ?? []),
    ...(evaluation.missingPoints ?? []),
  ]);
  next.resumeRisks = dedupe([...next.resumeRisks, ...(evaluation.resumeRisks ?? [])]);
  next.verifiedStrengths = dedupe([...next.verifiedStrengths, ...(evaluation.strengths ?? [])]);

  return next;
}

// 选题：按 InterviewPlan.mainQuestions 的结构化顺序推进，已覆盖的跳过（§26.1 / 问题方案 v2）
// 返回下一道主问题（PlanQuestion）；全部覆盖后返回 null。
export function selectNextTopic(
  state: CandidateState,
  plan: InterviewPlan,
): PlanQuestion | null {
  const covered = new Set(state.coveredTopics ?? []);

  for (const q of plan.mainQuestions ?? []) {
    if (!covered.has(planQuestionKey(q))) return q;
  }

  return null;
}
