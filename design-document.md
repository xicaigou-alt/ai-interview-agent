# Personal AI Interview Agent — V1 Product Design Document

> 文件名：`design-document.md`  
> 版本：V1.0  
> 产品阶段：个人验证版 / 0→1 MVP  
> 产品定位：Personal AI Interview Preparation Agent  
> 核心原则：Personalized / Evidence-grounded / Adaptive / Memory-driven

---

# 1. 项目概述

## 1.1 背景

在准备实习或正式岗位面试时，求职者通常需要重复执行以下流程：

```text
收到面试邀请
↓
阅读 JD
↓
分析岗位要求
↓
搜索岗位面经
↓
搜索目标公司面经
↓
浏览小红书 / 牛客 / 知乎等平台
↓
保存截图 / 复制文字
↓
人工整理问题
↓
将 Resume + JD + 面经交给 GPT
↓
进行模拟面试
↓
真实面试结束后依赖记忆简单复盘
```

这一流程存在三个主要问题：

1. **准备成本高**：面经搜索、筛选、整理高度重复。
2. **模拟缺乏系统性**：直接与通用聊天模型对话时，问题覆盖、追问深度、难度和能力评估不稳定。
3. **经验无法沉淀**：真实面试结束后，被问过的问题、个人弱项和有效准备经验没有形成长期个人资产。

本项目 V1 计划构建一款：

> **能够持续学习个人求职经历的 AI 面试准备 Agent。**

用户只需提供简历、JD 和目标公司，系统即可完成岗位分析、候选人能力分析、模拟面试规划、问题检索与生成、动态追问、回答评估和最终复盘。

真实面试结束后，用户还可以通过文字或语音复盘，由 AI 自动提取实际面试问题并沉淀到个人 Interview Intelligence 中，使之后的模拟面试越来越个性化。

---

# 2. 一句话产品定义

> 根据“我是谁 + 我要面什么岗位 + 我要面什么公司 + 真实面试中问过什么 + 我过去表现如何”，自动制定并执行一套持续进化的个性化模拟面试。

---

# 3. V1 产品定位

V1 不做面向所有求职者的大型公共面经平台。

V1 首先服务：

> **单一用户——产品创建者本人。**

目标不是一开始解决数据规模问题，而是验证：

```text
Resume + JD + LLM
            ↓
      通用模拟面试
            +
真实面经 / 个人面试历史
            ↓
    是否能明显提升针对性
            +
动态追问 / Candidate State
            ↓
    是否能明显提升真实感
```

因此 V1 定位为：

> **Personal AI Interview Agent**

而不是：

- 公共题库产品
- 面经社区
- 招聘平台
- 企业 ATS
- 自动爬虫平台

---

# 4. V1 核心产品假设

## H1：Resume + JD 个性化有效

用户认为：

> 根据本人 Resume + JD 生成的问题，比通用“AI 产品经理面试题”更相关。

## H2：真实 Interview Evidence 有增量价值

当系统加入：

- 小红书面经
- 牛客面经
- 自己过去真实被问过的问题

后，用户认为模拟内容明显更贴近真实岗位和目标公司。

## H3：动态追问比固定题库更接近真实面试

系统能够根据回答：

```text
发现漏洞
↓
追问
↓
进一步验证
```

而不是机械执行固定问题列表。

## H4：持续记忆能够提升下一次模拟

系统记住：

- 已验证强项
- 持续弱项
- 真实被问过的问题
- 简历风险点
- 历史模拟表现

后，下一次 Interview Plan 更有针对性。

## H5：真实面试复盘形成个人数据飞轮

真实面试结束后进行快速复盘，可以提升之后的：

- 问题预测
- 面试重点判断
- Candidate State 准确度
- 个性化程度

---

# 5. V1 核心设计原则

## 5.1 Knowledge Base 不是产品启动条件

第一天即使知识库为空，系统也必须可以依赖：

```text
Resume
+
JD
+
Company
+
LLM Parametric Knowledge
```

完成正常模拟面试。

知识库的作用不是“教会 LLM 什么是 RAG / Agent / 产品经理”。

而是补充：

> **LLM 天然不知道、缺乏证据、或者需要长期记忆的信息。**

## 5.2 LLM 负责通用知识

LLM 原生负责：

- LLM 基础知识
- RAG
- Agent
- Prompt Engineering
- Evaluation
- 产品方法论
- 数据分析方法
- Behavioral Interview 方法
- 通用问题生成
- 动态追问
- 回答解释

V1 不需要为这些内容先搭建百科式知识库。

## 5.3 Interview Intelligence 负责稀缺信息

长期保存：

- 真实公司面经
- 真实岗位面经
- 用户本人真实面试历史
- 高价值 Interview Pattern
- 来源与可信度信息

其价值是：

> **Evidence，而不是通用知识。**

## 5.4 Rubric 负责评价稳定性

系统不需要为每一道题准备“标准答案”。

更应该为核心能力建立：

```text
Expected Key Points
Evaluation Rubric
Competency Level
```

用于减少 LLM 评分漂移。

