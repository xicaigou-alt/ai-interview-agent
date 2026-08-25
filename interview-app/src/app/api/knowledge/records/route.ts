import { NextResponse } from "next/server";
import { listImportedInterviews } from "@/db/repositories/imported_interviews";
import { listItems } from "@/db/repositories/interview_items";

export const runtime = "nodejs";

// 面经记录列表（含各自题目数），供知识库分组与总结展示
export async function GET() {
  try {
    const records = listImportedInterviews();
    const items = listItems({ sourceType: "IMPORTED_INTERVIEW_EXPERIENCE" });

    const countByRecord = new Map<number, number>();
    for (const it of items) {
      if (it.importedId != null) {
        countByRecord.set(it.importedId, (countByRecord.get(it.importedId) ?? 0) + 1);
      }
    }

    return NextResponse.json({
      records: records.map((r) => ({
        id: r.id,
        company: r.company,
        role: r.role,
        round: r.round,
        summary: r.summary,
        createdAt: r.createdAt,
        questionCount: countByRecord.get(r.id) ?? 0,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
