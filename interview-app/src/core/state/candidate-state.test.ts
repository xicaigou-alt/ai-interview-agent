import { test } from "node:test";
import assert from "node:assert/strict";
import { updateCandidateState, selectNextTopic } from "./candidate-state.ts";
import type { CandidateState, Evaluation, InterviewPlan } from "../engine-types";

function emptyState(): CandidateState {
  return {
    competencies: {},
    verifiedStrengths: [],
    weaknesses: [],
    knowledgeGaps: [],
    resumeRisks: [],
    communicationIssues: [],
    inconsistencies: [],
    coveredTopics: [],
    remainingTopics: [],
    difficulty: "medium",
  };
}

function makeEvaluation(overrides: Partial<Evaluation> & { score: number }): Evaluation {
  return {
    strengths: [],
    weaknesses: [],
    missingPoints: [],
    resumeRisks: [],
    followUpRecommendation: "",
    ...overrides,
  };
}

function makePlan(overrides: Partial<InterviewPlan> = {}): InterviewPlan {
  return {
    durationMinutes: 40,
    primaryQuestionTarget: 5,
    difficulty: "medium",
    sections: [],
    priorityTopics: [],
    mainQuestions: [
      { dimension: "KNOWLEDGE", target: "RAG", angle: "" },
      { dimension: "EXPERIENCE", target: "腾讯", angle: "" },
      { dimension: "PROJECT", target: "AI模拟面试Agent", angle: "" },
      { dimension: "BEHAVIORAL", target: "", angle: "" },
    ],
    knowledgeTopics: ["RAG"],
    ...overrides,
  };
}

test("updateCandidateState: 更新 topic 能力分并移动 covered/remaining", () => {
  const s = emptyState();
  s.remainingTopics = ["RAG", "Agent"];
  const next = updateCandidateState(s, makeEvaluation({ score: 55 }), "RAG");
  assert.equal(next.competencies["RAG"].score, 55);
  assert.equal(next.competencies["RAG"].verified, false);
  assert.deepEqual(next.coveredTopics, ["RAG"]);
  assert.deepEqual(next.remainingTopics, ["Agent"]);
});

test("updateCandidateState: 弱项与缺失点累计且去重", () => {
  const s = emptyState();
  const next = updateCandidateState(
    s,
    makeEvaluation({ score: 60, weaknesses: ["A", "B"], missingPoints: ["B", "C"] }),
  );
  assert.deepEqual(next.weaknesses, ["A", "B", "C"]);
});

test("selectNextTopic: 按 mainQuestions 顺序返回第一道未覆盖主问题", () => {
  const s = emptyState();
  const q = selectNextTopic(s, makePlan());
  assert.ok(q);
  assert.equal(q!.dimension, "KNOWLEDGE");
  assert.equal(q!.target, "RAG");
});

test("selectNextTopic: 已覆盖的按 key 跳过", () => {
  const s = emptyState();
  s.coveredTopics = ["KNOWLEDGE:RAG"];
  const q = selectNextTopic(s, makePlan());
  assert.ok(q);
  assert.equal(q!.dimension, "EXPERIENCE");
  assert.equal(q!.target, "腾讯");
});

test("selectNextTopic: 全部覆盖后返回 null", () => {
  const s = emptyState();
  s.coveredTopics = ["KNOWLEDGE:RAG", "EXPERIENCE:腾讯", "PROJECT:AI模拟面试Agent", "BEHAVIORAL:"];
  assert.equal(selectNextTopic(s, makePlan()), null);
});