## 5.5 Workflow First, Agent Inside

V1 不采用完全自主 Agent。

固定主流程：

```text
Parse
↓
Analyze
↓
Plan
↓
Retrieve / Generate
↓
Ask
↓
Evaluate
↓
Decide
↓
Update
```

Agent 只在关键位置动态决策：

- 选什么问题
- 是否追问
- 怎么追问
- 是否增加难度
- 下一步验证哪个能力

---

# 6. 产品整体架构

```text
┌───────────────────────────────────────┐
│            1. Context Layer           │
│                                       │
│ Resume / JD / Company / Role          │
│ Current Answers / Interview History   │
└──────────────────┬────────────────────┘
                   ↓
┌───────────────────────────────────────┐
│         2. Intelligence Layer         │
│                                       │
│ Candidate Profile                     │
│ Competency Model                      │
│ Gap Analysis                          │
│ Interview Intelligence                │
│ Knowledge Builder                     │
└──────────────────┬────────────────────┘
                   ↓
┌───────────────────────────────────────┐
│          3. Interview Engine          │
│                                       │
│ Planner                               │
│ Retriever                             │
│ Interviewer                           │
│ Evaluator                             │
│ Decision Engine                       │
└──────────────────┬────────────────────┘
                   ↓
┌───────────────────────────────────────┐
│            4. Memory Layer            │
│                                       │
│ Candidate State                       │
│ Mock Interview History                │
│ Real Interview History                │
│ Personal Interview Intelligence       │
└──────────────────┬────────────────────┘
                   │
                   └────→ 下一次 Interview
```

---

# 7. 四类核心信息源

最终 Interview Agent 不依赖单一知识库，而是同时使用四类信息。

## 7.1 LLM Parametric Knowledge

模型本身已经具备的通用知识。

例如：

```text
RAG 是什么
Agent 和 Workflow 的区别
AI 产品经理如何设计指标
产品需求分析方法
A/B Testing
```

用途：

- 生成通用问题
- 解释知识
- 动态追问
- 生成参考回答
- 辅助评价

## 7.2 Session Context

当前一次求职 / 模拟独有信息。

包括：

```text
Resume
JD
Company
Role
Candidate Profile
Competency Model
Gap Analysis
Current Interview Plan
Current Answer
Interview Turns
```

生命周期：

> 单次 Interview Session。

## 7.3 Personal Interview Intelligence

长期个人数据。

包括：

```text
导入的真实面经
用户本人真实面试问题
过去 Mock Interview 记录
常见弱项
简历风险
长期能力画像
```

生命周期：

> 跨 Session 长期存在。

## 7.4 Evaluation Rubrics

用于让评分更稳定。

例如：

```text
RAG Competency Rubric
Agent Competency Rubric
Product Design Rubric
Behavioral Rubric
Structured Communication Rubric
```

---

# 8. 用户核心流程

## 8.1 第一次使用

```text
Upload Resume
↓
Paste JD
↓
Input Company / Role
↓
Resume Analysis
↓
JD Analysis
↓
Gap Analysis
↓
Interview Plan
↓
LLM + 当前上下文生成 / 检索问题
↓
Mock Interview
↓
Final Report
```

注意：

> 第一次使用不要求提前拥有知识库。

## 8.2 导入外部面经

用户准备目标公司时，如果发现相关面经：

```text
小红书截图
牛客文字
复制文章内容
GPT生成题目
```

只需要：

```text
Paste
或
Upload
```

之后：

```text
Knowledge Builder
↓
Extract Questions
↓
Normalize
↓
Classify
↓
Deduplicate
↓
Source Label
↓
Save
```

下一次模拟自动使用。

## 8.3 真实面试后复盘

```text
Real Interview
↓
Text Debrief / Voice Debrief
↓
AI Structured Extraction
↓
User Confirmation
↓
Personal Real Interview History
↓
Update Personal Interview Intelligence
↓
影响下一次模拟
```

---

# 9. Resume Parser

## 9.1 输入

支持：

```text
PDF
DOCX
PNG
JPG
JPEG
Text
```

## 9.2 输出

```json
{
  "basic_info": {},
  "education": [],
  "experience": [],
  "projects": [],
  "skills": [],
  "ai_experience": [],
  "product_experience": [],
  "metrics": [],
  "strengths": [],
  "risk_points": [],
  "follow_up_points": []
}
```

## 9.3 重点：提取“可追问点”

Resume Parser 不只回答：

> 简历写了什么？

还要回答：

> 面试官可能从哪里追问？

例如：

```text
搭建基于 RAG 的 AI 简历评估系统，
提升 HR 初筛效率 40%
```

应提取：

```text
为什么使用 RAG？
为什么不用 Long Context？
知识库如何构建？
Chunk 如何切分？
Embedding 如何选择？
如何评价 Retrieval？
如何评价 Generation？
如何降低 Hallucination？
40% 是如何计算的？
你的个人贡献是什么？
```

---

# 10. JD Analyzer

## 10.1 目标

将 JD 转化为岗位能力模型：

> Competency Model

## 10.2 示例

