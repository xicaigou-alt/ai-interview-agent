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
  updateTurnResult,
} from "@/db/repositories/interview_turns";
import { recordTurnMemory } from "@/db/repositories/memory";
import { enforceFollowUpLimit, isFollowUpAction } from "./decision-rules";
import { adjustDifficulty } from "./difficulty";
import { analyzeGap } from "../gap/analyze-gap";
import { planInterview } from "../planner/plan-interview";
import { retrievePrimaryQuestion } from "../retrieve/retrieve-question";
import { generateQuestion } from "../generate/generate-question";
import { personalizeQuestion } from "./interviewer";
import { evaluateAnswer } from "./evaluator";
import { decideNext, generateFollowUp } from "./decision-engine";
import { selectNextTopic, updateCandidateState } from "../state/candidate-state";
import {
  EMPTY_CANDIDATE_STATE,
  SessionStatus,
  type CandidateState,
  type Evaluation,
  type InterviewPlan,
  type PrimaryQuestion,
} from "../engine-types";
import type { CandidateProfile, CompetencyModel, GapResult } from "../types";

export interface EngineContext {
  session: SessionRow;
  job: JobRow;
  profile: CandidateProfile;
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
  const plan = await planInterview({
    profile,
    model,
    gap,
    company: job.company,
    role: job.role,
    mode: session.mode,
    history,
    requirement: session.requirement,
  });

  // 用户在新建面试时指定的目标题数，覆盖规划器默认值
  if (session.questionTarget != null) {
    plan.primaryQuestionTarget = session.questionTarget;
  }

  updateSessionPlan(sessionId, plan);
  updateSessionCandidateState(sessionId, {
    ...EMPTY_CANDIDATE_STATE,
    remainingTopics: [...(plan.priorityTopics ?? [])],
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

  const plan = session.interviewPlan
    ? (JSON.parse(session.interviewPlan) as InterviewPlan)
    : ({
        durationMinutes: 40,
        priorityTopics: [],
        primaryQuestionTarget: 10,
        difficulty: "medium",
        sections: [],
      } as InterviewPlan);

  const state = session.candidateState
    ? (JSON.parse(session.candidateState) as CandidateState)
    : { ...EMPTY_CANDIDATE_STATE };

  return {
    session,
    job,
    profile,
    plan,
    state,
    mode: session.mode === "mock" ? "mock" : "coaching",
  };
}

export async function startInterview(ctx: EngineContext): Promise<{ question: string; turnId: number }> {
  const topic =
    selectNextTopic(ctx.state, ctx.plan) ?? ctx.plan.priorityTopics?.[0] ?? "综合能力";

  const primary = await getPrimaryQuestion(ctx, topic);
  const personalized = await personalizeQuestion({
    baseQuestion: primary.question,
    profile: ctx.profile,
    jdText: ctx.job.jdText,
    requirement: ctx.session.requirement,
  });

  const turn = createTurn({
    sessionId: ctx.session.id,
    questionText: personalized,
    questionSourceId: primary.sourceId,
    questionType: primary.questionType,
    topics: primary.topics,
    isFollowUp: false,
  });

  markSessionStarted(ctx.session.id);
  return { question: personalized, turnId: turn.id };
}

async function getPrimaryQuestion(ctx: EngineContext, topic: string): Promise<PrimaryQuestion> {
  const item = await retrievePrimaryQuestion({
    topic,
    company: ctx.job.company,
    role: ctx.job.role,
  });

  if (item) {
    return {
      question: item.question,
      questionType: item.questionType ?? "AI_KNOWLEDGE",
      topics: item.topics,
      sourceType: item.sourceType,
      sourceId: item.id ?? null,
    };
  }

  const g = await generateQuestion({
    role: ctx.job.role,
    topic,
    difficulty: ctx.state.difficulty ?? ctx.plan.difficulty ?? "medium",
    profile: ctx.profile,
    jdText: ctx.job.jdText,
  });

  return {
    question: g.question,
    questionType: g.questionType,
    topics: g.topics,
    sourceType: "MODEL_GENERATED",
    sourceId: null,
  };
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

  const primary = await getPrimaryQuestion(ctx, nextTopic);
  const personalized = await personalizeQuestion({
    baseQuestion: primary.question,
    profile: ctx.profile,
    jdText: ctx.job.jdText,
    requirement: ctx.session.requirement,
  });
  const turn = createTurn({
    sessionId: ctx.session.id,
    questionText: personalized,
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
