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

test("selectNextTopic: 优先弱项/未验证 topic", () => {
  const s = emptyState();
  s.remainingTopics = ["已验证强项", "弱项"];
  s.competencies["已验证强项"] = { score: 85, verified: true };
  assert.equal(selectNextTopic(s, makePlan()), "弱项");
});

test("selectNextTopic: 全部覆盖后返回 null", () => {
  const s = emptyState();
  s.remainingTopics = [];
  s.coveredTopics = ["RAG"];
  assert.equal(selectNextTopic(s, makePlan({ priorityTopics: ["RAG"] })), null);
});
