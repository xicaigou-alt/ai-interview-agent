// 极简面试提醒服务（方案 A：本地为主，仅日程上云）
// 零依赖，Node 18+ 直接运行：`node server/reminder.mjs`
// 环境变量：
//   PORT（默认 8787）
//   PUSHPLUS_TOKEN（必填，PushPlus 微信推送 token）
//   AUTH_TOKEN（可选，/sync 接口的 Bearer 鉴权）
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN ?? "";
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? "";
const DATA_FILE = path.join(__dirname, "data", "schedules.json");

function loadSchedules() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveSchedules(list) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 纯逻辑：选出「明天有面试且未提醒」的日程
function selectDueTomorrow(list, now = new Date()) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tkey = dateKey(tomorrow);
  return list.filter((s) => !s.reminded && dateKey(new Date(s.interviewAt)) === tkey);
}

async function pushToWeChat(title, content) {
  if (!PUSHPLUS_TOKEN) {
    console.warn("[reminder] 未配置 PUSHPLUS_TOKEN，跳过推送");
    return;
  }
  const res = await fetch("https://www.pushplus.plus/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: PUSHPLUS_TOKEN, title, content, template: "html" }),
  });
  if (!res.ok) throw new Error(`PushPlus 返回 ${res.status}`);
}

async function checkAndNotify() {
  const list = loadSchedules();
  const due = selectDueTomorrow(list);
  if (due.length === 0) return;
  const title = `⏰ 明天有 ${due.length} 场面试，记得准备`;
  const content = due.map((s) => `${s.company} · ${s.role}（${s.interviewAt}）`).join("<br/>");
  try {
    await pushToWeChat(title, content);
    for (const s of due) s.reminded = true;
    saveSchedules(list);
    console.log(`[reminder] 已推送 ${due.length} 条提醒`);
  } catch (e) {
    console.error("[reminder] 推送失败：", e instanceof Error ? e.message : e);
  }
}

const server = http.createServer((req, res) => {
  const send = (code, data) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };

  if (req.method === "GET" && req.url === "/health") return send(200, { ok: true });

  if (req.method === "POST" && req.url === "/sync") {
    if (AUTH_TOKEN) {
      const auth = req.headers.authorization ?? "";
      if (auth !== `Bearer ${AUTH_TOKEN}`) return send(401, { error: "unauthorized" });
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { schedules } = JSON.parse(body);
        if (!Array.isArray(schedules)) return send(400, { error: "schedules 需为数组" });
        const old = loadSchedules();
        // 合并：保留服务端已有的 reminded 标记
        const merged = schedules.map((s) => {
          const prev = old.find(
            (o) => o.company === s.company && o.role === s.role && o.interviewAt === s.interviewAt,
          );
          return {
            company: s.company,
            role: s.role,
            interviewAt: s.interviewAt,
            reminded: prev?.reminded ?? false,
          };
        });
        saveSchedules(merged);
        send(200, { ok: true, count: merged.length });
      } catch (e) {
        send(400, { error: e instanceof Error ? e.message : String(e) });
      }
    });
    return;
  }

  send(404, { error: "not found" });
});

server.listen(PORT, () => console.log(`[reminder] 服务已启动 :${PORT}`));

// 启动时 + 每小时检查一次
checkAndNotify();
setInterval(checkAndNotify, 60 * 60 * 1000);
