# 评测集与基线对比 —— 复现说明

## 这是什么

针对「AI 个性化模拟面试 Agent」的问题生成质量做四系统消融评测，证明「真实面经增强 + JD 个性化」的价值，并定位当前实现的退化问题。

## 前置条件

- Node.js ≥ 24（使用内置 `node:sqlite` 与全局 `fetch`）
- `interview-app/.env` 已配置 `DEEPSEEK_API_KEY`
- 已导入面经知识库（`data/interview.db` 的 `interview_items` 表非空）

## 运行

```bash
cd interview-app
node eval/run.mjs
```

一次运行约 4–6 分钟（96 次生成 + 24 次裁判，约 120 次 LLM 调用，费用几分钱）。

## 文件

| 文件 | 说明 |
|---|---|
| `cases.json` | 预注册评测案例：锚点公司、topic、公司专属 JD、优先要求 |
| `rubric.md` | 打分维度与 1–5 锚点 |
| `run.mjs` | 一键跑 C0/A/B_old/B_new 四系统 + LLM 裁判盲评 + 聚合 |
| `results.json` | 逐题明细（三系统题目 + 检索来源 + 裁判打分与评语） |
| `results.md` | 人类可读的结果摘要 |

## 四个系统

- **C0** 裸通用：无简历/JD/面经，仅一句泛化指令
- **A** 个性化无知识库：JD + 简历 → 产品兜底生成路径（`generateKnowledgeQuestion`）
- **B_old** 当前实现：检索面经 → 去锚点（无 JD 注入）
- **B_new** 修复方案：检索目标公司面经 → 保留考察点 + 结合 JD 业务语境改写

## 修改评测案例

编辑 `cases.json` 的 `anchors`：改 `companyAliases`（面经库里的公司名）、`topics`（须与知识库存储的 topic 字符串精确一致）、`jdText`（JD）即可。