AI Product Manager：

```text
Product
├── Requirement Analysis
├── Product Design
├── User Research
├── Metrics
└── Project Execution

AI
├── LLM
├── Prompt
├── RAG
├── Agent
├── Evaluation
└── AI UX

Technical
├── API
├── Data
├── Model
├── System Architecture
└── Engineering Trade-off

Business
├── Industry
├── Business Model
├── ROI
└── Competition

Behavioral
├── Communication
├── Collaboration
├── Ownership
└── Structured Thinking
```

---

# 11. Candidate × JD Gap Analysis

输入：

```text
Candidate Profile
+
Competency Model
```

输出：

```json
{
  "strong_match": [],
  "medium_match": [],
  "weak_match": [],
  "missing_capabilities": [],
  "resume_risks": [],
  "high_priority_topics": []
}
```

Example：

```text
Strong
- RAG 项目经验
- Prompt
- Product Design

Medium
- Agent

Weak
- Evaluation
- Data Analysis

Resume Risk
- “效率提升40%”缺乏测量说明
```

Gap Analysis 是 Interview Planner 的核心输入之一。

---

# 12. Knowledge Builder

Knowledge Builder 是 V1 的重要辅助能力。

它可以被理解为：

> **内部知识整理 Skill / 工具。**

它不是 Interview Agent 的核心执行链路，但负责降低知识库建设成本。

## 12.1 Knowledge Builder 的三个入口

### Generate Questions

输入：

```text
AI Product Manager
Topic: RAG
Difficulty: Medium
```

系统使用 LLM 生成候选问题并结构化。

### Import Text

用户粘贴：

```text
今天字节 AI PM 一面，
先让我自我介绍，
后来问为什么项目使用 RAG……
```

系统自动提取问题。

### Import Screenshot

用户上传：

```text
小红书截图
牛客截图
聊天记录图片
```

利用模型视觉能力理解文本并抽取问题。

## 12.2 Processing Pipeline

```text
Raw Input
↓
Content Understanding
↓
Question Extraction
↓
Question Normalization
↓
Classification
↓
Tagging
↓
Difficulty Estimation
↓
Deduplication
↓
Source Labeling
↓
Quality Scoring
↓
Save to Personal Interview Intelligence
```

---

# 13. Interview Intelligence 数据结构

不使用简单 Q&A Schema。

使用：

> Interview Item

示例：

```json
{
  "id": "q_001",
  "question": "为什么项目中使用 RAG？",
  "company": "ByteDance",
  "role": "AI Product Manager",
  "department": "",
  "stage": "First Round",
  "question_type": "RESUME_DEEP_DIVE",
  "topics": ["RAG"],
  "difficulty": "medium",
  "source_type": "REAL_INTERVIEW",
  "source_platform": "Nowcoder",
  "source_url": "",
  "date": "2026-08",
  "quality_score": 0.85,
  "confidence": 0.9,
  "knowledge_points": [
    "context limitation",
    "data freshness",
    "cost",
    "retrieval quality",
    "maintainability"
  ],
  "evaluation_rubric": [
    "是否解释业务背景",
    "是否比较替代方案",
    "是否解释选择依据",
    "是否讨论 trade-off"
  ]
}
```

---

# 14. Source Type

所有题目必须明确来源。

推荐：

```text
MODEL_GENERATED
REAL_INTERVIEW
PERSONAL_REAL_INTERVIEW
IMPORTED_INTERVIEW_EXPERIENCE
CURATED
```

系统不得把：

```text
MODEL_GENERATED
```

显示成：

```text
REAL_INTERVIEW
```

避免产生虚假的“某公司真实问过”暗示。

---

# 15. V1 是否需要手工准备 200～500 道题？

结论：

> **不需要。**

V1 不以“大规模人工题库”为启动条件。

推荐启动方式：

```text
Day 1
LLM 生成少量基础题

↓
开始模拟

↓
实际准备岗位过程中持续导入真实面经

↓
真实面试后持续沉淀个人问题

↓
知识库自然增长
```

可以从：

```text
30～80 道
```

开始。

题库规模不是产品质量的核心指标。

真正重要的是：

```text
问题相关性
真实 Interview Evidence
追问质量
个人历史
评价稳定性
```

---

# 16. 是否需要准备每道题的标准答案？

结论：

> **不需要。**

V1 使用三种答案策略。

## 16.1 Knowledge Questions

例如：

```text
Agent 和 Workflow 有什么区别？
什么是 LLM-as-a-Judge？
RAG 如何 Evaluation？
```

建议保存：

```text
Expected Key Points
+
Evaluation Rubric
```

而不是长篇标准答案。

## 16.2 Product / Case Questions

例如：

```text
设计一个 AI Search 产品。
```

不存在唯一正确答案。

保存：

```text
Evaluation Framework
```

例如：

```text
是否澄清目标
是否定义用户
是否识别需求
是否拆解场景
是否提出方案
是否排序优先级
是否定义指标
是否考虑风险
```

## 16.3 Resume / Behavioral Questions

答案必须来自用户本人经历。

