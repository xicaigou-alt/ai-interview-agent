import { db } from "../client";
import type { SQLInputValue } from "node:sqlite";
import { upsertItemEmbedding } from "../vector";
import { embedText } from "@/llm";
import type { InterviewItem, SourceType } from "@/core/engine-types";

interface ItemDbRow {
  id: number;
  question: string;
  company: string | null;
  role: string | null;
  department: string | null;
  stage: string | null;
  question_type: string | null;
  topics: string | null;
  difficulty: string | null;
  source_type: string;
  source_platform: string | null;
  source_url: string | null;
  quality_score: number | null;
  confidence: number | null;
  knowledge_points: string | null;
  evaluation_rubric: string | null;
  imported_id: number | null;
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

function map(row: ItemDbRow): InterviewItem {
  return {
    id: row.id,
    question: row.question,
    company: row.company ?? undefined,
    role: row.role ?? undefined,
    department: row.department ?? undefined,
    stage: row.stage ?? undefined,
    questionType: row.question_type ?? undefined,
    topics: safeParseArray(row.topics),
    difficulty: row.difficulty ?? undefined,
    sourceType: row.source_type as SourceType,
    sourcePlatform: row.source_platform ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    qualityScore: row.quality_score ?? undefined,
    confidence: row.confidence ?? undefined,
    knowledgePoints: safeParseArray(row.knowledge_points),
    evaluationRubric: safeParseArray(row.evaluation_rubric),
    importedId: row.imported_id ?? undefined,
  };
}

export async function insertItem(item: InterviewItem): Promise<number> {
  const info = db
    .prepare(
      `INSERT INTO interview_items
        (question, company, role, department, stage, question_type, topics, difficulty,
         source_type, source_platform, source_url, quality_score, confidence,
         knowledge_points, evaluation_rubric, imported_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      item.question,
      item.company ?? null,
      item.role ?? null,
      item.department ?? null,
      item.stage ?? null,
      item.questionType ?? null,
      JSON.stringify(item.topics ?? []),
      item.difficulty ?? null,
      item.sourceType,
      item.sourcePlatform ?? null,
      item.sourceUrl ?? null,
      item.qualityScore ?? null,
      item.confidence ?? null,
      JSON.stringify(item.knowledgePoints ?? []),
      JSON.stringify(item.evaluationRubric ?? []),
      item.importedId ?? null,
    );

  const id = Number(info.lastInsertRowid);

  try {
    const vec = await embedText(item.question);
    upsertItemEmbedding(id, vec);
  } catch {
    // 无 embedding key 或失败：跳过，语义检索自然降级
  }

  return id;
}

function normalizeQuestion(s: string): string {
  return s.toLowerCase().replace(/[\s，。；：、！？,.!?;:'"“”‘’()（）\-—_/\\]/g, "");
}

// 按规范化后的问题文本查重（忽略空白/标点/大小写差异）
export function findItemByQuestion(question: string): InterviewItem | null {
  const target = normalizeQuestion(question);
  if (!target) return null;
  const rows = db.prepare("SELECT id, question FROM interview_items").all() as unknown as {
    id: number;
    question: string;
  }[];
  for (const row of rows) {
    if (normalizeQuestion(row.question) === target) {
      const full = db.prepare("SELECT * FROM interview_items WHERE id = ?").get(row.id) as
        | ItemDbRow
        | undefined;
      return full ? map(full) : null;
    }
  }
  return null;
}

export function getItemById(id: number): InterviewItem | null {
  const row = db.prepare("SELECT * FROM interview_items WHERE id = ?").get(id) as
    | ItemDbRow
    | undefined;
  return row ? map(row) : null;
}

export interface ItemFilter {
  company?: string;
  role?: string;
  topic?: string;
  sourceType?: SourceType;
  limit?: number;
}

export function searchItemsByMetadata(filter: ItemFilter): InterviewItem[] {
  const clauses: string[] = [];
  const params: SQLInputValue[] = [];

  if (filter.company) {
    clauses.push("company = ?");
    params.push(filter.company);
  }
  if (filter.role) {
    clauses.push("role = ?");
    params.push(filter.role);
  }
  if (filter.topic) {
    clauses.push("topics LIKE ?");
    params.push(`%"${filter.topic}"%`);
  }
  if (filter.sourceType) {
    clauses.push("source_type = ?");
    params.push(filter.sourceType);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filter.limit ?? 10;

  const rows = db
    .prepare(`SELECT * FROM interview_items ${where} ORDER BY quality_score DESC LIMIT ?`)
    .all(...params, limit) as unknown as ItemDbRow[];

  return rows.map(map);
}

export interface CompanyTopicFilter {
  company: string;
  role?: string;
  topic?: string;
  limit?: number;
}

// 公司范围检索：company 支持「精确 OR 双向子串」匹配，兼容别名（阿里/阿里巴巴、字节/字节跳动等）。
// 始终限定目标公司，避免跨公司抓取面经造成岗位针对性污染（评测修复项）。
export function searchItemsByCompanyTopic(filter: CompanyTopicFilter): InterviewItem[] {
  const { company, role, topic, limit = 10 } = filter;
  const clauses: string[] = [];
  const params: SQLInputValue[] = [];

  clauses.push("(company IS NOT NULL AND company != '' AND (company = ? OR company LIKE '%' || ? || '%' OR ? LIKE '%' || company || '%'))");
  params.push(company, company, company);

  if (role) {
    clauses.push("role = ?");
    params.push(role);
  }
  if (topic) {
    clauses.push("topics LIKE ?");
    params.push(`%"${topic}"%`);
  }

  const where = `WHERE ${clauses.join(" AND ")}`;
  const rows = db
    .prepare(`SELECT * FROM interview_items ${where} ORDER BY quality_score DESC, id DESC LIMIT ?`)
    .all(...params, limit) as unknown as ItemDbRow[];

  return rows.map(map);
}

export function listItems(filter: { sourceType?: SourceType } = {}): InterviewItem[] {
  const clauses: string[] = [];
  const params: SQLInputValue[] = [];
  if (filter.sourceType) {
    clauses.push("source_type = ?");
    params.push(filter.sourceType);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT * FROM interview_items ${where} ORDER BY id DESC`).all(...params) as unknown as ItemDbRow[];
  return rows.map(map);
}

export function deleteItem(id: number): void {
  db.prepare("DELETE FROM interview_items WHERE id = ?").run(id);
}
