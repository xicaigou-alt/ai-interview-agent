import { db } from "../client";

export interface ImportedInterviewRow {
  id: number;
  company: string | null;
  role: string | null;
  round: string | null;
  summary: string | null;
  rawText: string | null;
  createdAt: string;
}

interface ImportedInterviewDbRow {
  id: number;
  company: string | null;
  role: string | null;
  round: string | null;
  summary: string | null;
  raw_text: string | null;
  created_at: string;
}

function map(row: ImportedInterviewDbRow): ImportedInterviewRow {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    round: row.round,
    summary: row.summary,
    rawText: row.raw_text,
    createdAt: row.created_at,
  };
}

export interface CreateImportedInterviewInput {
  company?: string;
  role?: string;
  round?: string;
  summary?: string;
  rawText?: string;
}

export function createImportedInterview(input: CreateImportedInterviewInput): ImportedInterviewRow {
  const info = db
    .prepare(
      "INSERT INTO imported_interviews (company, role, round, summary, raw_text) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      input.company ?? null,
      input.role ?? null,
      input.round ?? null,
      input.summary ?? null,
      input.rawText ?? null,
    );
  return getImportedInterview(Number(info.lastInsertRowid))!;
}

export function getImportedInterview(id: number): ImportedInterviewRow | null {
  const row = db.prepare("SELECT * FROM imported_interviews WHERE id = ?").get(id) as
    | ImportedInterviewDbRow
    | undefined;
  return row ? map(row) : null;
}

export function listImportedInterviews(): ImportedInterviewRow[] {
  const rows = db
    .prepare("SELECT * FROM imported_interviews ORDER BY id DESC")
    .all() as unknown as ImportedInterviewDbRow[];
  return rows.map(map);
}

function normalizeContent(s: string): string {
  return s.toLowerCase().replace(/[\s，。；：、！？,.!?;:'"“”‘’()（）\-—_/\\]/g, "");
}

// 记录级去重：同一公司/岗位/轮次且总结内容相同，视为同一条面经（防止重复导入同一内容）
export function findImportedInterviewByContent(
  company: string | null,
  role: string | null,
  round: string | null,
  summary: string | null,
): ImportedInterviewRow | null {
  const rows = db
    .prepare("SELECT * FROM imported_interviews")
    .all() as unknown as ImportedInterviewDbRow[];
  const normSummary = normalizeContent(summary ?? "");
  for (const row of rows) {
    const existingSummary = normalizeContent(row.summary ?? "");
    // 双方总结都为空，或新总结与已有总结一致，才视为同一条面经
    const summariesMatch =
      (normSummary === "" && existingSummary === "") ||
      (normSummary !== "" && existingSummary === normSummary);
    if (
      (row.company ?? "") === (company ?? "") &&
      (row.role ?? "") === (role ?? "") &&
      (row.round ?? "") === (round ?? "") &&
      summariesMatch
    ) {
      return map(row);
    }
  }
  return null;
}
