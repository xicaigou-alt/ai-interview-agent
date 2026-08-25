import { NextResponse } from "next/server";
import { getCompetencyAverages, listWeaknesses } from "@/db/repositories/memory";
import { buildPracticePlan } from "@/core/practice/plan-practice";

export const runtime = "nodejs";

// 今日练习建议：依据记忆显式化后的数据（能力均分 + 持续弱项）生成
export async function GET() {
  try {
    const competencyAverages = getCompetencyAverages();
    const weaknesses = listWeaknesses(20);
    const plan = buildPracticePlan({ competencyAverages, weaknesses });
    return NextResponse.json({
      plan,
      competencyAverages,
      weaknesses: weaknesses.slice(0, 10),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