系统只评估：

```text
真实性
结构
证据
个人贡献
量化程度
反思
表达
```

不能替用户编造个人经历。

---

# 17. Competency Rubric

相比给每一道题准备答案，V1 更适合给核心 Topic 建立复用 Rubric。

例如：

## RAG Competency

```text
Level 1
知道 RAG 基本定义

Level 2
理解基本 Pipeline

Level 3
理解 Retrieval / Generation Evaluation

Level 4
理解 Cost / Latency / Hallucination /
Long Context / Fine-tuning trade-off

Level 5
能够根据业务场景完成架构与产品决策
```

类似方式定义：

```text
Agent
LLM Evaluation
Prompt
Product Design
Data Analysis
Behavioral
Communication
```

---

# 18. Interview Planner

Planner 决定：

> **这场面试应该考什么，而不是具体每一道题是什么。**

## 18.1 输入

```text
Candidate Profile
JD Competency Model
Gap Analysis
Company
Role
Personal Interview Intelligence
Past Candidate State
Interview Mode
```

## 18.2 输出示例

```json
{
  "duration_minutes": 40,
  "primary_question_target": 10,
  "difficulty": "medium",
  "sections": [
    {
      "type": "RESUME_DEEP_DIVE",
      "weight": 0.30
    },
    {
      "type": "AI_KNOWLEDGE",
      "weight": 0.25
    },
    {
      "type": "PRODUCT_DESIGN",
      "weight": 0.20
    },
    {
      "type": "JD_GAP",
      "weight": 0.15
    },
    {
      "type": "BEHAVIORAL",
      "weight": 0.10
    }
  ],
  "priority_topics": [
    "RAG",
    "Agent",
    "Evaluation"
  ]
}
```

---

# 19. Question Source Strategy

每次需要一道 Primary Question 时，系统按照以下顺序处理。

```text
1. Personal Real Interview History
↓
2. Imported Real Interview Evidence
↓
3. Curated Interview Intelligence
↓
4. Relevant Generated Question Pool
↓
5. LLM Dynamic Generation
```

也就是说：

> 没有 KB 命中时，直接生成，而不是无法继续。

---

# 20. Retrieval Strategy

当存在 Interview Intelligence 时：

```text
Current Topic
+
Candidate Profile
+
JD
+
Company
+
Role
↓
Metadata Filter
↓
Semantic Search
↓
Rerank
↓
Deduplicate
↓
Question Candidate
```

## 20.1 Metadata

优先字段：

```text
company
role
question_type
topics
difficulty
stage
source_type
```

## 20.2 Retrieval Priority

```text
Exact Company + Exact Role
↓
Exact Company + Similar Role
↓
Similar Company + Same Role
↓
Similar JD
↓
Role General
```

---

# 21. Primary Question 与 Follow-up 的职责区别

这是 V1 的重要规则。

## Primary Question

优先：

```text
Interview Intelligence
+
Planner
```

保证：

- Coverage
- Evidence
- Quality
- 可解释来源

## Follow-up Question

优先：

```text
Current Question
+
User Answer
+
Evaluation Gap
+
Candidate State
+
LLM Reasoning
```

动态生成。

追问不需要强制从知识库召回。

---

# 22. Interview Engine

Interview Engine 由五个核心组件组成。

```text
Planner
Retriever
Interviewer
Evaluator
Decision Engine
```

---

# 23. Interviewer

职责：

- 将候选问题结合 Resume / JD 个性化
- 一次只问一个核心问题
- 保持真实面试官语气
- 不提前泄露答案
- 根据 Decision Engine 生成追问
- 不机械重复

## 23.1 个性化示例

知识库问题：

```text
为什么使用 RAG？
```

用户简历：

```text
搭建 RAG 简历评估 Agent
```

实际提问：

```text
你在简历评估项目里选择了 RAG。
为什么当时没有直接把完整简历和 JD
放入模型上下文，而是额外搭建 Retrieval 链路？
```

职责划分：

```text
KB → 提供题型 / Evidence

Resume / JD → 提供个性化 Context

LLM → 生成最终语言
```

---

# 24. Evaluator

每次回答后进行结构化评价。

推荐维度：

| Dimension | Weight |
|---|---:|
| 内容准确性 | 20 |
| 问题相关性 | 20 |
| 逻辑结构 | 20 |
| 案例与证据 | 15 |
| 思考深度 | 15 |
| 表达清晰度 | 10 |

## 24.1 Evaluator 输出

```json
{
  "score": 74,
  "strengths": [],
  "weaknesses": [],
  "missing_points": [],
  "resume_risks": [],
  "competency_updates": {},
  "follow_up_recommendation": ""
}
```

---

# 25. Decision Engine

根据评价决定：

```text
PASS
CLARIFY
DEEP_DIVE
CHALLENGE
COUNTERFACTUAL
TECHNICAL
DATA_VALIDATION
OWNERSHIP_CHECK
NEXT_QUESTION
FINISH
```

Example：

用户：

> RAG 可以减少 Token 消耗，而且知识库容易更新。

Evaluator：

