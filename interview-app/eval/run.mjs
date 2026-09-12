// AI 个性化模拟面试 Agent —— 问题生成质量评测脚本（四系统消融）
// C0 裸通用 / A JD个性化生成 / B_old 当前实现(面经+去锚点) / B_new 修复(面经考察点+JD改写)
// 用法：node eval/run.mjs   （在 interview-app 目录下）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "cases.json"), "utf8"));
const MODEL = cases.model || "deepseek-chat";
const DIFFICULTY = cases.difficulty || "medium";

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const KEY = env.DEEPSEEK_API_KEY;
const BASE = (env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
if (!KEY) { console.error("缺少 DEEPSEEK_API_KEY"); process.exit(1); }

const db = new DatabaseSync(path.join(ROOT, "data", "interview.db"), { readOnly: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function parseJsonContent(content) {
  const s = String(content ?? "").trim();
  try { return JSON.parse(s); } catch {}
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) return JSON.parse(m[1].trim());
  return JSON.parse(s);
}
function seededShuffle(arr, seed) {
  let s = seed >>> 0;
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function chatJson(messages, { temperature = 0.2, maxTokens } = {}) {
  const convo = [...messages];
  const hasJson = convo.some((m) => /json/i.test(m.content));
  if (!hasJson) convo.unshift({ role: "system", content: "You are a helpful assistant. Always respond with valid JSON only (no markdown fences, no extra text)." });
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: MODEL, messages: convo, temperature, response_format: { type: "json_object" }, ...(maxTokens ? { max_tokens: maxTokens } : {}) }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
    const content = j.choices?.[0]?.message?.content ?? "";
    try { return parseJsonContent(content); } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      convo.push({ role: "user", content: `你上一次的输出不是合法 JSON（错误：${lastError}）。请只输出合法 JSON，不要包含多余文字或代码块。` });
    }
  }
  throw new Error(`chatJson 多次重试后仍失败：${lastError}`);
}

async function chatText(messages, { temperature = 0.3 } = {}) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, messages, temperature }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j.choices?.[0]?.message?.content ?? "";
}

