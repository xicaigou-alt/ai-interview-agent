import type { CandidateState, Evaluation, InterviewPlan } from "../engine-types";

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
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

// 选题：优先弱项 / 未验证 topic；已验证强项降权（§26.1）
export function selectNextTopic(
  state: CandidateState,
  plan: InterviewPlan,
): string | null {
  const covered = new Set(state.coveredTopics ?? []);

  const pool = dedupe([
    ...(plan.priorityTopics ?? []).filter((t) => !covered.has(t)),
    ...(state.remainingTopics ?? []).filter((t) => !covered.has(t)),
  ]);

  if (pool.length === 0) return null;

  const weak = pool.filter(
    (t) =>
      (state.weaknesses ?? []).includes(t) ||
      state.competencies?.[t]?.verified !== true,
  );

  return (weak.length > 0 ? weak : pool)[0];
}
