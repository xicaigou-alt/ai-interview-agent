
# Personal AI Interview Agent — V1 PRD

> 版本：V1.0
> 状态：待评审（评审通过后进入开发）
> 上游文档：`design-document.md`（产品设计）、`PLAN-v1.md`（技术方案）
> 读者：开发（单人）

---

## 1. 产品概述

一句话：**根据「我是谁 + 我面什么岗位 + 我面什么公司 + 真实面试问过什么 + 我过去表现如何」，自动制定并执行一套持续进化的个性化模拟面试。**

V1 是**个人验证版（单用户）**，目标是验证 design-document 的 5 个假设（H1–H5）中最核心的闭环：Resume+JD 个性化、真实面经增量价值、动态追问真实感、持续记忆提升针对性、复盘形成数据飞轮。

**形态**：本地 localhost 独立 Web 应用。

---

## 2. 范围界定

### 2.1 In Scope（V1 必做 = 14 项 P0）

| # | P0 功能 | 对应 FR |
|---|---|---|
| 1 | Resume Upload + Parse | FR-1 |
| 2 | JD Analysis | FR-2 |
| 3 | Candidate Profile | FR-1 / FR-3 |
| 4 | Competency Model | FR-2 |
| 5 | Gap Analysis | FR-3 |
| 6 | Interview Planner | FR-4 |
| 7 | LLM Question Generation | FR-5 |
| 8 | Interview Intelligence Retrieval | FR-5 |
| 9 | Interview Loop | FR-6 |
| 10 | Dynamic Follow-up | FR-7 |
| 11 | Structured Evaluation | FR-8 |
| 12 | Candidate State | FR-9 |
| 13 | Final Report | FR-10 |
| 14 | Text Interview Debrief + Personal Real Interview History | FR-11 / FR-12 |

**附加范围**：
- 两种面试模式：**Coaching Mode + Mock Interview Mode**。
- 知识库两入口：**Generate Questions + Import Text**（Import Screenshot 后移 P1）。
- 简历：**单份**。

### 2.2 Out of Scope（V1 明确不做）

```text
图片/截图导入（Import Screenshot）        → P1
语音复盘（Voice Debrief）                 → 不做，改为文字复盘（用户上传真实面试中被问到的问题的文字版本）
自动爬取面经 / Web Research Agent          → P2
公共面经社区 / 多人知识贡献               → 不做
完整真实面试录音分析 / 说话人分离 / 视频面试 / 表情识别 / 实时语音打断 → 不做
企业招聘端 / ATS                          → 不做
完全自主 Agent / LangChain / LangGraph / CrewAI 框架 → 不做（手写状态机）
```

---

## 3. 术语表

| 术语 | 定义 |
|---|---|
| Candidate Profile | 简历结构化解析结果（含强项、风险点、可追问点） |
| Competency Model | 由 JD 转化而来的岗位能力模型（分 Product/AI/Technical/Business/Behavioral 五类） |
| Gap Analysis | 候选人能力 vs 岗位能力模型的匹配/差距分析 |
| Interview Plan | 一场面试的「考什么」（章节权重、优先级 topic、时长、题数） |
| Interview Item | 知识库中的一道题（含来源、难度、topic、rubric、向量） |
| Primary Question | 由 Planner + 知识库/生成决定的主问题，保证覆盖与证据 |
| Follow-up Question | 针对当前回答动态生成的追问，不强制走知识库 |
| Candidate State | 面试过程中的工作记忆（各能力分数/验证状态/已覆盖/待覆盖） |
| Rubric | 能力评价标准（层级 + 关键点 + 评价维度），用于稳定评分 |
| source_type | 题目来源枚举：MODEL_GENERATED / REAL_INTERVIEW / PERSONAL_REAL_INTERVIEW / IMPORTED_INTERVIEW_EXPERIENCE / CURATED |
| Coaching Mode | 边练边学，实时展示评分与反馈 |
| Mock Mode | 贴近真实面试，中途不展示评分/答案 |

---

## 4. 用户与核心场景

单用户（产品创建者本人）。三条主流程：

### 4.1 第一次使用
`上传/粘贴简历 → 粘贴 JD + 公司/岗位 → 生成分析 → 开始模拟 → 结束看报告`

### 4.2 导入外部面经
`粘贴/上传面经文本 → 抽取/归一化/分类/标注来源 → 存入知识库 → 下次模拟自动使用`

### 4.3 真实面试后复盘
`输入文字复盘 → AI 结构化抽取 → 用户确认 → 存入个人真实面试历史 → 影响下次模拟`

