import { db } from "../client";

export interface ResumeRow {
  id: number;
  fileUrl: string | null;
  rawText: string;
  parsedJson: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ResumeDbRow {
  id: number;
  file_url: string | null;
  raw_text: string;
  parsed_json: string | null;
  created_at: string;
  updated_at: string;
}

function map(row: ResumeDbRow): ResumeRow {
  return {
    id: row.id,
    fileUrl: row.file_url,
    rawText: row.raw_text,
    parsedJson: row.parsed_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createResume(rawText: string, fileUrl: string | null = null): ResumeRow {
  const info = db
    .prepare("INSERT INTO resumes (file_url, raw_text) VALUES (?, ?)")
    .run(fileUrl, rawText);
  return getResume(Number(info.lastInsertRowid))!;
}

export function getResume(id: number): ResumeRow | null {
  const row = db.prepare("SELECT * FROM resumes WHERE id = ?").get(id) as
    | ResumeDbRow
    | undefined;
  return row ? map(row) : null;
}

// 单简历模式：取最新一份
export function getCurrentResume(): ResumeRow | null {
  const row = db
    .prepare("SELECT * FROM resumes ORDER BY id DESC LIMIT 1")
    .get() as ResumeDbRow | undefined;
  return row ? map(row) : null;
}

export function updateResumeParsed(id: number, parsed: unknown): void {
  db.prepare("UPDATE resumes SET parsed_json = ?, updated_at = datetime('now') WHERE id = ?").run(
    JSON.stringify(parsed),
    id,
  );
}

export function parseResumeRow(row: ResumeRow): unknown | null {
  if (!row.parsedJson) return null;
  try {
    return JSON.parse(row.parsedJson);
  } catch {
    return null;
  }
}
