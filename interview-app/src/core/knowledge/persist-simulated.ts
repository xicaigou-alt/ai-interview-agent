import { getSession } from "@/db/repositories/interview_sessions";
import { getJob } from "@/db/repositories/jobs";
import { listTurns } from "@/db/repositories/interview_turns";
import {
  findItemByQuestion,
  insertItem,
} from "@/db/repositories/interview_items";

// 只沉淀"通用"类主问题（知识题 / 情景设计题）；带简历锚点的模板题（实习/项目/行为）一律不回写
const PERSISTABLE_TYPES = new Set(["AI_KNOWLEDGE", "PRODUCT_DESIGN"]);

// 面试结束后，把本场"生成题"的底题模板沉淀进知识库（检索题已在库中，跳过）。
// 只沉淀去个性化后的底题，来源标记为 MODEL_GENERATED，避免把带简历锚点的文本回灌造成污染。
export async function persistPrimaryQuestionsToKnowledge(
  sessionId: number,
): Promise<{ inserted: number; skipped: number }> {
  const session = getSession(sessionId);
  if (!session) return { inserted: 0, skipped: 0 };

  const job = session.jobId != null ? getJob(session.jobId) : null;
  const primaryTurns = listTurns(sessionId).filter((t) => !t.isFollowUp);

  let inserted = 0;
  let skipped = 0;

  for (const t of primaryTurns) {
    // 检索来的题：底题已在知识库中，跳过；带简历锚点的模板题：不回写
    if (t.questionSourceId != null || !PERSISTABLE_TYPES.has(t.questionType ?? "")) {
      skipped++;
      continue;
    }

    // 生成题：只沉淀"去个性化"的底题模板（不含候选人具体经历/公司）
    const base = t.baseQuestionText?.trim();
    if (!base || findItemByQuestion(base)) {
      skipped++;
      continue;
    }

    await insertItem({
      question: base,
      company: job?.company,
      role: job?.role,
      questionType: t.questionType ?? "AI_KNOWLEDGE",
      topics: t.topics,
      difficulty: "medium",
      sourceType: "MODEL_GENERATED",
      knowledgePoints: [],
      evaluationRubric: [],
    });

    inserted++;
  }

  return { inserted, skipped };
}
