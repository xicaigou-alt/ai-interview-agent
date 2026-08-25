import { db } from "../client";

export interface TurnRow {
  id: number;
  sessionId: number;
  turnIndex: number;
  questionText: string;
  questionSourceId: number | null;
  questionType: string | null;
  topics: string[];
  answer: string | null;
  evaluation: string | null;
  decision: string | null;
  isFollowUp: boolean;
  createdAt: string;
}

interface TurnDbRow {
  id: number;
  session_id: number;
  turn_index: number;
  question_text: string;
  question_source_id: number | null;
  question_type: string | null;
  topics: string | null;
  answer: string | null;
  evaluation: string | null;
  decision: string | null;
  is_follow_up: number;
  created_at: string;
}

function safeParseArray(s: string | null): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function map(row: TurnDbRow): TurnRow {
  return {
    id: row.id,
    sessionId: row.session_id,
    turnIndex: row.turn_index,
    questionText: row.question_text,
    questionSourceId: row.question_source_id,
    questionType: row.question_type,
    topics: safeParseArray(row.topics),
    answer: row.answer,
    evaluation: row.evaluation,
    decision: row.decision,
    isFollowUp: row.is_follow_up === 1,
    createdAt: row.created_at,
  };
}

export interface CreateTurnInput {
  sessionId: number;
  questionText: string;
  questionSourceId?: number | null;
  questionType?: string | null;
  topics?: string[];
  isFollowUp?: boolean;
}

export function createTurn(input: CreateTurnInput): TurnRow {
  const nextIndex =
    (
      db
        .prepare("SELECT COUNT(*) AS c FROM interview_turns WHERE session_id = ?")
        .get(input.sessionId) as { c: number }
    ).c + 1;

  const info = db
    .prepare(
      `INSERT INTO interview_turns
        (session_id, turn_index, question_text, question_source_id, question_type, topics, is_follow_up)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.sessionId,
      nextIndex,
      input.questionText,
      input.questionSourceId ?? null,
      input.questionType ?? null,
      JSON.stringify(input.topics ?? []),
      input.isFollowUp ? 1 : 0,
    );

  return getTurn(Number(info.lastInsertRowid))!;
}

export function getTurn(id: number): TurnRow | null {
  const row = db.prepare("SELECT * FROM interview_turns WHERE id = ?").get(id) as
    | TurnDbRow
    | undefined;
  return row ? map(row) : null;
}

export function getLastTurn(sessionId: number): TurnRow | null {
  const row = db
    .prepare("SELECT * FROM interview_turns WHERE session_id = ? ORDER BY id DESC LIMIT 1")
    .get(sessionId) as TurnDbRow | undefined;
  return row ? map(row) : null;
}

export function listTurns(sessionId: number): TurnRow[] {
  const rows = db
    .prepare("SELECT * FROM interview_turns WHERE session_id = ? ORDER BY id ASC")
    .all(sessionId) as unknown as TurnDbRow[];
  return rows.map(map);
}

export function updateTurnResult(
  id: number,
  result: { answer: string; evaluation: unknown; decision: string },
): void {
  db.prepare("UPDATE interview_turns SET answer = ?, evaluation = ?, decision = ? WHERE id = ?").run(
    result.answer,
    JSON.stringify(result.evaluation),
    result.decision,
    id,
  );
}

export function countPrimaryTurns(sessionId: number): number {
  return (
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM interview_turns WHERE session_id = ? AND is_follow_up = 0",
      )
      .get(sessionId) as { c: number }
  ).c;
}

// 自最近一个主问题以来已连续追问的次数（用于限制追问深度）
export function countFollowUpsSinceLastPrimary(sessionId: number): number {
  const rows = db
    .prepare("SELECT is_follow_up FROM interview_turns WHERE session_id = ? ORDER BY id DESC")
    .all(sessionId) as unknown as { is_follow_up: number }[];
  let count = 0;
  for (const r of rows) {
    if (r.is_follow_up === 1) count++;
    else break;
  }
  return count;
}

// 主问题平均分（用于历史列表展示）；无评分时返回 null
export function getSessionAvgScore(sessionId: number): number | null {
  const rows = db
    .prepare(
      "SELECT evaluation FROM interview_turns WHERE session_id = ? AND is_follow_up = 0 AND evaluation IS NOT NULL",
    )
    .all(sessionId) as unknown as { evaluation: string }[];
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    try {
      const e = JSON.parse(r.evaluation) as { score?: number };
      if (typeof e.score === "number") {
        sum += e.score;
        n++;
      }
    } catch {
      // 忽略无法解析的评分
    }
  }
  return n > 0 ? Math.round(sum / n) : null;
}