```text
Basic Correctness: Good

Missing:
- retrieval quality
- architecture trade-off
- long context comparison
```

Decision：

```text
DEEP_DIVE
```

Interviewer：

```text
如果模型已经支持非常长的上下文，而且你的知识库规模不大，
你还会选择 RAG 吗？为什么？
```

---

# 26. Candidate State

Candidate State 是 Interview Agent 的工作记忆。

例如：

```json
{
  "competencies": {
    "RAG": {
      "score": 84,
      "verified": true
    },
    "Agent": {
      "score": 55,
      "verified": false
    },
    "Product Design": {
      "score": 72,
      "verified": true
    }
  },
  "verified_strengths": [],
  "weaknesses": [],
  "knowledge_gaps": [],
  "resume_risks": [],
  "communication_issues": [],
  "inconsistencies": [],
  "covered_topics": [],
  "remaining_topics": []
}
```

## 26.1 Candidate State 的作用

例如：

```text
RAG 已经连续验证 3 次且表现较好
```

则：

```text
降低继续问 RAG 的优先级
```

如果：

```text
Agent = weak + unverified
```

则：

```text
提高 Agent 相关问题优先级
```

这实现：

> Adaptive Interview。

---

# 27. Interview Loop

```text
Interview Plan
      ↓
Select Topic
      ↓
Retrieve / Generate Primary Question
      ↓
Personalize
      ↓
ASK
      ↓
User Answer
      ↓
Evaluate
      ↓
Update Candidate State
      ↓
Decision
   ↙        ↘
Follow-up    Next Topic
   ↓            ↓
ASK        Retrieve / Generate
```

直到完成：

```text
Primary Question Target
或
Time Limit
或
Planner 判断 Coverage 足够
```

---

# 28. 两种面试模式

## 28.1 Coaching Mode

目标：

> 学习和训练。

流程：

```text
Question
↓
Answer
↓
Evaluation
↓
Score
↓
Feedback
↓
Better Structure
↓
Reference Answer / Key Points
↓
Follow-up / Next
```

## 28.2 Mock Interview Mode

目标：

> 接近真实面试。

流程：

```text
Question
↓
Answer
↓
Follow-up
↓
Next Question
↓
...
↓
Interview End
↓
Final Report
```

中途：

```text
不展示评分
不展示标准答案
不提供教学提示
```

---

# 29. Interview Debrief Skill

真实面试结束后的复盘能力。

这是 V1 个人数据飞轮的重要组成部分。

## 29.1 V1 输入

优先支持：

```text
Text Debrief
```

V1.1 再增加：

```text
Voice Debrief
```

不优先支持：

```text
完整 45 分钟真实面试录音
```

## 29.2 流程

```text
用户输入：
“今天 DeepSeek AI PM 一面，
先自我介绍，然后问我 RAG……”
↓
Interview Debrief Skill
↓
Extract
↓
Structure
↓
User Confirmation
↓
Save
```

## 29.3 输出

```json
{
  "company": "DeepSeek",
  "role": "AI Product Manager",
  "round": "First Round",
  "date": "2026-08",
  "questions": [
    {
      "question": "为什么选择 RAG？",
      "type": "RESUME_DEEP_DIVE",
      "topics": ["RAG"]
    },
    {
      "question": "Agent 和 Workflow 有什么区别？",
      "type": "AI_KNOWLEDGE",
      "topics": ["Agent"]
    }
  ],
  "notes": ""
}
```

用户确认后：

```text
Save to Personal Real Interview History
```

---

# 30. 个人数据飞轮

```text
Prepare
↓
Mock Interview
↓
Real Interview
↓
Debrief
↓
Personal Interview Intelligence
↓
Better Interview Plan
↓
Better Mock Interview
```

长期：

```text
Use
↓
Learn
↓
Remember
↓
Adapt
↓
Use Better
```

---

# 31. Final Interview Report

结束后生成：

> Interview Readiness Report

## 31.1 Overall Score

```text
72 / 100
```

## 31.2 Competency Scores

```text
Product Thinking      82
AI Fundamentals       71
RAG                   84
Agent                 55
Evaluation            58
Data Analysis         61
Communication         81
```

## 31.3 Strengths

```text
- RAG 基础与项目经验较强
- 产品问题拆解完整
- 表达结构清晰
```

## 31.4 Risk Areas

```text
- Agent 理解停留在概念层
- Evaluation Framework 不完整
- 简历中效率提升数据缺少证据
```

## 31.5 Resume Risks

例如：

```text
Resume Claim:
“提升初筛效率40%”

Risk:
连续两次追问无法说明计算方法。

Recommendation:
补充 baseline、时间窗口、样本量和计算方式，
否则考虑修改简历表述。
```

## 31.6 Learning Plan

例如：

```text
Priority 1
Agent vs Workflow

Priority 2
RAG Evaluation

Priority 3
LLM-as-a-Judge

Priority 4
Data Metric Definition
```

---

# 32. 页面设计

V1 控制在 6 个主要页面。

## 32.1 Dashboard

展示：