---

## 5. 功能需求（FR）

> 每个 FR 给出：描述 / 输入 / 处理逻辑 / 输出 / 验收标准。

### FR-1 简历输入与解析（Resume Parser）

- **描述**：用户粘贴文本，或上传 PDF/DOCX，系统解析为结构化 Candidate Profile，并重点提取「可追问点」。
- **输入**：纯文本/Markdown；或 PDF、DOCX 文件（≤ 一定大小，V1 建议 5MB）。
- **处理**：
  1. 文件型输入先抽取纯文本（PDF：`pdf-parse`；DOCX：`mammoth`）。
  2. 调用 LLM（JSON Output 模式）解析，Zod 校验失败则重试 1 次，再失败降级为原文保存并提示。
- **输出**（§9.2 结构）：
  ```json
  {
    "basic_info": {}, "education": [], "experience": [],
    "projects": [], "skills": [], "ai_experience": [],
    "product_experience": [], "metrics": [],
    "strengths": [], "risk_points": [], "follow_up_points": []
  }
  ```
- **验收**：能对「搭建 RAG 简历评估系统，提升初筛效率 40%」这类描述，产出 `follow_up_points`（如：为什么 RAG / 40% 如何计算 / 个人贡献）。
- **备注**：单简历；重新上传即覆盖当前简历。

### FR-2 岗位与 任职要求分析（JD Analyzer）

- **描述**：将 JD 转化为 Competency Model。
- **输入**：公司名、岗位名、JD 文本。
- **处理**：LLM 生成 §10.2 的五类层级能力模型（Product/AI/Technical/Business/Behavioral），每类下列具体能力点。
- **输出**：Competency Model JSON（分类 + 能力点列表 + 优先级要求）。
- **验收**：输出包含五类分类；能从 JD 措辞推断能力点（而非泛化模板）。

### FR-3 候选人画像与差距分析（Gap Analysis）

- **描述**：对比 Candidate Profile 与 Competency Model，输出差距与优先级。
- **输入**：Candidate Profile + Competency Model。
- **处理**：LLM 对比打分并归类。
- **输出**（§11 结构）：
  ```json
  {
    "strong_match": [], "medium_match": [], "weak_match": [],
    "missing_capabilities": [], "resume_risks": [], "high_priority_topics": []
  }
  ```
- **验收**：能识别「简历 40% 无证据」类 resume_risk；`high_priority_topics` 与 weak/missing 一致。

### FR-4 面试规划（Interview Planner）

- **描述**：决定「这场面试考什么」，而非具体题目。
- **输入**：Candidate Profile、Competency Model、Gap Analysis、公司/岗位、知识库统计、历史 Candidate State、面试模式。
- **处理**：LLM 生成计划；若存在历史 Candidate State，弱项升权、已验证强项降权（§26.1）。
- **输出**（§18.2 结构）：`duration_minutes / primary_question_target / difficulty / sections[]（type+weight）/ priority_topics[]`。
- **验收**：sections 权重和为 1；priority_topics 与 Gap Analysis 强相关；带历史状态时计划明显更聚焦弱项。

### FR-5 问题检索与生成（Retriever + Source Strategy）

- **描述**：为每个 Primary Question 提供来源，无知识库命中时 LLM 生成兜底。
- **输入**：当前 topic、候选元数据（company/role/question_type/difficulty）、Resume/JD 上下文。
- **处理**（§19 优先级）：
  1. Personal Real Interview History
  2. Imported Real Interview Evidence
  3. Curated Interview Intelligence
  4. Relevant Generated Question Pool
  5. LLM Dynamic Generation
  - 检索：元数据过滤 → sqlite-vec 语义搜索 → 去重（§20）。
- **输出**：候选问题 + `source_type` 标注。
- **验收**：空知识库可完整生成并继续；有命中时优先用命中；`MODEL_GENERATED` 绝不标注为 `REAL_INTERVIEW`。

### FR-6 面试执行引擎（Interviewer + Loop + 两种模式）

- **描述**：手写状态机（§39）驱动，一次一问，个性化提问，两种模式差异化。
- **输入**：Interview Plan、选定问题、会话上下文。
- **处理**：
  1. Interviewer 将知识库问题结合 Resume/JD 个性化（§23.1 示例）。
  2. 一次只问一个核心问题，不泄露答案、不机械重复。
  3. 按模式决定是否展示中间结果：Coaching 展示评分/反馈/参考；Mock 全程不展示评分与答案，结束后统一出报告。
