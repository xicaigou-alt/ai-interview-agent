import { test } from "node:test";
import assert from "node:assert/strict";
import { isFollowUpAction, enforceFollowUpLimit } from "./decision-rules.ts";
import type { Decision } from "../engine-types";

const FOLLOW_UP_DECISIONS: Decision[] = [
  "CLARIFY",
  "DEEP_DIVE",
  "CHALLENGE",
  "COUNTERFACTUAL",
  "TECHNICAL",
  "DATA_VALIDATION",
  "OWNERSHIP_CHECK",
];

const NON_FOLLOW_UP_DECISIONS: Decision[] = ["NEXT_QUESTION", "PASS", "FINISH"];

test("isFollowUpAction: 追问类动作返回 true", () => {
  for (const d of FOLLOW_UP_DECISIONS) {
    assert.equal(isFollowUpAction(d), true, d);
  }
});

test("isFollowUpAction: 非追问动作返回 false", () => {
  for (const d of NON_FOLLOW_UP_DECISIONS) {
    assert.equal(isFollowUpAction(d), false, d);
  }
});

test("enforceFollowUpLimit: 达到上限强制进入下一题", () => {
  const r = enforceFollowUpLimit({ decision: "DEEP_DIVE", reasoning: "深入" }, 2);
  assert.equal(r.decision, "NEXT_QUESTION");
  assert.equal(r.reasoning, "已达追问上限，进入下一题");
});

test("enforceFollowUpLimit: 未达上限保留原决策与理由", () => {
  const r = enforceFollowUpLimit({ decision: "DEEP_DIVE", reasoning: "深入" }, 1);
  assert.equal(r.decision, "DEEP_DIVE");
  assert.equal(r.reasoning, "深入");
});

test("enforceFollowUpLimit: PASS 不受追问上限影响", () => {
  const r = enforceFollowUpLimit({ decision: "PASS", reasoning: "合格" }, 2);
  assert.equal(r.decision, "PASS");
});