```text
Current Resume
Past Mock Interviews
Real Interview History
Current Weaknesses
Personal Interview Intelligence
```

## 32.2 Create Interview

输入：

```text
Resume
JD
Company
Role
Mode
```

## 32.3 Preparation Brief

展示：

```text
Candidate Summary
JD Competency Model
Match / Gap
Resume Risks
Priority Topics
Interview Plan
Relevant Interview Evidence
```

按钮：

```text
Start Interview
```

## 32.4 Interview Session

```text
Progress
Current Question
Answer Input
```

Coaching Mode 下：

```text
Score
Feedback
Better Structure
Reference Key Points
```

## 32.5 Final Report

展示：

```text
Overall Readiness
Competency Scores
Strengths
Weaknesses
Resume Risks
Learning Plan
```

## 32.6 Knowledge / Interview Intelligence

三个入口：

```text
[Generate Questions]

[Import Text]

[Import Screenshot]
```

展示：

```text
Total Interview Items
Real Interview Evidence
Personal Real Interviews
Topics
Companies
```

---

# 33. 数据模型

核心实体：

```text
Resume
Job
InterviewItem
InterviewSession
InterviewTurn
CandidateState
RealInterview
CompetencyRubric
```

## 33.1 resumes

```text
id
file_url
raw_text
parsed_json
created_at
updated_at
```

## 33.2 jobs

```text
id
company
role
jd_text
jd_analysis
created_at
```

## 33.3 interview_items

```text
id
question
company
role
department
stage
question_type
topics
difficulty
source_type
source_platform
source_url
quality_score
confidence
knowledge_points
evaluation_rubric
embedding
created_at
```

## 33.4 interview_sessions

```text
id
resume_id
job_id
mode
status
interview_plan
candidate_state
started_at
completed_at
```

## 33.5 interview_turns

```text
id
session_id
turn_index
question_text
question_source_id
question_type
answer
evaluation
decision
is_follow_up
created_at
```

## 33.6 real_interviews

```text
id
company
role
round
interview_date
raw_debrief
structured_questions
notes
created_at
```

## 33.7 competency_rubrics

```text
id
competency
levels
key_points
evaluation_dimensions
updated_at
```

---

# 34. Vector Search

V1 推荐：

```text
PostgreSQL
+
pgvector
```

需要向量化：

```text
Interview Items
```

通常不需要把：

```text
Resume
JD
```

强制做成 RAG 文档。

Resume 与 JD 较短，优先：

```text
Parse → Structured JSON
```

直接作为 Interview Context。

---

# 35. API 草案

## Resume

```http
POST /api/resumes/upload
POST /api/resumes/:id/parse
GET  /api/resumes/:id
```

## Job

```http
POST /api/jobs/analyze
GET  /api/jobs/:id
```

## Knowledge Builder

```http
POST /api/knowledge/generate
POST /api/knowledge/import-text
POST /api/knowledge/import-image
GET  /api/knowledge/items
DELETE /api/knowledge/items/:id
```

## Interview

```http
POST /api/interviews
POST /api/interviews/:id/start
GET  /api/interviews/:id/current
POST /api/interviews/:id/answer
POST /api/interviews/:id/finish
GET  /api/interviews/:id/report
```

## Real Interview Debrief

```http
POST /api/real-interviews/parse
POST /api/real-interviews
GET  /api/real-interviews
```

---

# 36. 技术架构建议

## Frontend

```text
Next.js
React
Tailwind CSS
```

## Backend

为了 Vibe Coding，优先考虑：

```text
Next.js API
```

如果后续 AI Workflow 变复杂：

```text
FastAPI
```

可独立拆出。

## Database

```text
PostgreSQL
```

## Vector

```text
pgvector
```

## File Storage

```text
S3-compatible Object Storage
```

## LLM

需要具备：

- Structured Output
- Vision
- Strong reasoning
- Good instruction following

V1 设计应避免绑定单一厂商。

## Speech

V1 非必要。

V1.1：

```text
Speech-to-Text
```

用于 Interview Debrief。

---

# 37. V1 不需要使用复杂 Agent Framework

第一版不要求：

```text
LangChain
LangGraph
LlamaIndex
AutoGen
CrewAI
```

可以直接手写：

```text
State Machine
+
LLM Calls
+
Database
+
Retriever
```

这样：

- 更容易调试
- 更容易控制 Prompt
- 更容易追踪状态
- 更容易评估每一步
- 成本更透明

---

# 38. Prompt / Skill 划分

## Resume Parser Skill

```text
Input:
Resume

Output:
Candidate Profile
Risk Points
Follow-up Points
```

## JD Analyzer Skill

```text
Input:
JD

Output:
Competency Model
Priority Requirements
```

## Knowledge Builder Skill

```text
Input:
Generated / Text / Screenshot Content

Output:
Structured Interview Items
```

## Interview Planner

```text
Input:
Candidate + Job + Intelligence + History

Output:
Interview Plan
```

## Retriever

```text
Input:
Current Topic + Metadata

Output:
Candidate Questions
```

## Interviewer

