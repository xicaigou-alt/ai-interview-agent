import type { Decision, DecisionResult } from "../engine-types";

// 面试流程的纯规则（不依赖 LLM，便于单元测试）

// 每个主问题最多连续追问的次数，超过则强制进入下一主问题
export const MAX_FOLLOW_UPS = 2;

// 追问类动作：这些 decision 会继续追问当前主问题，而不是进入下一题
const FOLLOW_UP_DECISIONS: Decision[] = [
  "CLARIFY",
  "DEEP_DIVE",
  "CHALLENGE",
  "COUNTERFACTUAL",
  "TECHNICAL",
  "DATA_VALIDATION",
  "OWNERSHIP_CHECK",
];

export function isFollowUpAction(decision: Decision): boolean {
  return FOLLOW_UP_DECISIONS.includes(decision);
}

// 追问上限兜底：超过上限强制进入下一主问题（避免无限追问）
export function enforceFollowUpLimit(
  result: DecisionResult,
  followUpCount: number,
  maxFollowUps: number = MAX_FOLLOW_UPS,
): DecisionResult {
  if (isFollowUpAction(result.decision) && followUpCount >= maxFollowUps) {
    return { decision: "NEXT_QUESTION", reasoning: "已达追问上限，进入下一题" };
  }
  return result;
}
