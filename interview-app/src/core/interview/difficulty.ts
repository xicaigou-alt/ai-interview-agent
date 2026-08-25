// 难度自适应（纯函数，无依赖，便于单元测试）
// 对应设计文档 §5.5 的「是否增加难度」决策点 —— V1 缺失，V2 补上。

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

const ORDER: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

export function isDifficulty(v: string): v is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(v);
}

// 根据最近一次主问题得分调整下一题难度（带滞回区间，避免震荡）
// score >= 80 升一档；score <= 55 降一档；其余保持。
export function adjustDifficulty(current: string, score: number): string {
  const cur: Difficulty = isDifficulty(current) ? current : "medium";
  if (score >= 80) return step(cur, 1);
  if (score <= 55) return step(cur, -1);
  return cur;
}

function step(d: Difficulty, delta: 1 | -1): Difficulty {
  const next = ORDER[d] + delta;
  if (next > 2) return "hard";
  if (next < 0) return "easy";
  return DIFFICULTIES[next] as Difficulty;
}