```text
Input:
Selected Question + Session Context

Output:
Personalized Question / Follow-up
```

## Evaluator

```text
Input:
Question + Answer + Rubric

Output:
Structured Evaluation
```

## Decision Engine

```text
Input:
Evaluation + Candidate State

Output:
Follow-up / Next / Finish
```

## Interview Debrief Skill

```text
Input:
Real Interview Debrief

Output:
Structured Real Interview Record
```

---

# 39. State Machine

```text
INITIALIZING
↓
ANALYZING_RESUME
↓
ANALYZING_JD
↓
BUILDING_PROFILE
↓
PLANNING
↓
READY
↓
SELECTING_QUESTION
↓
ASKING
↓
WAITING_FOR_ANSWER
↓
EVALUATING
↓
UPDATING_STATE
↓
DECIDING
├── FOLLOW_UP
├── NEXT_QUESTION
└── FINISH
↓
REPORTING
↓
COMPLETED
```

---

# 40. V1 MVP Scope

必须完成：

```text
P0 Resume Upload + Parse
P0 JD Analysis
P0 Candidate Profile
P0 Competency Model
P0 Gap Analysis
P0 Interview Planner
P0 LLM Question Generation
P0 Interview Intelligence Retrieval
P0 Interview Loop
P0 Dynamic Follow-up
P0 Structured Evaluation
P0 Candidate State
P0 Final Report
P0 Text Interview Debrief
P0 Personal Real Interview History
```

---

# 41. P1

> 状态更新（V2，2026-08-24）：已落地项标注 ✅

| 项 | 状态 |
|---|---|
| Knowledge Builder - Import Image | ✅ **V2 已落地**：Qwen2.5-VL 视觉抽取（`/api/knowledge/import-image/parse` + 知识库页「🖼 导入截图」） |
| Generated Question Management | ⬜ 未开始（知识库页已有题目列表/删除，批量管理待做） |
| Competency Rubrics | 🔄 部分：`competency_rubrics` 表已建但未接入评价流程；V2 记忆显式化（competency_scores / weaknesses / resume_risk_points）已覆盖评分与弱项追踪职责 |
| Better Retrieval / Rerank | ⬜ 未开始（当前为暴力余弦 + 元数据过滤） |
| Question Source Visualization | ⬜ 未开始 |

---

# 42. P2

> 状态更新（V2，2026-08-24）：已落地项标注 ✅

| 项 | 状态 |
|---|---|
| Voice Debrief | ✅ **V2 已落地（半双工）**：SenseVoice STT 转写 + 现有 parse-debrief 管线（`/api/voice/transcribe` + 知识库页「🎤 语音复盘」） |
| Company Web Research | ⬜ 未开始（注意合规：已放弃自动爬取，改为手动文字/截图导入） |
| Automatic Interview Research Agent | ⬜ 未开始 |
| Public / Shared Interview KB | ⬜ 未开始（保留） |

---

# 43. V1 明确不做

```text
自动爬小红书
自动爬牛客
公共面经社区
多人知识贡献系统
完整真实面试录音分析
Speaker Diarization
视频面试
表情识别
实时语音打断
企业招聘端
完全自主 Agent
```

---

# 44. V1 Evaluation

由于 V1 为个人测试版，重点不看 DAU。

核心看以下指标。

## 44.1 Question Relevance

问题：

> 这道题是否与我的 Resume + JD 真正相关？

人工评分：

```text
1 - Completely irrelevant
2
3
4
5 - Highly relevant
```

## 44.2 Interview Evidence Value

对比：

```text
Resume + JD
```

和：

```text
Resume + JD + Real Interview Evidence
```

判断第二者是否明显更贴近目标岗位。

## 44.3 Follow-up Quality

评估：

```text
是否抓住回答漏洞
是否重复
是否具有真实面试感
是否能进一步验证能力
```

## 44.4 Weakness Discovery

问题：

> Final Report 是否发现了我之前没有意识到的弱点？

## 44.5 Real Interview Topic Hit Rate

模拟前预测：

```text
RAG
Agent
Evaluation
Product Design
```

真实面试：

```text
RAG ✓
Agent ✓
Evaluation ✗
Product Design ✓
```

可计算：

```text
Topic Recall
Question Pattern Hit Rate
```

## 44.6 Candidate State Usefulness

判断：

> 下一次面试计划是否因为历史状态而明显更有针对性？

---

# 45. 数据增长策略

V1 不追求一次建成大规模题库。

推荐：

```text
初始
30～80 个 Generated / Curated Items

↓

准备真实岗位时
持续 Import Interview Experiences

↓

真实面试之后
持续 Debrief

↓

Personal Interview Intelligence 自然增长
```

真正的数据资产：

```text
Real Interview Evidence
+
Personal Real Interviews
+
Historical Performance
```

而不是单纯“题目数量”。

---

# 46. Future Research Agent

V1 暂时不实现，但未来可以增加：

```text
Company + Role
↓
Query Expansion
↓
Web Search
↓
Result Ranking
↓
Content Extraction
↓
Interview Question Extraction
↓
Source Confidence
↓
Session Interview Intelligence
```

