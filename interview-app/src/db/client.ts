import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";

function resolveDbPath(): string {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "interview.db");
}

function ensureColumn(db: DatabaseSync, table: string, column: string, ddl: string): void {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  } catch {
    // 列已存在则忽略（幂等迁移）
  }
}

function initDb(): DatabaseSync {
  const db = new DatabaseSync(resolveDbPath());
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  // 等锁而不是立刻报 "database is locked"（构建期与运行实例并发时尤其重要）
  db.exec("PRAGMA busy_timeout = 5000;");
  // WAL 下推荐 NORMAL：降低 fsync 频率，兼顾安全与性能
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec(SCHEMA_SQL);
  // 幂等补列：兼容已存在旧库
  ensureColumn(db, "interview_turns", "topics", "TEXT");
  ensureColumn(db, "interview_sessions", "title", "TEXT");
  ensureColumn(db, "interview_sessions", "question_target", "INTEGER");
  ensureColumn(db, "interview_sessions", "requirement", "TEXT");
  ensureColumn(db, "interview_items", "imported_id", "INTEGER");
  return db;
}

// 全局复用同一连接（开发 HMR 与多模块引用下避免重复打开数据库）
const globalForDb = globalThis as unknown as { __db?: DatabaseSync };

function getDbInstance(): DatabaseSync {
  if (!globalForDb.__db) {
    globalForDb.__db = initDb();
  }
  return globalForDb.__db;
}

// 惰性初始化：首次真正访问数据库时才打开连接。
// next build 在「Collecting page data」阶段会执行路由模块的顶层代码；
// 若模块 import 即 initDb()，多 worker 并发打开 SQLite 并执行 DDL 会触发
// "database is locked"。用 Proxy 把打开动作推迟到首次实际使用。
export const db: DatabaseSync = new Proxy({} as DatabaseSync, {
  get(_target, prop, receiver) {
    const real = getDbInstance();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});
