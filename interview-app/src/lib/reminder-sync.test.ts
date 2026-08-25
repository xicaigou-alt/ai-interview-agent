import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSchedulePayload } from "./reminder-sync.ts";

test("buildSchedulePayload: 包裹为 { schedules }", () => {
  const input = [
    { company: "字节", role: "AI产品经理", interviewAt: "2026-01-15T14:00" },
    { company: "腾讯", role: "产品经理", interviewAt: "2026-01-20T10:00" },
  ];
  assert.deepEqual(buildSchedulePayload(input), { schedules: input });
});

test("buildSchedulePayload: 空列表返回空 schedules", () => {
  assert.deepEqual(buildSchedulePayload([]), { schedules: [] });
});
