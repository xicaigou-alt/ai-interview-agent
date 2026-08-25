import { db } from "../client";
import { SessionStatus, type CandidateState } from "@/core/engine-types";

export interface SessionRow {
  id: number;
  resumeId: number | null;
  jobId: number | null;
  mode: string;
  status: string;
  title: string | null;
  questionTarget: number | null;
  requirement: string | null;
  interviewPlan: string | null;
  candidateState: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface SessionDbRow {
  id: number;
  resume_id: number | null;
  job_id: number | null;
  mode: string;
  status: string;
  title: string | null;
  question_target: number | null;
  requirement: string | null;
  interview_plan: string | null;
  candidate_state: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

function map(row: SessionDbRow): SessionRow {
  return {
    id: row.id,
    resumeId: row.resume_id,
    jobId: row.job_id,
    mode: row.mode,
    status: row.status,
    title: row.title,
    questionTarget: row.question_target,
    requirement: row.requirement,
    interviewPlan: row.interview_plan,
    candidateState: row.candidate_state,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

export function createSession(
  resumeId: number | null,
  jobId: number | null,
  mode: string,
  questionTarget?: number | null,
  requirement?: string | null,
): SessionRow {
  const info = db
    .prepare(
      "INSERT INTO interview_sessions (resume_id, job_id, mode, status, question_target, requirement) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(resumeId, jobId, mode, SessionStatus.CREATED, questionTarget ?? null, requirement ?? null);
  return getSession(Number(info.lastInsertRowid))!;
}

export function getSession(id: number): SessionRow | null {
  const row = db.prepare("SELECT * FROM interview_sessions WHERE id = ?").get(id) as
    | SessionDbRow
    | undefined;
  return row ? map(row) : null;
}

export function listSessions(): SessionRow[] {
  const rows = db
    .prepare("SELECT * FROM interview_sessions ORDER BY id DESC LIMIT 50")
    .all() as unknown as SessionDbRow[];
  return rows.map(map);
}

export function updateSessionStatus(id: number, status: string): void {
  db.prepare("UPDATE interview_sessions SET status = ? WHERE id = ?").run(status, id);
}

export function updateSessionTitle(id: number, title: string): void {
  db.prepare("UPDATE interview_sessions SET title = ? WHERE id = ?").run(title, id);
}

// 带岗位信息的会话列表（用于历史面试卡片展示）
export interface SessionWithJob extends SessionRow {
  company: string | null;
  role: string | null;
}

export function listSessionsWithJob(): SessionWithJob[] {
  const rows = db
    .prepare(
      `SELECT s.*, j.company AS company, j.role AS role
       FROM interview_sessions s
       LEFT JOIN jobs j ON s.job_id = j.id
       ORDER BY s.id DESC
       LIMIT 50`,
    )
    .all() as unknown as (SessionDbRow & { company: string | null; role: string | null })[];
  return rows.map((r) => ({ ...map(r), company: r.company, role: r.role }));
}

export function updateSessionPlan(id: number, plan: unknown): void {
  db.prepare("UPDATE interview_sessions SET interview_plan = ? WHERE id = ?").run(
    JSON.stringify(plan),
    id,
  );
}

export function updateSessionCandidateState(id: number, state: unknown): void {
  db.prepare("UPDATE interview_sessions SET candidate_state = ? WHERE id = ?").run(
    JSON.stringify(state),
    id,
  );
}

export function markSessionStarted(id: number): void {
  db.prepare(
    "UPDATE interview_sessions SET status = ?, started_at = COALESCE(started_at, datetime('now')) WHERE id = ?",
  ).run(SessionStatus.IN_PROGRESS, id);
}

export function completeSession(id: number): void {
  db.prepare(
    "UPDATE interview_sessions SET status = ?, completed_at = datetime('now') WHERE id = ?",
  ).run(SessionStatus.COMPLETED, id);
}

// 最近一次已完成会话的候选人状态，用于下一次计划的历史输入
export function getLatestCompletedState(resumeId: number): CandidateState | null {
  const row = db
    .prepare(
      "SELECT candidate_state FROM interview_sessions WHERE resume_id = ? AND status = ? AND candidate_state IS NOT NULL ORDER BY id DESC LIMIT 1",
    )
    .get(resumeId, SessionStatus.COMPLETED) as { candidate_state: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.candidate_state) as CandidateState;
  } catch {
    return null;
  }
}
