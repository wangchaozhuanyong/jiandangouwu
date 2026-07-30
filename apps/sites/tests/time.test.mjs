import assert from "node:assert/strict";
import test from "node:test";
import {
  BUSINESS_TIME_ZONE,
  chinaDateKey,
  formatChinaDateTime,
} from "../server/time.ts";

test("China business time crosses the UTC date boundary at UTC+8", () => {
  assert.equal(BUSINESS_TIME_ZONE, "Asia/Shanghai");
  assert.equal(chinaDateKey("2026-07-29T15:59:59.000Z"), "2026-07-29");
  assert.equal(chinaDateKey("2026-07-29T16:00:00.000Z"), "2026-07-30");
  assert.equal(
    formatChinaDateTime("2026-07-29T16:30:45.000Z"),
    "2026-07-30 00:30:45（中国标准时间 UTC+8）",
  );
});
