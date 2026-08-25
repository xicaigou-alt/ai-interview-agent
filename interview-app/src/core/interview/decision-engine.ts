import { chatJson, chatText } from "@/llm";
import {
  DecisionResultSchema,
  type CandidateState,
  type Decision,
  type DecisionResult,
  type Evaluation,
} from "../engine-types";

const SYSTEM = `你是面试流程决策引擎，根据回答质量与候选人状态，决定下一步动作。目标是在「问出深度」与「推进流程」之间取得平衡，不要无意义地反复追问。`;

const ACTIONS = [
  "PASS（回答合格，进入下一题）",
  "CLARIFY（回答含糊，要求澄清）",
  "DEEP_DIVE（发现漏洞，深入追问）",
  "CHALLENGE（回答有误，施加挑战）",
  "COUNTERFACTUAL（反事实追问）",
  "TECHNICAL（追问技术细节）",
  "DATA_VALIDATION（验证数据真实性）",
  "OWNERSHIP_CHECK（验证个人贡献）",
  "NEXT_QUESTION（进入下一主问题）",
  "FINISH（结束面试）",
].join("\n");

export interface DecideInput {
  question: string;
  answer: string;
  evaluation: Evaluation;
  candidateState: CandidateState;
  primaryCount: number;
  questionTarget: number;
  followUpCount: number;
}

export async function decideNext(input: DecideInput): Promise<DecisionResult> {
  const { question, answer, evaluation, candidateState, primaryCount, questionTarget, followUpCount } = input;

  return chatJson<DecisionResult>(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `请决定下一步动作，可选：
${ACTIONS}

规则（重要）：
1. 只有当存在「明显漏洞」「明显含糊」或「值得深挖的具体点」时才追问（DEEP_DIVE / TECHNICAL / DATA_VALIDATION / CLARIFY 等）；回答基本完整时直接 PASS，避免无意义拖长。
2. 回答含糊则 CLARIFY。
3. 已问主问题数 >= ${questionTarget} 时选 FINISH。
4. 同一主问题最多连续追问 2 次；目前已追问 ${followUpCount} 次，若已 >= 2 次，必须 NEXT_QUESTION（或 FINISH），不得再追问。
5. 回答合格或追问已达上限时选 NEXT_QUESTION。

输出 JSON（camelCase）：{ "decision": "DEEP_DIVE", "reasoning": "一句话理由" }

当前题目：${question}
候选人回答：${answer}
评价：${JSON.stringify(evaluation)}
已问主问题数：${primaryCount} / ${questionTarget}
已连续追问：${followUpCount} 次
候选人状态摘要：${JSON.stringify({
        weaknesses: candidateState.weaknesses,
        coveredTopics: candidateState.coveredTopics,
      })}`,
      },
    ],
    { schema: DecisionResultSchema, temperature: 0.1 },
  );
}

export async function generateFollowUp(input: {
  question: string;
  answer: string;
  evaluation: Evaluation;
  decision: Decision;
  requirement?: string | null;
}): Promise<string> {
  const { question, answer, evaluation, decision, requirement } = input;

  return chatText([
    {
      role: "system",
      content: "你是真实面试官，根据候选人的回答生成一句自然的追问；不要评价、不要泄露答案、不要机械重复。",
    },
    {
      role: "user",
      content: `追问类型：${decision}
原始问题：${question}
候选人回答：${answer}
评价中发现的缺失点：${(evaluation.missingPoints ?? []).join("、") || "无"}
${requirement ? `\n面试要求/风格（追问语气与侧重应符合）：\n${requirement}\n` : ""}

请针对缺失点生成一句自然的追问，只输出追问本身。`,
    },
  ]);
}
