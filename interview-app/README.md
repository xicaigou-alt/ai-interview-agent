# Personal AI Interview Agent — V1

个人专属 AI 模拟面试（V1，本地单用户 Web 应用）。

## 环境要求

- Node.js ≥ 23.4（需要内置 `node:sqlite`；你当前 24.16 已满足）
- pnpm（或 npm）
- 两个 API Key：
  - DeepSeek（LLM）：https://platform.deepseek.com
  - SiliconFlow（Embedding，BAAI/bge-m3）：https://siliconflow.cn

## 首次启动

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY 与 SILICONFLOW_API_KEY

# 3. 启动开发服务器
pnpm dev
```

打开 http://localhost:3000 ，首页会显示 M1 健康检查结果：
- `db: ok` 表示 SQLite 已就绪（数据库文件在 `./data/interview.db`）
- LLM / Embedding 显示对应 key 是否已配置

## 常用命令

```bash
pnpm dev         # 开发
pnpm build       # 构建
pnpm typecheck   # 类型检查
```

## 目录结构

```
src/
├── app/          # Next.js 页面与路由（M5）
├── db/           # SQLite 客户端、schema、向量原语
├── llm/          # DeepSeek + SiliconFlow provider 抽象
├── lib/          # 文件解析、env 等工具
└── types/        # 第三方库类型声明
```
