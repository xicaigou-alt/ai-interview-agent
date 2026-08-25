import { NextResponse } from "next/server";
import { generateQuestions } from "@/core/knowledge/generate-questions";
import { findItemByQuestion, insertItem } from "@/db/repositories/interview_items";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const role = String(body.role ?? "").trim();
    const topic = String(body.topic ?? "").trim();
    const difficulty = String(body.difficulty ?? "medium").trim();
    const count = Math.min(Math.max(Number(body.count ?? 5), 1), 20);

    if (!role || !topic) {
      return NextResponse.json({ error: "role / topic 必填" }, { status: 400 });
    }

    const questions = await generateQuestions({ role, topic, difficulty, count });

    const ids: number[] = [];
    let skipped = 0;
    for (const q of questions) {
      if (findItemByQuestion(q.question)) {
        skipped++;
        continue;
      }
      const id = await insertItem({
        question: q.question,
        questionType: q.questionType,
        topics: q.topics,
        difficulty: q.difficulty,
        sourceType: "MODEL_GENERATED",
        knowledgePoints: q.knowledgePoints,
        evaluationRubric: q.evaluationRubric,
      });
      ids.push(id);
    }

    return NextResponse.json({ count: ids.length, skipped, ids });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
