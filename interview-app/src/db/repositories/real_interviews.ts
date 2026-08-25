import { db } from "../client";

export interface RealInterviewRow {
  id: number;
  company: string | null;
  role: string | null;
  round: string | null;
  interviewDate: string | null;
  rawDebrief: string | null;
  structuredQuestions: string | null;
  notes: string | null;
  createdAt: string;
}

interface RealInterviewDbRow {
  id: number;
  company: string | null;
  role: string | null;
  round: string | null;
  interview_date: string | null;
  raw_debrief: string | null;
  structured_questions: string | null;
  notes: string | null;
  created_at: string;
}

function map(row: RealInterviewDbRow): RealInterviewRow {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    round: row.round,
    interviewDate: row.interview_date,
    rawDebrief: row.raw_debrief,
    structuredQuestions: row.structured_questions,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export interface CreateRealInterviewInput {
  company?: string;
  role?: string;
  round?: string;
  interviewDate?: string;
  rawDebrief?: string;
  structuredQuestions: unknown;
  notes?: string;
}

export function createRealInterview(input: CreateRealInterviewInput): RealInterviewRow {
  const info = db
    .prepare(
      `INSERT INTO real_interviews
        (company, role, round, interview_date, raw_debrief, structured_questions, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.company ?? null,
      input.role ?? null,
      input.round ?? null,
      input.interviewDate ?? null,
      input.rawDebrief ?? null,
      JSON.stringify(input.structuredQuestions),
      input.notes ?? null,
    );
  return getRealInterview(Number(info.lastInsertRowid))!;
}

export function getRealInterview(id: number): RealInterviewRow | null {
  const row = db.prepare("SELECT * FROM real_interviews WHERE id = ?").get(id) as
    | RealInterviewDbRow
    | undefined;
  return row ? map(row) : null;
}

export function listRealInterviews(): RealInterviewRow[] {
  const rows = db
    .prepare("SELECT * FROM real_interviews ORDER BY id DESC")
    .all() as unknown as RealInterviewDbRow[];
  return rows.map(map);
}
