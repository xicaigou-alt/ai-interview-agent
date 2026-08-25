import { db } from "../client";

export interface JobRow {
  id: number;
  company: string;
  role: string;
  jdText: string;
  jdAnalysis: string | null;
  createdAt: string;
}

interface JobDbRow {
  id: number;
  company: string;
  role: string;
  jd_text: string;
  jd_analysis: string | null;
  created_at: string;
}

function map(row: JobDbRow): JobRow {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    jdText: row.jd_text,
    jdAnalysis: row.jd_analysis,
    createdAt: row.created_at,
  };
}

export function createJob(company: string, role: string, jdText: string): JobRow {
  const info = db
    .prepare("INSERT INTO jobs (company, role, jd_text) VALUES (?, ?, ?)")
    .run(company, role, jdText);
  return getJob(Number(info.lastInsertRowid))!;
}

export function getJob(id: number): JobRow | null {
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobDbRow | undefined;
  return row ? map(row) : null;
}

export function getLatestJob(): JobRow | null {
  const row = db.prepare("SELECT * FROM jobs ORDER BY id DESC LIMIT 1").get() as
    | JobDbRow
    | undefined;
  return row ? map(row) : null;
}

export function listJobs(): JobRow[] {
  const rows = db.prepare("SELECT * FROM jobs ORDER BY id DESC").all() as unknown as JobDbRow[];
  return rows.map(map);
}

export function updateJobAnalysis(id: number, analysis: unknown): void {
  db.prepare("UPDATE jobs SET jd_analysis = ? WHERE id = ?").run(JSON.stringify(analysis), id);
}

export function parseJobAnalysis(row: JobRow): unknown | null {
  if (!row.jdAnalysis) return null;
  try {
    return JSON.parse(row.jdAnalysis);
  } catch {
    return null;
  }
}
