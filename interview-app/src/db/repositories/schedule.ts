import { db } from "../client";

// ============ 面试日程（V2） ============
// 本地为主：日程存本地；"面试前一天提醒"由里程碑 3 的极简服务器服务读取并推送。

export interface ScheduleRow {
  id: number;
  company: string;
  role: string;
  interviewAt: string;
  reminded: boolean;
  notes: string | null;
  createdAt: string;
}

interface ScheduleDbRow {
  id: number;
  company: string;
  role: string;
  interview_at: string;
  reminded: number;
  notes: string | null;
  created_at: string;
}

function map(row: ScheduleDbRow): ScheduleRow {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    interviewAt: row.interview_at,
    reminded: row.reminded === 1,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function createSchedule(input: {
  company: string;
  role: string;
  interviewAt: string;
  notes?: string | null;
}): ScheduleRow {
  const info = db
    .prepare("INSERT INTO interview_schedule (company, role, interview_at, notes) VALUES (?, ?, ?, ?)")
    .run(input.company, input.role, input.interviewAt, input.notes ?? null);
  return getSchedule(Number(info.lastInsertRowid))!;
}

export function getSchedule(id: number): ScheduleRow | null {
  const row = db.prepare("SELECT * FROM interview_schedule WHERE id = ?").get(id) as
    | ScheduleDbRow
    | undefined;
  return row ? map(row) : null;
}

// 全部日程，按面试时间升序
export function listSchedules(): ScheduleRow[] {
  const rows = db
    .prepare("SELECT * FROM interview_schedule ORDER BY interview_at ASC")
    .all() as unknown as ScheduleDbRow[];
  return rows.map(map);
}

// 未来的日程（未过期）
export function listUpcomingSchedules(): ScheduleRow[] {
  const rows = db
    .prepare("SELECT * FROM interview_schedule WHERE datetime(interview_at) >= datetime('now') ORDER BY interview_at ASC")
    .all() as unknown as ScheduleDbRow[];
  return rows.map(map);
}

// 「明天有面试」且尚未提醒（供打开 app 时检查 + 服务器定时任务复用）
export function getDueReminders(): ScheduleRow[] {
  const rows = db
    .prepare("SELECT * FROM interview_schedule WHERE date(interview_at) = date('now', '+1 day') AND reminded = 0")
    .all() as unknown as ScheduleDbRow[];
  return rows.map(map);
}

export function markReminded(id: number): void {
  db.prepare("UPDATE interview_schedule SET reminded = 1 WHERE id = ?").run(id);
}

export function deleteSchedule(id: number): void {
  db.prepare("DELETE FROM interview_schedule WHERE id = ?").run(id);
}
