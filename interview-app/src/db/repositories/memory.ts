import { db } from "../client";
import type { Evaluation } from "@/core/engine-types";

// ============ V2 记忆显式化 ============
// 把原本塞在 interview_sessions.candidate_state 里的黑盒 JSON，
// 落成可查询、可画趋势的三张表：competency_scores / weaknesses / resume_risk_points。
// 数据来源：每次回答后的 Evaluation，由 engine.handleAnswer 调用 recordTurnMemory 写入。

interface CompetencyScoreDbRow {
  id: number;
  session_id: number;
  competency: string;
  score: number;
  verified: number;
  evidence: string | null;
  created_at: string;
}

export interface CompetencyScoreRow {
  id: number;
  sessionId: number;
  competency: string;
  score: number;
  verified: boolean;
  evidence: string | null;
  createdAt: string;
}

interface WeaknessDbRow {
  id: number;
  competency: string | null;
  weakness: string;
  first_seen_at: string;
  last_seen_at: string;
  hit_count: number;
  status: string;
}

export interface WeaknessRow {
  id: number;
  competency: string | null;
  weakness: string;
  firstSeenAt: string;
  lastSeenAt: string;
  hitCount: number;
  status: string;
}

interface ResumeRiskDbRow {
  id: number;
  resume_id: number | null;
  risk: string;
  first_seen_at: string;
  last_seen_at: string;
  hit_count: number;
}

export interface ResumeRiskRow {
  id: number;
  resumeId: number | null;
  risk: string;
  firstSeenAt: string;
  lastSeenAt: string;
  hitCount: number;
}

export interface RecordMemoryInput {
  sessionId: number;
  resumeId: number | null;
  evaluation: Evaluation;
  topic?: string;
  evidence?: string | null;
}

// 一次回答后记录记忆（能力分 / 弱项 / 简历风险）
export function recordTurnMemory(input: RecordMemoryInput): void {
  const { sessionId, resumeId, evaluation, topic, evidence } = input;
  if (typeof evaluation.score !== "number") return;

  // 1) 能力维度分数：优先 competencyUpdates（多维度），否则按 topic 记一个维度
  const entries = Object.entries(evaluation.competencyUpdates ?? {});
  if (entries.length === 0 && topic) {
    insertCompetencyScore(sessionId, topic, evaluation.score, evaluation.score >= 70, evidence ?? null);
  } else {
    for (const [competency, v] of entries) {
      insertCompetencyScore(sessionId, competency, v.score, v.verified, evidence ?? null);
    }
  }

  // 2) 弱项（含 missingPoints）：按文本精确去重，hit_count 累加
  for (const w of [...(evaluation.weaknesses ?? []), ...(evaluation.missingPoints ?? [])]) {
    upsertWeakness(w, topic);
  }

  // 3) 简历风险点
  if (resumeId != null) {
    for (const r of evaluation.resumeRisks ?? []) {
      upsertResumeRisk(resumeId, r);
    }
  }
}

function insertCompetencyScore(
  sessionId: number,
  competency: string,
  score: number,
  verified: boolean,
  evidence: string | null,
): void {
  db.prepare(
    "INSERT INTO competency_scores (session_id, competency, score, verified, evidence) VALUES (?, ?, ?, ?, ?)",
  ).run(sessionId, competency, score, verified ? 1 : 0, evidence ?? null);
}

// 注：弱项按文本精确匹配去重；LLM 措辞略有差异可能产生近似重复，V2 先接受，后续可换 embedding 去重。
function upsertWeakness(text: string, competency?: string | null): void {
  const t = (text ?? "").trim();
  if (!t) return;
  const existing = db
    .prepare("SELECT id FROM weaknesses WHERE weakness = ?")
    .get(t) as { id: number } | undefined;
  if (existing) {
    db
      .prepare("UPDATE weaknesses SET hit_count = hit_count + 1, last_seen_at = datetime('now') WHERE id = ?")
      .run(existing.id);
  } else {
    db.prepare("INSERT INTO weaknesses (competency, weakness) VALUES (?, ?)").run(competency ?? null, t);
  }
}

function upsertResumeRisk(resumeId: number, text: string): void {
  const t = (text ?? "").trim();
  if (!t) return;
  const existing = db
    .prepare("SELECT id FROM resume_risk_points WHERE resume_id = ? AND risk = ?")
    .get(resumeId, t) as { id: number } | undefined;
  if (existing) {
    db
      .prepare("UPDATE resume_risk_points SET hit_count = hit_count + 1, last_seen_at = datetime('now') WHERE id = ?")
      .run(existing.id);
  } else {
    db.prepare("INSERT INTO resume_risk_points (resume_id, risk) VALUES (?, ?)").run(resumeId, t);
  }
}

// ============ 查询（供主动加练 / 成长曲线 / 报告使用） ============

// 持续弱项，按出现频率排序（"弱项主动加练"触发器依据）
export function listWeaknesses(limit = 20): WeaknessRow[] {
  const rows = db
    .prepare("SELECT * FROM weaknesses ORDER BY hit_count DESC, last_seen_at DESC LIMIT ?")
    .all(limit) as unknown as WeaknessDbRow[];
  return rows.map(mapWeakness);
}

// 某能力维度的历史得分曲线
export function getCompetencyTrend(competency: string, limit = 30): CompetencyScoreRow[] {
  const rows = db
    .prepare("SELECT * FROM competency_scores WHERE competency = ? ORDER BY id ASC LIMIT ?")
    .all(competency, limit) as unknown as CompetencyScoreDbRow[];
  return rows.map(mapScore);
}

// 各能力维度的平均分（升序，最低的即最弱维度）
export function getCompetencyAverages(): { competency: string; avgScore: number; count: number }[] {
  const rows = db
    .prepare(
      "SELECT competency, AVG(score) AS avg, COUNT(*) AS c FROM competency_scores GROUP BY competency ORDER BY avg ASC",
    )
    .all() as unknown as { competency: string; avg: number; c: number }[];
  return rows.map((r) => ({ competency: r.competency, avgScore: Math.round(r.avg), count: r.c }));
}

// 简历风险点列表
export function listResumeRisks(limit = 20): ResumeRiskRow[] {
  const rows = db
    .prepare("SELECT * FROM resume_risk_points ORDER BY hit_count DESC, last_seen_at DESC LIMIT ?")
    .all(limit) as unknown as ResumeRiskDbRow[];
  return rows.map(mapRisk);
}

function mapScore(row: CompetencyScoreDbRow): CompetencyScoreRow {
  return {
    id: row.id,
    sessionId: row.session_id,
    competency: row.competency,
    score: row.score,
    verified: row.verified === 1,
    evidence: row.evidence,
    createdAt: row.created_at,
  };
}

function mapWeakness(row: WeaknessDbRow): WeaknessRow {
  return {
    id: row.id,
    competency: row.competency,
    weakness: row.weakness,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    hitCount: row.hit_count,
    status: row.status,
  };
}

function mapRisk(row: ResumeRiskDbRow): ResumeRiskRow {
  return {
    id: row.id,
    resumeId: row.resume_id,
    risk: row.risk,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    hitCount: row.hit_count,
  };
}
