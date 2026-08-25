import { getSession } from "@/db/repositories/interview_sessions";
import { getJob } from "@/db/repositories/jobs";
import { listTurns } from "@/db/repositories/interview_turns";
import {
  findItemByQuestion,
  getItemById,
  insertItem,
} from "@/db/repositories/interview_items";

// 面试结束后，把本场的母问题（主问题）沉淀进知识库，来源标记为「模拟面试」+ 公司/岗位
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
    if (findItemByQuestion(t.questionText)) {
      skipped++;
      continue;
    }

    let knowledgePoints: string[] = [];
    let evaluationRubric: string[] = [];
    if (t.questionSourceId != null) {
      const src = getItemById(t.questionSourceId);
      knowledgePoints = src?.knowledgePoints ?? [];
      evaluationRubric = src?.evaluationRubric ?? [];
    }

    await insertItem({
      question: t.questionText,
      company: job?.company,
      role: job?.role,
      questionType: t.questionType ?? "AI_KNOWLEDGE",
      topics: t.topics,
      difficulty: "medium",
      sourceType: "SIMULATED_INTERVIEW",
      knowledgePoints,
      evaluationRubric,
    });

    inserted++;
  }

  return { inserted, skipped };
}
