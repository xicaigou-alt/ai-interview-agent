import { NextResponse } from "next/server";
import { createRealInterview, listRealInterviews } from "@/db/repositories/real_interviews";
import { findItemByQuestion, insertItem } from "@/db/repositories/interview_items";
import type { DebriefResult } from "@/core/debrief/parse-debrief";

export const runtime = "nodejs";

// 用户确认后保存：写入真实面试历史 + 把问题沉淀为 PERSONAL_REAL_INTERVIEW 题目
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DebriefResult;
    if (!body.company || !body.role || !Array.isArray(body.questions)) {
      return NextResponse.json({ error: "company / role / questions 必填" }, { status: 400 });
    }

    const rec = createRealInterview({
      company: body.company,
      role: body.role,
      round: body.round,
      interviewDate: body.date,
      structuredQuestions: body,
      notes: body.notes,
    });

    let inserted = 0;
    for (const q of body.questions) {
      if (findItemByQuestion(q.question)) continue;
      await insertItem({
        question: q.question,
        company: body.company,
        role: body.role,
        stage: body.round,
        questionType: q.type,
        topics: q.topics,
        difficulty: "medium",
        sourceType: "PERSONAL_REAL_INTERVIEW",
        knowledgePoints: [],
        evaluationRubric: [],
      });
      inserted++;
    }

    return NextResponse.json({ id: rec.id, inserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const list = listRealInterviews().map((r) => ({
      id: r.id,
      company: r.company,
      role: r.role,
      round: r.round,
      interviewDate: r.interviewDate,
      notes: r.notes,
      structuredQuestions: r.structuredQuestions ? JSON.parse(r.structuredQuestions) : null,
      createdAt: r.createdAt,
    }));
    return NextResponse.json({ items: list });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