- **输出**：每轮问题 + 用户答案流转；会话状态持久化。
- **验收**：状态机按 §39 顺序流转并可断点续跑；一次一问；问题明显带简历个性化。

### FR-7 动态追问（Decision Engine）

- **描述**：根据评价决定 PASS / CLARIFY / DEEP_DIVE / CHALLENGE / COUNTERFACTUAL / TECHNICAL / DATA_VALIDATION / OWNERSHIP_CHECK / NEXT_QUESTION / FINISH。
- **输入**：当前问题 + 用户回答 + Evaluator 结果 + Candidate State。
- **处理**：LLM 依据评价缺口（missing_points / 回答漏洞）决策；追问由 LLM 动态生成，不强制走知识库（§21）。
- **输出**：`decision` + 追问文本（或 Next/Finish 信号）。
- **验收**：能复现 §25 示例——回答只提「省 token、易更新」时触发 DEEP_DIVE 并追问「长上下文下是否还用 RAG」。

### FR-8 结构化评估（Evaluator）

- **描述**：每次回答后结构化评分。
- **输入**：问题 + 回答 + 相关 Rubric。
- **处理**：按 §24 六维度加权评分（内容准确性20/问题相关性20/逻辑结构20/案例证据15/思考深度15/表达清晰度10）。
- **输出**（§24.1）：
  ```json
  { "score": 74, "strengths": [], "weaknesses": [],
    "missing_points": [], "resume_risks": [],
    "competency_updates": {}, "follow_up_recommendation": "" }
  ```
- **验收**：score 为 0–100；missing_points 能驱动 FR-7 的追问决策。

### FR-9 候选人状态（Candidate State）

- **描述**：面试过程的工作记忆，每轮更新，并影响后续选题。
- **输入**：Evaluator 结果 + 当前状态。
- **处理**：更新各 competency 的 score/verified、strengths、weaknesses、knowledge_gaps、resume_risks、covered_topics、remaining_topics（§26 结构）。
- **输出**：更新后的 Candidate State（随会话持久化）。
- **验收**：RAG 连续验证 3 次后降低其选题优先级；Agent=weak+unverified 时提高优先级。

### FR-10 最终报告（Final Report）

- **描述**：面试结束后生成 Interview Readiness Report。
- **输入**：会话全部 turns + 最终 Candidate State + 计划。
- **处理**：LLM 汇总生成六块内容。
- **输出**（§31）：Overall Score、Competency Scores、Strengths、Risk Areas、Resume Risks（含 Recommendation）、Learning Plan（按优先级）。
- **验收**：六块齐全；Resume Risk 给出可执行建议（如补充 baseline/时间窗口/样本量）。

### FR-11 知识库 / 面经管理（Knowledge Builder + Interview Intelligence）

- **描述**：降低知识库建设成本，V1 提供两个入口。
- **入口 A — Generate Questions**：输入「岗位 + Topic + 难度」，LLM 生成候选问题并结构化入库（source_type=MODEL_GENERATED）。
- **入口 B — Import Text**：粘贴面经文本（如牛客/分享帖），按 §12.2 管线处理：理解 → 抽取问题 → 归一化 → 分类 → 打标 → 难度估计 → 去重 → 来源标注 → 质量评分 → 入库。
- **输出**：Interview Items（§13 结构），含 embedding 向量。
- **验收**：粘贴「今天字节 AI PM 一面……为什么项目用 RAG……」能抽取「为什么项目用 RAG」并结构化；来源标注正确。

### FR-12 真实面试复盘（Interview Debrief）

- **描述**：真实面试后文字复盘，形成个人数据飞轮。
- **输入**：文字复盘（V1 仅文字，§29.1）。
- **处理**：LLM Extract → Structure → **用户确认** → Save。
- **输出**（§29.3）：
  ```json
  { "company": "DeepSeek", "role": "AI Product Manager", "round": "First Round",
    "date": "2026-08", "questions": [ {"question": "...", "type": "...", "topics": []} ], "notes": "" }
  ```
- **验收**：抽取结构化问题；用户确认后才写入 `real_interviews`；下次模拟检索时 PERSONAL_REAL_INTERVIEW 优先命中。

---

## 6. 页面级需求（§32）

### 6.1 Dashboard
- 展示：当前简历摘要、历史模拟面试列表、真实面试历史、当前弱项（来自历史 Candidate State）、知识库统计（总题数/真实面经数/个人真实面试数/覆盖 topic/公司）。
- 快捷入口：新建面试、导入面经、复盘。

