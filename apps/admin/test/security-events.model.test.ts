import assert from "node:assert/strict";
import test from "node:test";
import type { AuditEvent } from "../src/api";
import {
  buildSecurityEvents,
  filterSecurityEvents,
  securityActionLabel,
  summarizeSecurityEvents,
} from "../src/features/security-events/model";

const now = Date.parse("2026-07-29T12:00:00.000Z");

const audit = (
  id: string,
  action: string,
  result: AuditEvent["result"],
  createdAt: string,
  overrides: Partial<AuditEvent> = {},
): AuditEvent => ({
  id,
  requestId: `trace-${id}`,
  action,
  targetType: "AdminUser",
  targetId: `target-${id}`,
  result,
  reason: null,
  actor: { displayName: "Security Admin", email: "security@example.invalid" },
  createdAt,
  ...overrides,
});

test("security events use real audit signals and exclude ordinary successful content edits", () => {
  const events = buildSecurityEvents([
    audit("login-failed", "auth.login.failed", "FAILED", "2026-07-29T11:00:00.000Z"),
    audit("role-change", "access.role.permissions.update", "SUCCEEDED", "2026-07-29T10:00:00.000Z"),
    audit("contact", "order.contact.reveal", "SUCCEEDED", "2026-07-29T09:00:00.000Z"),
    audit("ordinary", "product.update", "SUCCEEDED", "2026-07-29T08:00:00.000Z"),
  ]);

  assert.deepEqual(events.map((event) => event.id), [
    "login-failed",
    "role-change",
    "contact",
  ]);
  assert.equal(events[0]?.severity, "high");
  assert.equal(events[0]?.category, "authentication");
  assert.equal(events[1]?.severity, "medium");
  assert.equal(events[1]?.category, "authorization");
  assert.equal(events[2]?.category, "sensitive-data");
});

test("all denied audit actions remain visible and are prioritized without claiming a threat verdict", () => {
  const events = buildSecurityEvents([
    audit("denied", "unknown.operation", "DENIED", "2026-07-29T11:00:00.000Z"),
    audit("failed", "product.update", "FAILED", "2026-07-29T10:00:00.000Z"),
  ]);

  assert.equal(events.length, 1);
  assert.equal(events[0]?.id, "denied");
  assert.equal(events[0]?.severity, "high");
  assert.equal(events[0]?.needsReview, true);
  assert.equal(events[0]?.category, "authorization");
});

test("security event filters combine time, priority, category, result, and normalized search", () => {
  const events = buildSecurityEvents([
    audit("recent", "auth.login.failed", "FAILED", "2026-07-29T11:00:00.000Z", {
      reason: "Password verification failed",
    }),
    audit("older", "auth.totp.disabled", "SUCCEEDED", "2026-07-20T11:00:00.000Z"),
    audit("role", "access.role.permissions.update", "SUCCEEDED", "2026-07-29T10:00:00.000Z"),
  ]);
  const filtered = filterSecurityEvents(events, {
    category: "authentication",
    result: "FAILED",
    search: "ＰＡＳＳＷＯＲＤ",
    severity: "high",
    timeRange: "24h",
  }, now);

  assert.deepEqual(filtered.map((event) => event.id), ["recent"]);
});

test("security event summary stays tied to the audit records and action labels fall back safely", () => {
  const events = buildSecurityEvents([
    audit("recent", "auth.login.failed", "FAILED", "2026-07-29T11:00:00.000Z"),
    audit("older", "auth.totp.disabled", "SUCCEEDED", "2026-07-20T11:00:00.000Z"),
    audit("role", "access.role.permissions.update", "DENIED", "2026-07-29T10:00:00.000Z"),
  ]);

  assert.deepEqual(summarizeSecurityEvents(events, now), {
    total: 3,
    last24Hours: 2,
    needsReview: 2,
    deniedOrFailed: 2,
  });
  assert.equal(securityActionLabel("auth.login.failed", "zh"), "管理员登录失败");
  assert.equal(securityActionLabel("custom.audit.action", "en"), "custom.audit.action");
});
