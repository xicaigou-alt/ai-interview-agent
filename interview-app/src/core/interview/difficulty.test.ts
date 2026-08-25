import { test } from "node:test";
import assert from "node:assert/strict";
import { adjustDifficulty } from "./difficulty.ts";

test("adjustDifficulty: 高分升一档", () => {
  assert.equal(adjustDifficulty("medium", 85), "hard");
  assert.equal(adjustDifficulty("easy", 90), "medium");
});

test("adjustDifficulty: 低分降一档", () => {
  assert.equal(adjustDifficulty("hard", 40), "medium");
  assert.equal(adjustDifficulty("medium", 30), "easy");
});

test("adjustDifficulty: 中间分保持", () => {
  assert.equal(adjustDifficulty("medium", 70), "medium");
});

test("adjustDifficulty: 边界不越界", () => {
  assert.equal(adjustDifficulty("hard", 90), "hard");
  assert.equal(adjustDifficulty("easy", 30), "easy");
});

test("adjustDifficulty: 非法难度先回落 medium 再调整", () => {
  assert.equal(adjustDifficulty("impossible", 85), "hard");
});
