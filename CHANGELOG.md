# Changelog

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。版本号沿用 `interview-app/package.json`。

---

## [v0.3.0] - 2026-09-11 — 评测驱动修复：真实面经检索的岗位针对性

### Added（新增）

- **评测集与四系统消融基线**（`interview-app/eval/`）：24 题评测集（3 家公司 × 8 个考察点）、5 维评分 rubric、消融脚本（C0 裸通用 / A JD 生成 / B_old 当前实现 / B_new 修复方案）、LLM 裁判盲评与聚合；产出 `results.json` / `results.md` / `README.md`。
- **公司范围检索**：`searchItemsByCompanyTopic`（`interview_items.ts`）——company 支持「精确 OR 双向子串」匹配（兼容阿里/阿里巴巴、字节/字节跳动别名），并排除空公司题。
- **结合 JD 的面经改写**：`rewriteWithJdContext`（`generate-question.ts`）——保留面经考察点，注入目标公司 JD 业务语境。

### Changed（变更）

- `retrieve-question.ts`：检索**限定目标公司**（精确 → 放宽岗位 → 公司内语义），移除跨公司 topic 兜底；无命中返回 `null`，交由 LLM 生成兜底（空库/冷启动仍可跑通）。
- `engine.ts`：知识题出题由「去锚点改写」改为「面经考察点 + JD 业务语境改写」。

### 验证

- `pnpm typecheck` ✅ ；`pnpm test`：25/25 通过 ✅
- 评测实测：岗位针对性 2.75 → **5.00 / 5**；总分 13.63 → **24.46 / 25**（**+79.5%**）；三个锚点面经命中率均 100%

### 背景（为什么改）

评测发现「真实面经 + 去锚点」因面经题偏浅（平均 28 字、`quality_score` 582/582 为空）、跨公司检索污染（如阿里岗位抓到百度题）、去锚点删掉公司上下文而**劣于** LLM 生成。结论：「实时面经」的价值成立，但必须建立在「目标公司检索 + JD 个性化改写」之上。

## [v0.2.0] - 2026-08-24 — V2：从陪练工具升级为个人专属 Agent

### Added（新增）

- **记忆显式化**：新增 `competency_scores` / `weaknesses` / `resume_risk_points` 三张表，把原本塞在 `candidate_state` 里的黑盒 JSON 落成可查询、可画趋势的长期记忆；每次回答后由引擎自动写入（`recordTurnMemory`）。
- **单元测试体系**：24 项测试（Node 24 内置 `node:test`，零新依赖），覆盖候选状态机、追问上限兜底、难度调整、练习计划、余弦相似度、提醒同步；`pnpm test` 命令。
- **难度自适应**：补上设计文档 §5.5 承诺但缺失的「是否增加难度」决策点——主问题得分 ≥80 升一档、≤55 降一档，其余保持（带滞回区间）。
- **面试日程 + 每日练习计划**：新增 `interview_schedule` 表、`/api/schedule` 增删查；首页新增「面试日程」录入/删除、「明天有面试」提醒横幅、基于记忆表自动生成的「今日练习计划」。
- **半双工语音复盘**：SiliconFlow SenseVoice 转写（`src/llm/asr.ts` + `/api/voice/transcribe`），知识库页「🎤 语音复盘」录音后自动填入复盘文本，复用现有 parse-debrief 管线。
- **图片导入面经**：SiliconFlow Qwen2.5-VL 视觉抽取（`src/llm/vision.ts` + `/api/knowledge/import-image/parse`），知识库页「🖼 导入截图」，抽取结果复用文本导入的确认/保存管线。
- **面试前一天提醒（方案 A）**：新增零依赖独立服务 `server/reminder.mjs`（HTTP + 每小时定时检查 + PushPlus 微信推送）；本地 `src/lib/reminder-sync.ts` 在增删日程时自动上报，仅日程上云，练习数据留本地。
- **本地开机自启 + 提醒弹窗**：`scripts/start-agent.cmd`（开机自动构建/启动服务/打开首页）+ `scripts/reminder-toast.ps1`（开机右下角悬浮弹窗：明日面试安排 + 今日练习计划，点击打开首页）；加入 `shell:startup` 或任务计划程序即可免手动敲命令。

### Changed（变更）

- `engine.ts`：每次评价后记录长期记忆；主问题作答后动态调整难度。
- `CandidateState` 新增 `difficulty` 字段（`engine-types.ts` / `candidate-state.ts`），随会话持久化。
- 抽取纯逻辑模块便于单测：`decision-rules.ts`（追问上限）、`cosine.ts`、`difficulty.ts`、`plan-practice.ts`。
- `src/app/page.tsx`：新增面试日程、今日练习计划、明天提醒三个区块。
- `src/app/knowledge/page.tsx`：新增语音复盘、截图导入两个入口。
- `tsconfig.json`：开启 `allowImportingTsExtensions`（支持 `node:test` 直接跑 `.ts`）。
- `package.json`：新增 `test` 脚本。
- `.env.example`：新增 `STT_MODEL`、`VISION_MODEL`、`REMINDER_SERVER_URL`、`REMINDER_AUTH_TOKEN`、`PUSHPLUS_TOKEN`。
- `.gitignore`：新增 `/server/data`。

### Removed / 放弃

- **放弃「自动爬取小红书/牛客面经」方向**：小红书等平台强反爬，自动抓取属违规/灰产且有合规风险。替代方案：手动粘贴文字 + 截图导入（已落地）。

### 架构决策

- **方案 A（本地为主，仅日程上云）**：简历、题库、复盘记录全部留在本地 SQLite；只有「面试日程」这一种轻数据上报到提醒服务器，用于触发微信推送。

### 验证

- `pnpm typecheck` ✅
- `pnpm test`：24/24 通过 ✅
- 提醒服务端到端冒烟测试：`/health`、`/sync`、中文 UTF-8 存储 ✅
- ⚠️ `pnpm build` 未能在开发沙箱运行（沙箱禁止子进程），需在本机验证。

### 待办 / 注意

- 语音（SenseVoice）与视觉（Qwen2.5-VL）链路需要真实 SiliconFlow key 在本机实测（沙箱无法出网）。
- `competency_rubrics` 表仍未接入评价流程，当前由题目自带 rubric + V2 记忆表覆盖。
- 提醒服务部署步骤见 `interview-app/server/README.md`。
