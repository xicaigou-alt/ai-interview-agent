# Personal AI Interview Agent — V1 技术方案

> 状态：方案已确定（待评审后进入 PRD）
> 上游：`design-document.md`（V1.0 产品设计文档）
> 目标：在「独立 Web 应用」定位下，明确 V1 的技术选型、架构、模块划分、数据模型、里程碑与风险，作为 `PRD-v1.md` 的输入。

---

## 1. 已确认的决策（5 项拍板 + 1 项补充）

| # | 决策点 | 结论 |
|---|---|---|
| 1 | 产品形态 | **独立 Web 应用**（非插件、非完全自主 Agent） |
| 2 | 数据存储 + 向量检索 | **SQLite + sqlite-vec** |
| 3 | LLM 主模型 | **DeepSeek API**（`deepseek-chat` 为主，`deepseek-reasoner` 用于强推理节点） |
| 4 | 部署方式 | **本地 localhost**（单用户自用，零运维） |
| 5 | V1 范围 | **完整保留 §40 的 14 项 P0** |
| 6 | 简历输入 | **粘贴文本 + 上传 PDF/DOCX**（图片/OCR 后移至 P1） |
| 7 | Embedding 来源 | **SiliconFlow `BAAI/bge-m3`** |
| 8 | 简历数量 | **单简历**（V1 先维护一份当前简历） |
| 9 | 面试模式 | **Coaching + Mock 两种都做** |

---

## 2. 技术栈

### 2.1 框架与语言

| 层 | 选型 | 说明 |
|---|---|---|
| 语言 | TypeScript | 全栈统一，结构化类型与 Zod 校验配合 |
| 框架 | Next.js（App Router） | 一个仓库同时承载前端 6 页面 + 后端 API（对应 §36） |
| UI | React + Tailwind CSS | 文档既定 |
| 后端 | Next.js Route Handlers / Server Actions | V1 先不分拆 FastAPI |

### 2.2 数据与检索

| 项 | 选型 | 说明 |
|---|---|---|
| 关系数据 | SQLite（`better-sqlite3`） | 单文件零运维，单用户规模足够 |
| ORM | Drizzle ORM | 轻量、SQL-first，便于裸 SQL 与迁移 |
| 向量检索 | `sqlite-vec`（`vec0` 虚拟表） | 通过 `better-sqlite3.loadExtension` 加载；向量化对象 = Interview Items（§34） |
| 兜底 | JS 暴力余弦相似度 | 若原生扩展加载受阻，小规模（几百条内）完全够用 |

### 2.3 LLM（DeepSeek）

- 客户端：`openai` SDK 指向 `https://api.deepseek.com`（DeepSeek 为 OpenAI 兼容协议）。
- 模型分工：
  - `deepseek-chat`：解析、生成、追问、评价等主链路（成本低、快）。
  - `deepseek-reasoner`：可选，用于 Evaluator / Decision Engine 等强推理节点。
- 结构化输出：使用 **JSON Output 模式**（`response_format: { type: "json_object" }`）+ **Zod 校验** + **失败重试**，保证 Resume Parser / Evaluator / Decision Engine 等结构化结果稳定。
- 抽象层：所有 LLM 调用收敛到 `LlmProvider` 接口，避免业务代码直接依赖厂商 SDK。

### 2.4 Embedding（补充决策点）

DeepSeek 无向量接口，`sqlite-vec` 的向量需另取来源。已确认方案：

| 优先级 | 方案 | 说明 |
|---|---|---|
| **首选** | SiliconFlow `BAAI/bge-m3`（OpenAI 兼容 `/v1/embeddings`） | 多语言、中文技术问答效果好、有免费额度、只需一个 key |
| 备选 1 | OpenAI `text-embedding-3-small` | 若你已有 OpenAI key，可直接复用 |
| 备选 2 | 本地 `@xenova/transformers` | 零外部依赖，但中文质量与内存一般 |
| 兜底 | V1 先不做语义检索，用「元数据精确匹配 + 关键词」 | 若不想注册第二个 key，检索后移至 P1 |

> 已确认：采用首选 SiliconFlow `BAAI/bge-m3`。

### 2.5 文件存储

- 本地文件系统（`uploads/` 目录），替代 §36 的 S3。
- 通过 `FileStorage` 抽象封装，后续可无损切换 S3-compatible 存储。

