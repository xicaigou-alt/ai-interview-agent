import { chatJson } from "@/llm";
import { InterviewPlanSchema, type CandidateState, type InterviewPlan } from "../engine-types";
import type { CandidateProfile, CompetencyModel, GapResult } from "../types";
import { finalizePlan } from "./plan-shaping";

const SYSTEM = `你是资深面试规划师，负责根据候选人画像、岗位能力模型、差距分析和历史表现，制定一场模拟面试的考试计划（决定「考什么」，不决定具体题目）。`;

const TEMPLATE = `{
  "durationMinutes": 40,
  "primaryQuestionTarget": 10,
  "difficulty": "medium",
  "sections": [
    { "type": "RESUME_DEEP_DIVE", "weight": 0.30 },
    { "type": "AI_KNOWLEDGE", "weight": 0.25 },
    { "type": "PRODUCT_DESIGN", "weight": 0.20 },
    { "type": "JD_GAP", "weight": 0.15 },
    { "type": "BEHAVIORAL", "weight": 0.10 }
  ],
  "mainQuestions": [
    { "dimension": "KNOWLEDGE", "target": "RAG 原理与适用场景", "angle": "" },
    { "dimension": "EXPERIENCE", "target": "腾讯", "angle": "" },
    { "dimension": "EXPERIENCE", "target": "滴滴", "angle": "" },
    { "dimension": "PROJECT", "target": "AI个性化模拟面试Agent", "angle": "" },
    { "dimension": "BEHAVIORAL", "target": "", "angle": "" }
  ],
  "knowledgeTopics": ["RAG", "Prompt 工程", "Agent", "SQL/Python 数据分析"]
}`;

export interface PlanInterviewInput {
  profile: CandidateProfile;
  model: CompetencyModel;
  gap: GapResult;
  company: string;
  role: string;
  mode: string;
  history: CandidateState | null;
  requirement?: string | null;
  questionTarget?: number | null;
}

export async function planInterview(input: PlanInterviewInput): Promise<InterviewPlan> {
  const { profile, model, gap, company, role, mode, history, requirement, questionTarget } = input;
  const target = questionTarget ?? 10;

  const experienceList = (profile.experience ?? [])
    .map((e) => ({ company: e.company, role: e.role }))
    .filter((e) => e.company);
  const projectList = (profile.projects ?? [])
    .map((p) => ({ name: p.name }))
    .filter((p) => p.name);

  const out = await chatJson<InterviewPlan>(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `请制定面试计划，输出严格符合 JSON 结构（camelCase）：

${TEMPLATE}

要求：
1. mainQuestions 的数量必须**正好等于 ${target}**（一道主问题一项，这是用户设置的目标题数）。
2. 按真实面试结构铺开（顺序即出题顺序）：
   a. 第 1 道：KNOWLEDGE 基础知识（target = 一个具体知识点，如「RAG 原理与适用场景」）。
   b. 然后：EXPERIENCE 逐段实习——简历每段实习各 1 道（按时间从新到旧），target 填公司名。
   c. 然后：PROJECT 项目——只选与 JD 最相关的 1~2 个项目，target 填项目名。
   d. 然后：BEHAVIORAL 行为动机（target 留空字符串 ""）。
   若数量不足 ${target}，按此优先级循环加题：KNOWLEDGE（换下一个知识点）→ 已覆盖实习/项目"换角度"（dimension 不变、target 不变、angle 填一句完整的问题，如「如果重新设计你的XX项目，你会怎么改进？」）→ BEHAVIORAL（换一个行为主题，angle 填完整问题）→ JD_SCENARIO（结合 JD 业务场景，target 填场景简述）。
   若骨架数量超出 ${target}，必须保留第 1 道 KNOWLEDGE 与 1 道 BEHAVIORAL，其余按"与 JD 相关度从低到高"裁剪。
3. 【禁止自创】EXPERIENCE 的 target 只能从下方【简历实习清单】的公司名里选；PROJECT 的 target 只能从【简历项目清单】里选；简历里没有的公司/项目绝对不允许出现在 mainQuestions 里。
4. knowledgeTopics = 知识点池（5~8 个，去重）：以 JD priorityRequirements 为主，补充 AI/Technical 类 competencies 中不重复的能力点；排序 = JD 权重高者优先 → 与简历缺失能力 / 历史弱项交集者提前。
5. 历史弱项提权：弱项对应的知识点放在 KNOWLEDGE 第 1 道；若弱项明确集中在基础知识，KNOWLEDGE 可出 2 道（BEHAVIORAL 相应减 1 道）。
6. sections 的 weight 相加必须等于 1；弱项对应的 section 权重适当提高。
7. 面试模式：${mode === "mock" ? "mock（接近真实面试）" : "coaching（边练边学）"}。
8. 只输出 JSON。
${requirement ? `\n用户的面试要求/考察侧重（务必据此调整 sections 权重与 mainQuestions 的角度）：\n${requirement}\n` : ""}

公司：${company}
岗位：${role}

【简历实习清单】（EXPERIENCE 只能从这里选 target）：
${JSON.stringify(experienceList)}

【简历项目清单】（PROJECT 只能从这里选 target）：
${JSON.stringify(projectList)}

候选人画像（供参考，不得据此自创经历）：
${JSON.stringify(profile)}

能力模型：
${JSON.stringify(model)}

差距分析：
${JSON.stringify(gap)}

历史表现（可能为空）：
${JSON.stringify(history)}`,
      },
    ],
    { schema: InterviewPlanSchema, temperature: 0.2 },
  );

  // 兜底校正：target 白名单校验、数量裁剪/补足、兼容旧字段
  return finalizePlan(out, profile, model, target);
}
