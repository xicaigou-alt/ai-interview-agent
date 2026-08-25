import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPracticePlan } from "./plan-practice.ts";

test("buildPracticePlan: 低分维度优先", () => {
  const plan = buildPracticePlan({
    competencyAverages: [
      { competency: "RAG", avgScore: 55, count: 3 },
      { competency: "产品设计", avgScore: 85, count: 2 },
    ],
    weaknesses: [],
  });
  assert.deepEqual(plan.map((p) => p.topic), ["RAG"]);
  assert.equal(plan[0].priority, "weak_competency");
});

test("buildPracticePlan: 过滤 70 分以上维度", () => {
  const plan = buildPracticePlan({
    competencyAverages: [{ competency: "RAG", avgScore: 85, count: 2 }],
    weaknesses: [],
  });
  assert.equal(plan.length, 0);
});

test("buildPracticePlan: 高频弱项补充且与低分维度去重", () => {
  const plan = buildPracticePlan({
    competencyAverages: [{ competency: "RAG", avgScore: 50, count: 2 }],
    weaknesses: [
      { weakness: "RAG 检索链路不熟", competency: "RAG", hitCount: 3 },
      { weakness: "STAR 结构弱", competency: "行为面试", hitCount: 2 },
    ],
  });
  assert.deepEqual(plan.map((p) => p.topic), ["RAG", "行为面试"]);
});

test("buildPracticePlan: 尊重 limit", () => {
  const plan = buildPracticePlan({
    competencyAverages: [
      { competency: "A", avgScore: 40, count: 1 },
      { competency: "B", avgScore: 50, count: 1 },
      { competency: "C", avgScore: 60, count: 1 },
    ],
    weaknesses: [],
    limit: 2,
  });
  assert.equal(plan.length, 2);
});
