import { embedTexts } from "@/llm";
import { cosine } from "@/db/cosine";
import { getResume, parseResumeRow } from "@/db/repositories/resumes";
import { getJob, parseJobAnalysis, type JobRow } from "@/db/repositories/jobs";
import { getItemById } from "@/db/repositories/interview_items";
import {
  completeSession,
  getLatestCompletedState,
  getSession,
  markSessionStarted,
  updateSessionCandidateState,
  updateSessionPlan,
  updateSessionStatus,
  type SessionRow,
} from "@/db/repositories/interview_sessions";
import {
  countFollowUpsSinceLastPrimary,
  countPrimaryTurns,
  createTurn,
  getLastTurn,
  listTurns,
  updateTurnResult,
} from "@/db/repositories/interview_turns";
import { recordTurnMemory } from "@/db/repositories/memory";
import { enforceFollowUpLimit, isFollowUpAction } from "./decision-rules";
import { adjustDifficulty } from "./difficulty";
import { analyzeGap } from "../gap/analyze-gap";
import { planInterview } from "../planner/plan-interview";
import { finalizePlan, planQuestionKey } from "../planner/plan-shaping";
import { retrievePrimaryQuestion } from "../retrieve/retrieve-question";
import {
  generateKnowledgeQuestion,
  generateScenarioQuestion,
  rewriteWithJdContext,
} from "../generate/generate-question";
import { evaluateAnswer } from "./evaluator";
import { decideNext, generateFollowUp } from "./decision-engine";
import { selectNextTopic, updateCandidateState } from "../state/candidate-state";
import {
  EMPTY_CANDIDATE_STATE,
  SessionStatus,
  type CandidateState,
  type Evaluation,
  type InterviewPlan,
  type PlanQuestion,
  type PrimaryQuestion,
} from "../engine-types";
import type { CandidateProfile, CompetencyModel, GapResult } from "../types";

export interface EngineContext {
  session: SessionRow;
  job: JobRow;
  profile: CandidateProfile;
  model: CompetencyModel;
  plan: InterviewPlan;
  state: CandidateState;
  mode: "coaching" | "mock";
}

// 分析阶段：画像 + 能力模型 + 差距 + 计划，并持久化 plan 与初始 candidate state
export async function analyzeSession(sessionId: number): Promise<{
  profile: CandidateProfile;
  model: CompetencyModel;
  gap: GapResult;
  plan: InterviewPlan;
}> {
  const session = getSession(sessionId);
  if (!session) throw new Error("会话不存在");

  const resume = session.resumeId != null ? getResume(session.resumeId) : null;
  const job = session.jobId != null ? getJob(session.jobId) : null;
  if (!resume || !job) throw new Error("会话缺少简历或岗位信息");

  const profile = (parseResumeRow(resume) as CandidateProfile | null) ?? ({} as CandidateProfile);
  const model = (parseJobAnalysis(job) as CompetencyModel | null) ?? ({} as CompetencyModel);

  const gap = await analyzeGap(profile, model);
  const history = session.resumeId != null ? getLatestCompletedState(session.resumeId) : null;
  const rawPlan = await planInterview({
    profile,
    model,
    gap,
    company: job.company,
    role: job.role,
    mode: session.mode,
    history,
    requirement: session.requirement,
    questionTarget: session.questionTarget,
  });

  // 用户在新建面试时指定的目标题数，覆盖规划器默认值，并做结构化校正
  const target = session.questionTarget ?? rawPlan.primaryQuestionTarget ?? 10;
  rawPlan.primaryQuestionTarget = target;
  const plan = finalizePlan(rawPlan, profile, model, target);

  updateSessionPlan(sessionId, plan);
  updateSessionCandidateState(sessionId, {
    ...EMPTY_CANDIDATE_STATE,
    remainingTopics: (plan.mainQuestions ?? []).map(planQuestionKey),
    difficulty: plan.difficulty ?? "medium",
  });
  updateSessionStatus(sessionId, SessionStatus.READY);

  return { profile, model, gap, plan };
}

