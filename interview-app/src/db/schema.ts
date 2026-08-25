// SQLite DDL，应用启动时幂等执行（CREATE TABLE IF NOT EXISTS）
// JSON 字段一律存 TEXT（JSON 字符串），读取时由仓库层 JSON.parse

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS resumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_url TEXT,
  raw_text TEXT NOT NULL,
  parsed_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  jd_text TEXT NOT NULL,
  jd_analysis TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interview_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  company TEXT,
  role TEXT,
  department TEXT,
  stage TEXT,
  question_type TEXT,
  topics TEXT,
  difficulty TEXT,
  source_type TEXT NOT NULL,
  source_platform TEXT,
  source_url TEXT,
  quality_score REAL,
  confidence REAL,
  knowledge_points TEXT,
  evaluation_rubric TEXT,
  embedding TEXT,
  imported_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 导入面经的父记录：一条面经 = 公司/岗位/轮次/总结/原文，题目挂在 interview_items.imported_id 下
CREATE TABLE IF NOT EXISTS imported_interviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT,
  role TEXT,
  round TEXT,
  summary TEXT,
  raw_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interview_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resume_id INTEGER,
  job_id INTEGER,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT,
  question_target INTEGER,
  requirement TEXT,
  interview_plan TEXT,
  candidate_state TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interview_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  turn_index INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_source_id INTEGER,
  question_type TEXT,
  topics TEXT,
  answer TEXT,
  evaluation TEXT,
  decision TEXT,
  is_follow_up INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS real_interviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT,
  role TEXT,
  round TEXT,
  interview_date TEXT,
  raw_debrief TEXT,
  structured_questions TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS competency_rubrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competency TEXT NOT NULL,
  levels TEXT,
  key_points TEXT,
  evaluation_dimensions TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ V2 记忆显式化：把候选人状态从 JSON blob 落成可查询的表 ============

CREATE TABLE IF NOT EXISTS competency_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  competency TEXT NOT NULL,
  score REAL NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  evidence TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weaknesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competency TEXT,
  weakness TEXT NOT NULL,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  hit_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE IF NOT EXISTS resume_risk_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resume_id INTEGER,
  risk TEXT NOT NULL,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  hit_count INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_comp_scores_session ON competency_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_comp_scores_competency ON competency_scores(competency);
CREATE INDEX IF NOT EXISTS idx_weaknesses_competency ON weaknesses(competency);

CREATE TABLE IF NOT EXISTS interview_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  interview_at TEXT NOT NULL,
  reminded INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_source_type ON interview_items(source_type);
CREATE INDEX IF NOT EXISTS idx_items_company ON interview_items(company);
CREATE INDEX IF NOT EXISTS idx_turns_session ON interview_turns(session_id);
`;