### 2.6 简历解析

- PDF：`pdf-parse`（或 `pdfjs-dist`）抽取文本。
- DOCX：`mammoth` 抽取文本。
- 兜底：**粘贴文本/Markdown**，复杂排版失真时用户可直接粘贴。

---

## 3. 架构原则

沿用文档既定原则，写入实现约束：

1. **Workflow First, Agent Inside**（§5.5）：固定主流程，LLM 只在 5 个决策点动态决策（选什么题 / 是否追问 / 怎么追问 / 是否加难度 / 下一步验证哪项能力）。
2. **不用 Agent 框架**（§37）：手写 **State Machine + LLM Calls + DB + Retriever**，不引入 LangChain/LangGraph/CrewAI。
3. **Knowledge Base 不是启动条件**（§5.1）：Day 1 空库也能跑，靠 Resume + JD + Company + LLM 参数知识。
4. **来源不可混淆**（§14）：`MODEL_GENERATED` 不得显示成 `REAL_INTERVIEW`。
5. **结构化输出 + 校验**：所有 LLM 结构化结果经 Zod 校验，失败重试后降级。

---

## 4. 目录结构（建议）

```
interview-app/
├── src/
│   ├── app/                        # Next.js App Router 页面
│   │   ├── page.tsx                # §32.1 Dashboard
│   │   ├── interview/
│   │   │   ├── new/                # §32.2 Create Interview
│   │   │   └── [id]/
│   │   │       ├── brief/          # §32.3 Preparation Brief
│   │   │       ├── session/        # §32.4 Interview Session
│   │   │       └── report/         # §32.5 Final Report
│   │   └── knowledge/              # §32.6 Knowledge / Interview Intelligence
│   │
│   ├── core/                       # 领域核心（纯 TS，与框架解耦，可单测）
│   │   ├── resume/                 # Resume Parser Skill
│   │   ├── jd/                     # JD Analyzer Skill
│   │   ├── profile/                # Candidate Profile（§26）
│   │   ├── gap/                    # Gap Analysis（§11）
│   │   ├── planner/                # Interview Planner（§18）
│   │   ├── retrieve/               # Retriever（§20）
│   │   ├── interview/              # Interviewer / Evaluator / Decision Engine（§23-25）
│   │   ├── state/                  # State Machine（§39）+ Candidate State（§26）
│   │   ├── knowledge/              # Knowledge Builder（§12）
│   │   ├── debrief/                # Interview Debrief Skill（§29）
│   │   └── report/                 # Final Report（§31）
│   │
│   ├── llm/                        # LlmProvider + EmbeddingProvider 抽象
│   ├── db/                         # Drizzle schema + migrations + sqlite 初始化
│   ├── server/                     # Route Handlers（对应 §35 API 草案）
│   └── lib/                        # 工具（文件解析、校验、id 生成等）
├── uploads/                        # 本地文件存储（.gitignore）
└── package.json
```

> `core/*` 的 9 个模块与 §38 的 9 个 Skill 一一对应，`llm/`、`db/`、`server/` 为基础设施。

---

## 5. 数据模型（§33 → Drizzle 表）

| 表 | 关键字段 | 说明 |
|---|---|---|
| `resumes` | id, file_url, raw_text, parsed_json, created_at | 简历；`parsed_json` 存 §9.2 的 Candidate Profile 结构 |
| `jobs` | id, company, role, jd_text, jd_analysis, created_at | 岗位；`jd_analysis` 存 Competency Model |
| `interview_items` | id, question, company, role, question_type, topics, difficulty, source_type, knowledge_points, evaluation_rubric, **embedding**, … | 题目；`embedding` 为 `vec0` 向量列 |
| `interview_sessions` | id, resume_id, job_id, mode, status, interview_plan, candidate_state, started_at, completed_at | 一次模拟面试会话 |
| `interview_turns` | id, session_id, turn_index, question_text, question_source_id, question_type, answer, evaluation, decision, is_follow_up, created_at | 单轮问答 |
| `real_interviews` | id, company, role, round, interview_date, raw_debrief, structured_questions, notes, created_at | 真实面试复盘记录 |
| `competency_rubrics` | id, competency, levels, key_points, evaluation_dimensions, updated_at | 能力 Rubric（§17） |

> Candidate State（§26）作为 `interview_sessions.candidate_state` 的 JSON 列存储，跨会话沉淀到长期画像。