export function loadEngineContext(sessionId: number): EngineContext {
  const session = getSession(sessionId);
  if (!session) throw new Error("会话不存在");

  const job = session.jobId != null ? getJob(session.jobId) : null;
  if (!job) throw new Error("会话缺少岗位信息");

  const resume = session.resumeId != null ? getResume(session.resumeId) : null;
  const profile = resume
    ? ((parseResumeRow(resume) as CandidateProfile | null) ?? ({} as CandidateProfile))
    : ({} as CandidateProfile);

  const model = (parseJobAnalysis(job) as CompetencyModel | null) ?? ({} as CompetencyModel);

  let plan: InterviewPlan;
  if (session.interviewPlan) {
    const parsed = JSON.parse(session.interviewPlan) as InterviewPlan;
    plan = finalizePlan(parsed, profile, model, parsed.primaryQuestionTarget ?? 10);
  } else {
    plan = {
      durationMinutes: 40,
      priorityTopics: [],
      primaryQuestionTarget: 10,
      difficulty: "medium",
      sections: [],
      mainQuestions: [{ dimension: "KNOWLEDGE", target: "综合能力", angle: "" }],
      knowledgeTopics: ["综合能力"],
    } as InterviewPlan;
  }

  const state = session.candidateState
    ? (JSON.parse(session.candidateState) as CandidateState)
    : { ...EMPTY_CANDIDATE_STATE };

  return {
    session,
    job,
    profile,
    model,
    plan,
    state,
    mode: session.mode === "mock" ? "mock" : "coaching",
  };
}

export async function startInterview(ctx: EngineContext): Promise<{ question: string; turnId: number }> {
  const planQ =
    selectNextTopic(ctx.state, ctx.plan) ??
    ctx.plan.mainQuestions?.[0] ?? { dimension: "KNOWLEDGE", target: "综合能力", angle: "" };

  const { primary, personalized } = await buildPrimaryQuestion(ctx, planQ);

  const turn = createTurn({
    sessionId: ctx.session.id,
    questionText: personalized,
    baseQuestionText: primary.question,
    questionSourceId: primary.sourceId,
    questionType: primary.questionType,
    topics: primary.topics,
    isFollowUp: false,
  });

  markSessionStarted(ctx.session.id);
  return { question: personalized, turnId: turn.id };
}

// 组装一道主问题：按维度出题（知识/实习/项目/行为/情景）→ 硬去重重试
async function buildPrimaryQuestion(
  ctx: EngineContext,
  planQ: PlanQuestion,
): Promise<{ primary: PrimaryQuestion; personalized: string }> {
  const topicKey = planQuestionKey(planQ);
  const askedTexts = getAskedPrimaryQuestions(ctx.session.id);
  const excludedIds = new Set(getUsedSourceIds(ctx.session.id));
  const extraAsked: string[] = [];

  let last: { primary: PrimaryQuestion; personalized: string } | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const built = await buildOneQuestion(ctx, planQ, topicKey, [...excludedIds], askedTexts.concat(extraAsked));
    last = built;

    const dup = await isQuestionDuplicate(built.personalized, askedTexts.concat(extraAsked));
    if (!dup) break;

    // 重复：把本次结果加入"已问"语境，并排除该题源，换角度再试
    extraAsked.push(built.personalized);
    if (built.primary.sourceId != null) excludedIds.add(built.primary.sourceId);
  }

  return last!;
}