### 6.2 Create Interview
- 表单：简历（粘贴文本框 + 文件上传）、JD（粘贴）、公司、岗位、模式（Coaching/Mock）。
- 提交后进入分析流程（loading 状态展示进度），完成跳转 Preparation Brief。

### 6.3 Preparation Brief
- 展示：Candidate Summary、JD Competency Model、Match/Gap、Resume Risks、Priority Topics、Interview Plan、Relevant Interview Evidence（命中面经，标注来源）。
- 按钮：`Start Interview`。

### 6.4 Interview Session
- 展示：进度（题数/目标）、当前问题、答案输入框。
- Coaching：提交后显示 Score、Feedback、Better Structure、Reference Key Points，再进入追问/下一题。
- Mock：仅「问题 → 回答 → 追问/下一题」，不显示任何评分与答案。

### 6.5 Final Report
- 展示 §31 六块：Overall Readiness、Competency Scores、Strengths、Risk Areas、Resume Risks、Learning Plan。

### 6.6 Knowledge / Interview Intelligence
- 三入口：`[Generate Questions]` `[Import Text]` `[Import Screenshot]（置灰，标注 P1）`。
- 展示：Total Interview Items、Real Interview Evidence、Personal Real Interviews、Topics、Companies 统计。

---

## 7. API 契约（§35 细化）

### 7.1 Resume
| Method | Path | 说明 | 主要请求/响应 |
|---|---|---|---|
| POST | `/api/resumes` | 上传/保存简历 | body: `{ raw_text? , file? }` → `{ id, parsed_json }` |
| POST | `/api/resumes/:id/parse` | 触发解析 | → `{ id, parsed_json }` |
| GET | `/api/resumes/current` | 获取当前简历 | → `{ id, raw_text, parsed_json }` |

### 7.2 Job
| Method | Path | 说明 |
|---|---|---|
| POST | `/api/jobs/analyze` | body: `{ company, role, jd_text }` → `{ id, jd_analysis }` |
| GET | `/api/jobs/:id` | → 岗位 + Competency Model |

### 7.3 Interview
| Method | Path | 说明 |
|---|---|---|
| POST | `/api/interviews` | 创建会话（resume_id, job_id, mode）→ `{ id }` |
| POST | `/api/interviews/:id/analyze` | 生成 Profile/Gap/Plan → Preparation Brief 数据 |
| POST | `/api/interviews/:id/start` | 进入面试，返回第一题 |
| GET | `/api/interviews/:id/current` | 当前状态与当前问题 |
| POST | `/api/interviews/:id/answer` | body: `{ answer }` → 评价（Coaching 含评分）/ 追问或下一题 |
| POST | `/api/interviews/:id/finish` | 结束并生成报告 |
| GET | `/api/interviews/:id/report` | → Final Report |

### 7.4 Knowledge Builder
| Method | Path | 说明 |
|---|---|---|
| POST | `/api/knowledge/generate` | body: `{ role, topic, difficulty }` → 生成题目入库 |
| POST | `/api/knowledge/import-text` | body: `{ text }` → 抽取并入库 |
| GET | `/api/knowledge/items` | 分页 + 过滤（source_type/topic/company） |
| DELETE | `/api/knowledge/items/:id` | 删除题目 |

### 7.5 Real Interview Debrief
| Method | Path | 说明 |
|---|---|---|
| POST | `/api/real-interviews/parse` | body: `{ debrief_text }` → 结构化草稿（待确认） |
| POST | `/api/real-interviews` | body: `{ ...确认后的结构化数据 }` → 入库 |
| GET | `/api/real-interviews` | 列表 |

> 所有 LLM 相关响应对应的结构化结果均经 Zod 校验；失败返回 `{ error, code }` 并可在前端重试。

---

## 8. 数据模型（字段级）

> 与 `PLAN-v1.md` §5 一致，此处补类型与约束。

- **resumes**：`id`(pk), `file_url`(nullable), `raw_text`(text), `parsed_json`(json), `created_at`, `updated_at`
- **jobs**：`id`(pk), `company`, `role`, `jd_text`, `jd_analysis`(json), `created_at`
- **interview_items**：`id`(pk), `question`, `company`, `role`, `department`, `stage`, `question_type`, `topics`(json), `difficulty`, `source_type`, `source_platform`, `source_url`, `quality_score`(real), `confidence`(real), `knowledge_points`(json), `evaluation_rubric`(json), `embedding`(vec), `created_at`
- **interview_sessions**：`id`(pk), `resume_id`(fk), `job_id`(fk), `mode`, `status`(enum, 对应状态机), `interview_plan`(json), `candidate_state`(json), `started_at`, `completed_at`
- **interview_turns**：`id`(pk), `session_id`(fk), `turn_index`, `question_text`, `question_source_id`(fk→interview_items, nullable), `question_type`, `answer`, `evaluation`(json), `decision`, `is_follow_up`(bool), `created_at`
- **real_interviews**：`id`(pk), `company`, `role`, `round`, `interview_date`, `raw_debrief`(text), `structured_questions`(json), `notes`, `created_at`
- **competency_rubrics**：`id`(pk), `competency`, `levels`(json), `key_points`(json), `evaluation_dimensions`(json), `updated_at`

