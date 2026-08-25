import { test } from "node:test";
import assert from "node:assert/strict";
import { cosine } from "./cosine.ts";

test("cosine: 相同向量 = 1", () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
});

test("cosine: 正交向量 = 0", () => {
  assert.equal(cosine([1, 0], [0, 1]), 0);
});

test("cosine: 空向量返回 0", () => {
  assert.equal(cosine([], [1, 2]), 0);
  assert.equal(cosine([1, 2], []), 0);
});

test("cosine: 零向量返回 0", () => {
  assert.equal(cosine([0, 0], [1, 2]), 0);
});