// 按维度出题（问题方案 v2 §3.1 / §6）
async function buildOneQuestion(
  ctx: EngineContext,
  planQ: PlanQuestion,
  topicKey: string,
  excludeIds: number[],
  askedQuestions: string[],
): Promise<{ primary: PrimaryQuestion; personalized: string }> {
  const difficulty = ctx.state.difficulty ?? ctx.plan.difficulty ?? "medium";

  switch (planQ.dimension) {
    case "KNOWLEDGE": {
      // 知识题：检索（排除已用题源 + 模拟题污染）→ 结合 JD 改写；无命中则直接生成通用知识题（不绑简历）
      const item = await retrievePrimaryQuestion({
        topic: planQ.target,
        company: ctx.job.company,
        role: ctx.job.role,
        excludeIds,
      });
      if (item) {
        const personalized = await rewriteWithJdContext(
          item.question,
          ctx.job.company,
          ctx.job.role,
          ctx.job.jdText,
        );
        return {
          primary: {
            question: item.question,
            questionType: "AI_KNOWLEDGE",
            topics: [topicKey],
            sourceType: item.sourceType,
            sourceId: item.id ?? null,
          },
          personalized,
        };
      }

      const g = await generateKnowledgeQuestion({
        role: ctx.job.role,
        topic: planQ.target,
        difficulty,
        jdText: ctx.job.jdText,
        priorityRequirements: ctx.model.priorityRequirements ?? [],
        askedQuestions,
      });
      return {
        primary: {
          question: g.question,
          questionType: "AI_KNOWLEDGE",
          topics: [topicKey],
          sourceType: "MODEL_GENERATED",
          sourceId: null,
        },
        personalized: g.question,
      };
    }

    case "EXPERIENCE": {
      const exp = (ctx.profile.experience ?? []).find((e) => e.company === planQ.target);
      const text =
        planQ.angle ||
        (exp
          ? `介绍一下你在${exp.company}实习${exp.role ? `（${exp.role}）` : ""}主要负责的工作。`
          : `介绍一下你在${planQ.target}这段实习主要负责的工作。`);
      return templatePrimary(text, topicKey, "RESUME_DEEP_DIVE");
    }

    case "PROJECT": {
      const text =
        planQ.angle ||
        `介绍一下你的${planQ.target}项目：为什么做、解决什么问题、你在其中的角色？`;
      return templatePrimary(text, topicKey, "RESUME_DEEP_DIVE");
    }

    case "BEHAVIORAL": {
      const text = planQ.angle || "为什么想做 AI 产品经理？讲讲你的职业规划与选择动机。";
      return templatePrimary(text, topicKey, "BEHAVIORAL");
    }

    case "JD_SCENARIO": {
      const g = await generateScenarioQuestion({
        role: ctx.job.role,
        scenario: planQ.target || "基于岗位 JD 的核心业务场景，设计一个 AI 应用/产品方案",
        difficulty,
        jdText: ctx.job.jdText,
        askedQuestions,
      });
      return {
        primary: {
          question: g.question,
          questionType: "PRODUCT_DESIGN",
          topics: [topicKey],
          sourceType: "MODEL_GENERATED",
          sourceId: null,
        },
        personalized: g.question,
      };
    }
  }
}

// 模板化主问题（实习/项目/行为）：直接由简历真实事实 + 固定模板生成，零幻觉风险
function templatePrimary(
  text: string,
  topicKey: string,
  questionType: string,
): { primary: PrimaryQuestion; personalized: string } {
  const primary: PrimaryQuestion = {
    question: text,
    questionType,
    topics: [topicKey],
    sourceType: "MODEL_GENERATED",
    sourceId: null,
  };
  return { primary, personalized: text };
}

// 已问过的主问题文本（用于避免出题/个性化重复）
function getAskedPrimaryQuestions(sessionId: number): string[] {
  return listTurns(sessionId)
    .filter((t) => !t.isFollowUp)
    .map((t) => t.questionText);
}

// 本场已用过的题源 id（避免同一道知识库题被反复复用）
function getUsedSourceIds(sessionId: number): number[] {
  return listTurns(sessionId)
    .filter((t) => !t.isFollowUp && t.questionSourceId != null)
    .map((t) => t.questionSourceId as number);
}