---

## 9. 非功能需求

1. **结构化输出稳定性**：所有 LLM 结构化结果经 Zod 校验，失败重试 1 次后降级（关键节点降级为文本 + 正则解析）。
2. **来源诚实性**：`MODEL_GENERATED` 绝不以任何形式显示为真实面经（§14）。
3. **状态可追踪**：面试状态机每步落库，支持断点续跑与调试。
4. **本地数据安全**：API Key 仅存环境变量（`.env`），不进库、不进前端；简历/面经存本地 SQLite + 文件系统。
5. **性能**（本地单用户，非硬性）：单轮「评估 + 追问」理想 < 15s（取决于模型），前端需有 loading 与流式/分段反馈。
6. **可移植**：LLM 与 Embedding 均走 provider 接口，未来可换厂商。

---

## 10. V1 验收标准（自测清单）

1. 上传/粘贴简历 + JD → 生成 Candidate Profile、Competency Model、Gap Analysis、Interview Plan。
2. 空知识库能完整跑完一场模拟面试（LLM 生成兜底）。
3. 回答后触发结构化评分 + 动态追问（至少出现 DEEP_DIVE）。
4. 同一简历多次面试后，下一次计划因 Candidate State 更聚焦弱项。
5. 文字复盘 → 结构化抽取 → 确认 → 入库，且下次检索 PERSONAL_REAL_INTERVIEW 优先命中。
6. 来源标注正确，无 MODEL_GENERATED 伪装。
7. Coaching 与 Mock 行为差异正确（Mock 中途无评分/答案）。
8. 导入文本面经能抽取并结构化入库。
9. 六个页面均可用，localhost 端到端跑通。

---

## 11. 里程碑与交付顺序

> 与 `PLAN-v1.md` §7 一致。

| 里程碑 | 交付 | 对应 FR |
|---|---|---|
| M1 基础设施 | 项目初始化、DB schema、LLM/Embedding provider、文件上传解析 | 基座 |
| M2 分析链路 | FR-1、FR-2、FR-3 | Resume/JD/Profile/Gap |
| M3 面试引擎 | FR-4、FR-5、FR-6、FR-7、FR-8、FR-9 | Planner→Loop→Evaluate |
| M4 输出与沉淀 | FR-10、FR-11、FR-12 | Report/Knowledge/Debrief |
| M5 页面与验收 | §6 六页面 + §10 验收 | 全量 |

---

## 12. 依赖与配置

| 依赖 | 用途 | 备注 |
|---|---|---|
| DeepSeek API Key | LLM（deepseek-chat / deepseek-reasoner） | 环境变量 `DEEPSEEK_API_KEY` |
| SiliconFlow API Key | Embedding（BAAI/bge-m3） | 环境变量 `SILICONFLOW_API_KEY` |
| Node.js ≥ 18 / pnpm | 运行环境 | — |
| 本地文件目录 `uploads/` | 简历/附件存储 | `.gitignore` |

---

## 13. 开放问题与风险

> 风险与应对见 `PLAN-v1.md` §10。此处仅列 PRD 级注意事项：

1. **Embedding 费用/额度**：SiliconFlow 有免费额度，V1 规模（30–80 题起）足够；超出后需评估。
2. **DeepSeek reasoner 是否纳入 V1**：默认主链路用 `deepseek-chat`；`deepseek-reasoner` 仅作为 Evaluator/Decision 的可用开关，V1 不强制。
3. **Import Screenshot（视觉）**：V1 不做，但 FR-11 的管线已为图片输入预留位置，P1 接入时用 DeepSeek 视觉能力或换多模态模型即可。

---

## 14. 评审要点

请评审时重点确认：
1. 12 个 FR 是否完整覆盖 14 项 P0，有无遗漏交互。
2. 页面 §6 与 FR 的映射是否一致。
3. API §7 是否满足前端交互（尤其 `answer` 接口如何在两种模式下差异化返回）。
4. 验收标准 §10 是否可作为「做完」的判据。