---

## 6. 核心数据流与状态机

### 6.1 主流程（§47 闭环）

```text
Resume + JD + Company
      ↓  Resume Parser / JD Analyzer
Candidate Profile + Competency Model
      ↓  Gap Analysis
Match / Gap / Risks / Priority Topics
      ↓  Interview Planner
Interview Plan
      ↓  Retriever（元数据 + 语义）→ 未命中则 LLM 生成
Primary Question → 个性化 → ASK → Answer
      ↓  Evaluator → Candidate State → Decision Engine
Follow-up / Next / Finish
      ↓
Final Report（§31 六块）
```

### 6.2 状态机（§39，手写实现）

`INITIALIZING → ANALYZING_RESUME → ANALYZING_JD → BUILDING_PROFILE → PLANNING → READY → SELECTING_QUESTION → ASKING → WAITING_FOR_ANSWER → EVALUATING → UPDATING_STATE → DECIDING → (FOLLOW_UP | NEXT_QUESTION | FINISH) → REPORTING → COMPLETED`

用 TS `enum` + 转移函数实现，每次状态变更写入 `interview_sessions.status` 与 Candidate State，保证可追踪、可断点续跑。

---

## 7. 里程碑（14 项 P0 分组落地）

| 里程碑 | 交付内容 | 覆盖 P0 |
|---|---|---|
| **M1 基础设施** | 项目初始化；DB schema + 迁移；LlmProvider + EmbeddingProvider；文件上传与解析（PDF/DOCX/TXT） | 依赖基座 |
| **M2 分析链路** | Resume Parser → Candidate Profile；JD Analyzer → Competency Model；Gap Analysis | Resume Parse、JD Analysis、Candidate Profile、Competency Model、Gap Analysis |
| **M3 面试引擎** | Planner；Retriever（元数据 + sqlite-vec）；LLM 问题生成兜底；Interviewer（个性化）；Evaluator（结构化评分）；Decision Engine；Candidate State + 状态机；Interview Loop + 动态追问 | Planner、Retrieval、Generation、Loop、Follow-up、Evaluation、Candidate State |
| **M4 输出与沉淀** | Final Report；Text Debrief → 结构化 → 用户确认 → 存 Personal Real Interview History | Final Report、Text Debrief、Personal Real Interview History |
| **M5 页面与验收** | 6 个页面打通；Coaching + Mock 两种模式；localhost 端到端跑通 | 全量 P0 验收 |

---

## 8. V1 自测验收标准（对应 §44 简化）

1. 上传简历 + 粘贴 JD → 能生成 Candidate Profile、Competency Model、Gap Analysis、Interview Plan。
2. 空知识库也能完整跑完一场模拟面试（问题由 LLM 生成兜底）。
3. 回答后能触发结构化评分 + 动态追问（至少能出现 DEEP_DIVE 类追问）。
4. 同一简历多次面试后，下一次计划会因 Candidate State 更聚焦弱项。
5. 文字复盘能抽取结构化问题，经确认后写入真实面试历史，并在下一次检索时被优先命中。
6. 题目来源标注正确，`MODEL_GENERATED` 不被伪装成真实面经。

---

## 9. 决策确认记录（全部已确认，无阻塞项）

1. Embedding 来源 → **SiliconFlow `BAAI/bge-m3`**
2. 简历数量 → **单简历**
3. 面试模式 → **Coaching + Mock 都做**

---

## 10. 风险与备选

| 风险 | 应对 |
|---|---|
| DeepSeek JSON 输出偶发不合法 | Zod 校验 + 重试 + 关键节点降级为文本后正则解析 |
| `sqlite-vec` 原生扩展在 Node 加载失败 | 小规模下退回 JS 暴力余弦（§2.2 兜底） |
| PDF/DOCX 复杂排版解析失真 | 允许粘贴文本兜底（§2.6） |
| 评分漂移（§5.4） | 引入 Competency Rubric + 固定评价维度权重（§24） |
| 中文技术题向量检索质量 | 选用多语言 bge-m3；若效果差，退回元数据精确匹配优先 |

---

## 11. 下一步

1. 全部决策已确认（见 §9）。
2. 产出 `PRD-v1.md`（含功能需求、页面级交互、API 契约、验收标准）。
3. PRD 评审通过后，按 §7 里程碑进入开发。
