import type { CandidateProfile, CompetencyModel } from "../types";
import type { InterviewPlan, PlanQuestion } from "../engine-types";
import { planQuestionKey } from "../state/candidate-state";

export { planQuestionKey };

const BEHAVIORAL_VARIANTS = [
  "讲一个你在过去实习或项目中遇到的最大挑战，以及你是如何克服的。",
  "你如何看待 AI 产品经理在团队中与算法、研发的协作方式？",
];

// 对 LLM 产出的计划做兜底校正：确保 mainQuestions 非空、target 都来自简历、数量贴合目标。
// 同时兼容旧计划（只有 priorityTopics 的扁平列表 → 转成 KNOWLEDGE 主问题）。
export function finalizePlan(
  plan: InterviewPlan,
  profile: CandidateProfile,
  model: CompetencyModel,
  target: number,
): InterviewPlan {
  const next: InterviewPlan = {
    ...plan,
    mainQuestions: [...(plan.mainQuestions ?? [])],
    knowledgeTopics: dedupe(
      (plan.knowledgeTopics ?? []).length
        ? plan.knowledgeTopics
        : (plan.priorityTopics ?? []),
    ),
  };

  // 兼容旧计划：没有 mainQuestions 时，由 priorityTopics 兜底成知识题
  if (next.mainQuestions.length === 0) {
    next.mainQuestions = (next.knowledgeTopics.length
      ? next.knowledgeTopics
      : ["综合能力"]
    ).map((t) => ({ dimension: "KNOWLEDGE" as const, target: t, angle: "" }));
  }

  // target 白名单校验：EXPERIENCE/PROJECT 只能指向简历中真实存在的公司/项目
  const companies = new Set(
    (profile.experience ?? []).map((e) => e.company).filter(Boolean),
  );
  const projectNames = new Set(
    (profile.projects ?? []).map((p) => p.name).filter(Boolean),
  );
  next.mainQuestions = next.mainQuestions.filter((q) => {
    if (q.dimension === "EXPERIENCE") return companies.has(q.target);
    if (q.dimension === "PROJECT") return projectNames.has(q.target);
    return true;
  });

  // 数量校正：超出裁剪（必留第 1 道 KNOWLEDGE 与第 1 道 BEHAVIORAL），不足按 §6 循环补足
  trimPlan(next, target);
  expandPlan(next, model, target);

  return next;
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

// 从尾部裁剪，保护第 1 道 KNOWLEDGE 与第 1 道 BEHAVIORAL
function trimPlan(plan: InterviewPlan, target: number): void {
  const qs = plan.mainQuestions;
  if (qs.length <= target) return;

  const keep = new Set<number>();
  const kIdx = qs.findIndex((q) => q.dimension === "KNOWLEDGE");
  const bIdx = qs.findIndex((q) => q.dimension === "BEHAVIORAL");
  if (kIdx >= 0) keep.add(kIdx);
  if (bIdx >= 0) keep.add(bIdx);

  let result = qs.map((q, i) => ({ q, i }));
  while (result.length > target) {
    const droppable = [...result].reverse().find((x) => !keep.has(x.i));
    if (!droppable) break;
    result = result.filter((x) => x !== droppable);
  }
  plan.mainQuestions = result.map((x) => x.q);
}

// 骨架不足时按 §6 循环补足：知识题 → 已覆盖经历/项目换角度 → 行为扩展 → JD 业务情景题
function expandPlan(
  plan: InterviewPlan,
  model: CompetencyModel,
  target: number,
): void {
  const qs = [...plan.mainQuestions];
  const used = new Set(qs.map(planQuestionKey));

  const push = (q: PlanQuestion): boolean => {
    const key = planQuestionKey(q);
    if (used.has(key)) return false;
    used.add(key);
    qs.push(q);
    return true;
  };

  const knowledgeUsed = new Set(
    qs.filter((q) => q.dimension === "KNOWLEDGE").map((q) => q.target),
  );
  const angleTargets = new Set(
    qs
      .filter((q) => (q.dimension === "EXPERIENCE" || q.dimension === "PROJECT") && !q.angle)
      .map((q) => q.target),
  );
  const behavioralUsed = new Set(
    qs.filter((q) => q.dimension === "BEHAVIORAL").map((q) => q.angle),
  );
  const scenarioUsed = new Set(
    qs.filter((q) => q.dimension === "JD_SCENARIO").map((q) => q.target),
  );

  let guard = 0;
  while (qs.length < target && guard < 200) {
    guard++;
    let added = false;

    // 1. 知识题：换下一个知识点
    for (const t of plan.knowledgeTopics ?? []) {
      if (!knowledgeUsed.has(t)) {
        knowledgeUsed.add(t);
        added = push({ dimension: "KNOWLEDGE", target: t, angle: "" }) || added;
        if (qs.length >= target) break;
      }
    }
    if (qs.length >= target) break;

    // 2. 换角度深挖：对已覆盖的实习/项目补一道换角度题
    for (const q of [...plan.mainQuestions]) {
      if ((q.dimension === "EXPERIENCE" || q.dimension === "PROJECT") && q.target && !q.angle && angleTargets.has(q.target)) {
        angleTargets.delete(q.target);
        const angle =
          q.dimension === "EXPERIENCE"
            ? `如果重新做你在${q.target}的这段实习，结合当时的职责你会怎么改进或重新设计？`
            : `如果重新设计你的${q.target}项目，你会怎么改进？为什么？`;
        added = push({ dimension: q.dimension, target: q.target, angle }) || added;
        if (qs.length >= target) break;
      }
    }
    if (qs.length >= target) break;

    // 3. 行为扩展
    for (const v of BEHAVIORAL_VARIANTS) {
      if (!behavioralUsed.has(v)) {
        behavioralUsed.add(v);
        added = push({ dimension: "BEHAVIORAL", target: "", angle: v }) || added;
        if (qs.length >= target) break;
      }
    }
    if (qs.length >= target) break;

    // 4. JD 业务情景题
    for (const r of model.priorityRequirements ?? []) {
      if (!scenarioUsed.has(r)) {
        scenarioUsed.add(r);
        added = push({ dimension: "JD_SCENARIO", target: r, angle: "" }) || added;
        if (qs.length >= target) break;
      }
    }

    // 池子耗尽且未补足：结束（引擎会在主问题耗尽时自然结束面试）
    if (!added) break;
  }

  plan.mainQuestions = qs;
}