// 文本归一化：忽略空白/标点/大小写，做完全去重
function normalizeQuestion(s: string): string {
  return s.toLowerCase().replace(/[\s，。；：、！？,.!?;:'"“”‘’()（）\-—_/\\]/g, "");
}

// 硬去重：先文本完全去重，再做语义相似度阈值去重
async function isQuestionDuplicate(question: string, asked: string[]): Promise<boolean> {
  if (asked.length === 0) return false;

  const norm = normalizeQuestion(question);
  for (const q of asked) {
    if (normalizeQuestion(q) === norm) return true;
  }

  try {
    const vecs = await embedTexts([question, ...asked]);
    const [v, ...vs] = vecs;
    for (const w of vs) {
      if (cosine(v, w) > 0.9) return true;
    }
  } catch {
    // embedding 不可用时降级为仅文本去重
  }

  return false;
}

export interface AnswerResult {
  finished: boolean;
  question: string | null;
  isFollowUp: boolean;
  decision: string;
  evaluation: Evaluation;
  turnId: number | null;
}

export async function handleAnswer(ctx: EngineContext, answer: string): Promise<AnswerResult> {
  const lastTurn = getLastTurn(ctx.session.id);
  if (!lastTurn) throw new Error("没有进行中的问题");

  const topic = lastTurn.topics?.[0];
  const rubric =
    lastTurn.questionSourceId != null
      ? getItemById(lastTurn.questionSourceId)?.evaluationRubric
      : undefined;

  const evaluation = await evaluateAnswer({ question: lastTurn.questionText, answer, topic, rubric });
  const nextState = updateCandidateState(ctx.state, evaluation, topic);
  // 难度自适应（§5.5）：仅在主问题作答后调整，避免追问噪声
  if (!lastTurn.isFollowUp) {
    nextState.difficulty = adjustDifficulty(nextState.difficulty, evaluation.score);
  }

  const primaryCount = countPrimaryTurns(ctx.session.id);
  const followUpCount = countFollowUpsSinceLastPrimary(ctx.session.id);
  let decision = await decideNext({
    question: lastTurn.questionText,
    answer,
    evaluation,
    candidateState: nextState,
    primaryCount,
    questionTarget: ctx.plan.primaryQuestionTarget ?? 10,
    followUpCount,
  });

  // 硬性兜底：追问已达上限，强制进入下一主问题（避免无限追问）
  decision = enforceFollowUpLimit(decision, followUpCount);

  updateTurnResult(lastTurn.id, { answer, evaluation, decision: decision.decision });
  updateSessionCandidateState(ctx.session.id, nextState);
  // V2 记忆显式化：把本次评价的能力分/弱项/简历风险落成可查询的历史
  recordTurnMemory({
    sessionId: ctx.session.id,
    resumeId: ctx.session.resumeId,
    evaluation,
    topic,
    evidence: lastTurn.questionText,
  });

  if (decision.decision === "FINISH") {
    completeSession(ctx.session.id);
    return { finished: true, question: null, isFollowUp: false, decision: decision.decision, evaluation, turnId: null };
  }

  const followUp = isFollowUpAction(decision.decision);

  if (followUp) {
    const followUp = await generateFollowUp({
      question: lastTurn.questionText,
      answer,
      evaluation,
      decision: decision.decision,
      requirement: ctx.session.requirement,
    });
    const turn = createTurn({
      sessionId: ctx.session.id,
      questionText: followUp,
      questionSourceId: lastTurn.questionSourceId,
      questionType: lastTurn.questionType,
      topics: lastTurn.topics,
      isFollowUp: true,
    });
    return { finished: false, question: followUp, isFollowUp: true, decision: decision.decision, evaluation, turnId: turn.id };
  }

  const next = await advanceToNextPrimary(ctx, nextState);
  return { ...next, evaluation };
}

// 推进到下一主问题（或结束会话）
async function advanceToNextPrimary(
  ctx: EngineContext,
  state: CandidateState,
): Promise<Omit<AnswerResult, "evaluation">> {
  // 硬停阈值：已问主问题数达到目标题数则结束面试（跳过/答题两条路径都受此约束）
  const target = ctx.plan.primaryQuestionTarget ?? 10;
  if (countPrimaryTurns(ctx.session.id) >= target) {
    completeSession(ctx.session.id);
    return { finished: true, question: null, isFollowUp: false, decision: "FINISH", turnId: null };
  }

  const nextTopic = selectNextTopic(state, ctx.plan);
  if (!nextTopic) {
    completeSession(ctx.session.id);
    return { finished: true, question: null, isFollowUp: false, decision: "FINISH", turnId: null };
  }

  const { primary, personalized } = await buildPrimaryQuestion(ctx, nextTopic);
  const turn = createTurn({
    sessionId: ctx.session.id,
    questionText: personalized,
    baseQuestionText: primary.question,
    questionSourceId: primary.sourceId,
    questionType: primary.questionType,
    topics: primary.topics,
    isFollowUp: false,
  });

  return {
    finished: false,
    question: personalized,
    isFollowUp: false,
    decision: "NEXT_QUESTION",
    turnId: turn.id,
  };
}

// 跳过当前问题，直接进入下一主问题
export async function skipQuestion(
  ctx: EngineContext,
): Promise<Omit<AnswerResult, "evaluation">> {
  const lastTurn = getLastTurn(ctx.session.id);
  if (!lastTurn) throw new Error("没有进行中的问题");

  const topic = lastTurn.topics?.[0];
  const nextState: CandidateState = {
    ...ctx.state,
    coveredTopics: [...(ctx.state.coveredTopics ?? [])],
    remainingTopics: [...(ctx.state.remainingTopics ?? [])],
  };
  if (topic) {
    if (!nextState.coveredTopics.includes(topic)) nextState.coveredTopics.push(topic);
    nextState.remainingTopics = nextState.remainingTopics.filter((t) => t !== topic);
  }

  updateTurnResult(lastTurn.id, { answer: "(已跳过)", evaluation: {}, decision: "SKIPPED" });
  updateSessionCandidateState(ctx.session.id, nextState);

  return advanceToNextPrimary(ctx, nextState);
}