执行逻辑：

```text
Local Personal Intelligence
↓ 不足
Related Intelligence
↓ 不足
Web Research
```

这样以后可以自动替代：

> 用户自己去多个平台搜面经。

---

# 47. 最终核心闭环

```text
Understand Me
↓
Understand the Job
↓
Plan What to Test
↓
Use Evidence When Available
↓
Generate When Evidence Is Missing
↓
Interview Me
↓
Challenge My Answers
↓
Evaluate Me
↓
Remember My Weaknesses
↓
Learn from My Real Interview
↓
Interview Me Better Next Time
```

---

# 48. 最终产品定义

> **Personal AI Interview Agent 是一款能够持续学习个人求职经历的 AI 面试准备系统。用户上传 Resume、JD 和目标公司后，系统分析候选人与岗位的能力匹配关系，并结合 LLM 通用知识、真实面试 Evidence 与个人历史制定动态 Interview Plan。系统通过问题检索或生成、多轮追问、结构化评估和 Candidate State 持续验证用户能力；真实面试结束后，用户可通过文字或语音快速复盘，由 AI 自动提取问题并沉淀为 Personal Interview Intelligence，使后续模拟面试持续变得更加个性化和准确。**

---

# 49. V1 的产品边界总结

V1 不是：

```text
一个存了500道题的题库
```

也不是：

```text
一个把 Resume + JD 塞给 GPT 的聊天页面
```

更不是：

```text
自动爬遍互联网的面经搜索器
```

V1 是：

```text
Resume / JD Context
+
LLM General Knowledge
+
Personal Interview Intelligence
+
Evaluation Rubrics
+
Interview State
↓
Adaptive Interview Engine
↓
Personal Memory
↓
Continuous Improvement
```

核心技术思想：

> **知识库不是启动条件，而是增强层。**

核心产品思想：

> **Agent 第一天就能工作，之后通过真实面经和真实面试经历逐渐变成“更懂我的面试官”。**

---

# 50. V2 落地记录（2026-08-24）

V2 目标：从「被动陪练工具」升级为「个人专属 Agent」。完整变更见根目录 `CHANGELOG.md`。

## 50.1 已实现

### A. 记忆显式化（让 Agent 真正“懂你”）
- 新增三张可查询的长期记忆表：`competency_scores`（能力成长曲线）、`weaknesses`（持续弱项，hit_count 累加）、`resume_risk_points`（简历风险点）。
- 引擎 `handleAnswer` 每次评价后调用 `recordTurnMemory` 自动写入；替代原先 `candidate_state` JSON 黑盒的查询盲区。
- 查询接口：`getCompetencyTrend` / `getCompetencyAverages` / `listWeaknesses` / `listResumeRisks`。

### B. 工程地基
- 单元测试 24 项（Node 24 内置 `node:test`，零新依赖），`pnpm test` 可跑。
- 为可测性抽取纯逻辑模块：`decision-rules`（追问上限兜底）、`cosine`、`difficulty`、`plan-practice`。

### C. 难度自适应（补上 §5.5 决策点）
- `adjustDifficulty`：主问题得分 ≥80 升一档、≤55 降一档，其余保持（滞回区间防震荡）。
- 难度存于 `CandidateState.difficulty`，随会话持久化；追问不计入，避免噪声。

### D. 面试日程 + 每日练习计划
- `interview_schedule` 表 + `/api/schedule` 增删查。
- 首页新增：面试日程录入/删除、「明天有面试」提醒横幅（打开 app 即检查）、基于记忆表的「今日练习计划」。

### E. 半双工语音复盘（P2「Voice Debrief」落地）
- SiliconFlow SenseVoice 转写（`src/llm/asr.ts` + `/api/voice/transcribe`），知识库页录音后自动填入复盘文本，复用 parse-debrief 管线。

### F. 图片导入面经（P1「Import Image」落地）
- SiliconFlow Qwen2.5-VL 视觉抽取（`src/llm/vision.ts` + `/api/knowledge/import-image/parse`），复用文本导入的确认/保存管线。

### G. 面试前一天提醒（新增，方案 A）
- 零依赖独立服务 `server/reminder.mjs`：`/sync` 接收日程 + 每小时检查「明天有面试」+ PushPlus 微信推送。
- 本地 `src/lib/reminder-sync.ts` 在增删日程时自动上报；**仅日程上云，简历/题库/复盘留本地**。

## 50.2 验证

- `pnpm typecheck` ✅；`pnpm test` 24/24 ✅；提醒服务端到端冒烟测试（/health、/sync、中文 UTF-8）✅。
- ⚠️ `pnpm build` 未能在开发沙箱运行（沙箱禁止子进程），需在本机验证。

## 50.3 遗留与注意

- `competency_rubrics` 表仍未接入评价流程（当前由题目自带 rubric + V2 记忆表覆盖）。
- 语音/视觉链路需真实 SiliconFlow key 在本机实测（沙箱无法出网）。
- 提醒服务部署步骤见 `interview-app/server/README.md`。
