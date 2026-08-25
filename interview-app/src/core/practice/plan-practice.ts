// 每日练习计划（纯函数，无依赖，便于单元测试）
// 依据记忆显式化后的数据（能力均分 + 持续弱项）生成「今天该练什么」。

export interface PracticeSuggestion {
  topic: string;
  reason: string;
  priority: "weak_competency" | "recurring_weakness";
}

export interface PracticePlanInput {
  // 各能力维度平均分（升序，最低分在前，来自 getCompetencyAverages）
  competencyAverages: { competency: string; avgScore: number; count: number }[];
  // 持续弱项（按出现频率降序，来自 listWeaknesses）
  weaknesses: { weakness: string; competency: string | null; hitCount: number }[];
  limit?: number;
}

export function buildPracticePlan(input: PracticePlanInput): PracticeSuggestion[] {
  const limit = input.limit ?? 5;
  const out: PracticeSuggestion[] = [];
  const seen = new Set<string>();

  // 1) 平均分低于 70 的能力维度优先（从低到高）
  for (const c of input.competencyAverages) {
    if (out.length >= limit) break;
    const topic = (c.competency ?? "").trim();
    if (!topic || c.avgScore >= 70 || seen.has(topic)) continue;
    seen.add(topic);
    out.push({
      topic,
      reason: `近 ${c.count} 次平均 ${c.avgScore} 分，建议专项补强`,
      priority: "weak_competency",
    });
  }

  // 2) 高频弱项补足剩余名额（按出现次数从高到低）
  for (const w of input.weaknesses) {
    if (out.length >= limit) break;
    const topic = (w.competency ?? w.weakness ?? "").trim();
    if (!topic || seen.has(topic)) continue;
    seen.add(topic);
    out.push({
      topic,
      reason: `弱项「${w.weakness}」已出现 ${w.hitCount} 次，建议针对性练习`,
      priority: "recurring_weakness",
    });
  }

  return out;
}