function getResumeText(resumeId) {
  const row = db.prepare("SELECT raw_text FROM resumes WHERE id = ?").get(resumeId);
  return row?.raw_text ?? "";
}
function safeArr(s) { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
function mapItem(r) {
  return {
    id: r.id, question: r.question, company: r.company ?? undefined, role: r.role ?? undefined,
    questionType: r.question_type ?? undefined, topics: safeArr(r.topics), difficulty: r.difficulty ?? undefined,
    sourceType: r.source_type, sourcePlatform: r.source_platform ?? undefined, qualityScore: r.quality_score ?? undefined,
  };
}
// 检索：仅目标公司（aliases）+ topic 精确匹配，不做跨公司兜底（修复根因3）
function retrieveTargetCompany(anchor, topic) {
  const clauses = [`company IN (${anchor.companyAliases.map(() => "?").join(",")})`, "topics LIKE ?"];
  const params = [...anchor.companyAliases, `%"${topic}"%`];
  const rows = db.prepare(`SELECT * FROM interview_items WHERE ${clauses.join(" AND ")} ORDER BY quality_score DESC, id DESC LIMIT 10`).all(...params);
  const candidates = rows.map(mapItem).filter((x) => x.id != null && x.sourceType !== "SIMULATED_INTERVIEW");
  return candidates[0] ?? null;
}

// C0：裸通用
async function genC0(topic) {
  const out = await chatText(
    [
      { role: "system", content: "你是一名模拟面试的面试官。" },
      { role: "user", content: `我正在准备 AI 产品经理岗位的面试，请给我出一道关于「${topic}」的面试题。只输出题目本身，不要给答案、不要解释。` },
    ],
    { temperature: 0.6 },
  );
  return out.trim();
}

// A：JD 个性化生成（复刻 generateKnowledgeQuestion）
async function genA(anchor, topic) {
  const out = await chatJson(
    [
      { role: "system", content: "你是资深面试官，擅长针对特定 topic 生成高质量、可追问的面试主问题。" },
      {
        role: "user",
        content: `请为「${anchor.role}」岗位出一道关于「${topic}」的**知识考察题**（难度：${DIFFICULTY}）。

要求：
1. 这道题只考察知识点本身，绝不涉及任何候选人简历经历、项目。
2. 可以结合岗位 JD 的业务语境（一句话场景），让题目更贴近实际工作。
3. 只问一个核心问题，不要连环问；不要给出答案或提示。

输出 JSON（camelCase）：
{ "question": "...", "questionType": "AI_KNOWLEDGE", "topics": ["${topic}"], "difficulty": "${DIFFICULTY}" }

岗位 JD 重点要求（priorityRequirements，作业务语境参考）：
${(anchor.priorityRequirements ?? []).length ? anchor.priorityRequirements.map((r) => `- ${r}`).join("\n") : "（无）"}

岗位 JD（节选）：
${anchor.jdText.slice(0, 1500)}`,
      },
    ],
    { temperature: 0.5 },
  );
  return out.question;
}

// B_old：当前实现 —— 检索面经 → 去锚点（无 JD 注入）
async function genBold(anchor, topic) {
  const item = retrieveTargetCompany(anchor, topic);
  if (!item) return { question: await genA(anchor, topic), retrieved: null };
  const generic = await chatText(
    [
      { role: "system", content: "你是资深面试官。下面这道面试题可能含有原答主的个人经历锚点（如「你上一段实习做的XX项目」「你们公司的XX」）。请把它改写为一道通用的知识考察题：去掉所有具体个人/公司/项目经历，保留并聚焦原考察点。不要评价、不要泄露答案。" },
      { role: "user", content: `原题：\n${item.question}\n\n只输出改写后的题目本身（以问号结尾），不要任何多余文字。` },
    ],
    { temperature: 0.3 },
  );
  return { question: generic.trim(), retrieved: { sourceId: item.id, sourceCompany: item.company ?? null, sourceQuestion: item.question } };
}

// B_new：修复 —— 检索目标公司面经 → 保留考察点 + 结合 JD 业务语境改写
async function genBnew(anchor, topic) {
  const item = retrieveTargetCompany(anchor, topic);
  if (!item) return { question: await genA(anchor, topic), retrieved: null };
  const rewritten = await chatText(
    [
      { role: "system", content: "你是资深面试官。" },
      {
        role: "user",
        content: `下面是一道来自「真实面经」的面试题（可能较简短），以及目标公司/岗位的 JD。

请以这道面经题所考察的「知识点/能力点」为内核，结合 JD 中的业务语境，改写为一道**有具体场景、有深度、可追问**的面试题：
1. 保留原题的核心考察点（不要换成别的知识点、不要偏题）。
2. 用 JD 里的具体业务场景开场，让题目明显贴合「${anchor.company}」，而不是通用套话。
3. 只问一个核心问题，不要连环问，不要给答案或提示。

真实面经原题：${item.question}
目标公司/岗位：${anchor.company} / ${anchor.role}

岗位 JD（节选）：
${anchor.jdText.slice(0, 1500)}

只输出改写后的题目本身（以问号结尾），不要任何多余文字。`,
      },
    ],
    { temperature: 0.4 },
  );
  return { question: rewritten.trim(), retrieved: { sourceId: item.id, sourceCompany: item.company ?? null, sourceQuestion: item.question } };
}

// 裁判：盲评 4 题同 topic 并排
async function judge(anchor, topic, shuffled) {
  const questions = shuffled.map((s, i) => `${i + 1}. ${s.question}`).join("\n");
  const out = await chatJson(
    [
      { role: "system", content: "你是资深 AI 产品经理面试官与面试评测专家，严格、公正、不偏袒任何来源。" },
      {
        role: "user",
        content: `下面给出同一考察点「${topic}」下的 4 道面试题（顺序已随机打乱、无任何来源标注），目标岗位为「${anchor.company} / ${anchor.role}」。

请独立地对每道题在以下 5 个维度打分（1-5 的整数，5 为最优）：
1. 岗位针对性（是否贴合该公司业务与岗位要求）
2. 真实感（是否像该公司真实面试会问的、有具体细节）
3. 专业深度（是否触及原理/能力边界/工程权衡）
4. 可追问性（是否单一明确、天然可深挖）
5. 难度适配（对 AI 产品经理岗位难度是否恰如其分）

题目：
${questions}

岗位 JD（用于判断「岗位针对性」，节选）：
${anchor.jdText.slice(0, 1200)}

输出严格 JSON（只输出 JSON）：
{
  "scores": [
    {"index": 1, "scores": {"岗位针对性": 5, "真实感": 4, "专业深度": 4, "可追问性": 4, "难度适配": 4}, "comment": "一句话"},
    {"index": 2, "scores": {...}, "comment": "..."},
    {"index": 3, "scores": {...}, "comment": "..."},
    {"index": 4, "scores": {...}, "comment": "..."}
  ]
}`,
      },
    ],
    { temperature: 0.2 },
  );
  return out.scores;
}

const DIMENSIONS = ["岗位针对性", "真实感", "专业深度", "可追问性", "难度适配"];
const SYS_KEYS = ["C0", "A", "B_old", "B_new"];
const resumeText = getResumeText(cases.resumeId);
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function sumObj(obj) { return Object.values(obj).reduce((a, b) => a + b, 0); }

async function main() {
  console.log(`评测启动：${cases.anchors.length} 锚点 × ${cases.anchors[0].topics.length} 题 × ${SYS_KEYS.length} 系统，模型 ${MODEL}`);
  console.log(`简历 resume#${cases.resumeId}（${resumeText.length} 字）；JD 为评测用公司专属 JD\n`);

  const results = [];
  const allRows = [];

  for (const anchor of cases.anchors) {
    console.log(`=== 锚点 ${anchor.id}（${anchor.company} / ${anchor.role}）===`);
    for (let ti = 0; ti < anchor.topics.length; ti++) {
      const topic = anchor.topics[ti];
      process.stdout.write(`  [${anchor.id}] ${topic}：生成 ${SYS_KEYS.join("/")} ... `);

      const c0q = await genC0(topic); await sleep(120);
      const aq = await genA(anchor, topic); await sleep(120);
      const bold = await genBold(anchor, topic); await sleep(120);
      const bnew = await genBnew(anchor, topic); await sleep(120);

      const systems = { C0: { question: c0q, retrieved: null }, A: { question: aq, retrieved: null }, B_old: bold, B_new: bnew };
      process.stdout.write("裁判 ... ");

      const seed = (anchor.id + topic).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const shuffled = seededShuffle(SYS_KEYS, seed).map((k) => ({ key: k, question: systems[k].question }));
      const judgeScores = await judge(anchor, topic, shuffled);

      const judgeMap = { C0: null, A: null, B_old: null, B_new: null };
      for (const s of judgeScores) {
        const pos = shuffled[s.index - 1];
        if (pos) judgeMap[pos.key] = { scores: s.scores, comment: s.comment };
      }

      const totals = {};
      for (const k of SYS_KEYS) totals[k] = judgeMap[k] ? sumObj(judgeMap[k].scores) : 0;
      console.log(`C0=${totals.C0} A=${totals.A} B_old=${totals.B_old} B_new=${totals.B_new}${bnew.retrieved ? " [面经命中]" : " [未命中]"}`);

      results.push({ anchor: anchor.id, company: anchor.company, topic, systems, judge: judgeMap });
      for (const k of SYS_KEYS) {
        allRows.push({ anchor: anchor.id, topic, system: k, ...(judgeMap[k]?.scores ?? {}), comment: judgeMap[k]?.comment, total: totals[k], retrieved: !!systems[k].retrieved });
      }
      await sleep(120);
    }
    console.log("");
  }

  const agg = { overall: {}, perAnchor: {}, traceable: {}, wins: {} };
  for (const sys of SYS_KEYS) {
    const rows = allRows.filter((r) => r.system === sys);
    agg.overall[sys] = {};
    for (const d of DIMENSIONS) agg.overall[sys][d] = Number(mean(rows.map((r) => r[d] ?? 0)).toFixed(2));
    agg.overall[sys].total = Number(mean(rows.map((r) => r.total ?? 0)).toFixed(2));
    agg.overall[sys].n = rows.length;
  }
  for (const anchor of cases.anchors) {
    agg.perAnchor[anchor.id] = {};
    for (const sys of SYS_KEYS) {
      const rows = allRows.filter((r) => r.anchor === anchor.id && r.system === sys);
      agg.perAnchor[anchor.id][sys] = { total: Number(mean(rows.map((r) => r.total ?? 0)).toFixed(2)), n: rows.length };
    }
    const b = allRows.filter((r) => r.anchor === anchor.id && r.system === "B_new");
    agg.traceable[anchor.id] = { hit: b.filter((r) => r.retrieved).length, total: b.length, ratio: Number((b.filter((r) => r.retrieved).length / (b.length || 1)).toFixed(2)) };
  }
  for (const sys of SYS_KEYS) agg.wins[sys] = 0;
  for (const r of results) {
    const t = {};
    for (const k of SYS_KEYS) t[k] = sumObj(r.judge[k]?.scores ?? {});
    const mx = Math.max(...SYS_KEYS.map((k) => t[k]));
    for (const k of SYS_KEYS) if (t[k] === mx) agg.wins[k] += 1;
  }

  const payload = { generatedAt: new Date().toISOString(), model: MODEL, difficulty: DIFFICULTY, resumeId: cases.resumeId, caseCount: results.length, results, aggregate: agg };
  fs.writeFileSync(path.join(__dirname, "results.json"), JSON.stringify(payload, null, 2), "utf8");

  console.log("========== 聚合结果（满分25）==========");
  for (const sys of SYS_KEYS) console.log(`  ${sys}: ${agg.overall[sys].total}  (n=${agg.overall[sys].n})`);
  console.log("分维度均值：");
  for (const sys of SYS_KEYS) console.log(`  ${sys}: ${DIMENSIONS.map((d) => `${d} ${agg.overall[sys][d]}`).join(" | ")}`);
  console.log("胜率：", JSON.stringify(agg.wins));
  console.log("B_new 面经命中率：", JSON.stringify(agg.traceable));
  console.log("\n结果已写入 eval/results.json");
}

main().catch((e) => { console.error("\n评测失败：", e); process.exit(1); });
