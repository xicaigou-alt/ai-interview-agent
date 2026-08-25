import { NextResponse } from "next/server";
import { insertItem } from "@/db/repositories/interview_items";
import {
  createImportedInterview,
  findImportedInterviewByContent,
} from "@/db/repositories/imported_interviews";
import type { ImportResult } from "@/core/knowledge/import-text";

export const runtime = "nodejs";

function normalizeQuestion(s: string): string {
  return s.toLowerCase().replace(/[\s，。；：、！？,.!?;:'"“”‘’()（）\-—_/\\]/g, "");
}

// 用户确认后的保存：按轮次建「面经记录」（公司/岗位/轮次/总结），题目挂在记录下
// 去重策略：记录级（同内容面经复用）+ 题内级（同一轮内的重复题只存一次）；
// 不做跨记录全局去重，保留「同一题被不同公司/面经问过」的共现数据
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ImportResult> & { raw_text?: string };
    const rounds = Array.isArray(body.rounds) ? body.rounds : [];
    if (rounds.length === 0) {
      return NextResponse.json({ error: "rounds 不能为空" }, { status: 400 });
    }

    const recordIds: number[] = [];
    const ids: number[] = [];
    let inserted = 0;
    let skipped = 0;

    for (const rnd of rounds) {
      let record = findImportedInterviewByContent(
        body.company ?? null,
        body.role ?? null,
        rnd.round ?? null,
        rnd.summary ?? null,
      );
      if (!record) {
        record = createImportedInterview({
          company: body.company,
          role: body.role,
          round: rnd.round,
          summary: rnd.summary,
          rawText: body.raw_text,
        });
      }
      recordIds.push(record.id);

      const seen = new Set<string>();
      for (const q of rnd.questions ?? []) {
        const norm = normalizeQuestion(q.question);
        if (!norm || seen.has(norm)) {
          skipped++;
          continue;
        }
        seen.add(norm);
        const id = await insertItem({
          question: q.question,
          company: body.company,
          role: body.role,
          stage: rnd.round,
          importedId: record.id,
          questionType: q.questionType,
          topics: q.topics,
          difficulty: q.difficulty,
          sourceType: "IMPORTED_INTERVIEW_EXPERIENCE",
          knowledgePoints: q.knowledgePoints,
          evaluationRubric: q.evaluationRubric,
        });
        ids.push(id);
        inserted++;
      }
    }

    return NextResponse.json({
      recordIds,
      company: body.company,
      role: body.role,
      count: inserted,
      skipped,
      ids,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
