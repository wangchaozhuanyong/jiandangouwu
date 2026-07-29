import assert from "node:assert/strict";
import test from "node:test";
import type { AuditEvent } from "../src/api";
import {
  auditActionLabel,
  auditFilterFromQuery,
  auditQueryFromFilter,
  auditQuerySearch,
  auditTargetTypes,
  filterAuditEvents,
  readAuditQuery,
  sortAuditEvents,
  summarizeAuditEvents,
  type AuditEventFilter,
} from "../src/features/audit/model";

const audit = (
  id: string,
  action: string,
  createdAt: string,
  overrides: Partial<AuditEvent> = {},
): AuditEvent => ({
  id,
  requestId: `request-${id}`,
  action,
  targetType: "Order",
  targetId: `target-${id}`,
  result: "SUCCEEDED",
  reason: null,
  actor: { displayName: "Operator", email: "operator@example.com" },
  createdAt,
  ...overrides,
});

const defaultFilter: AuditEventFilter = {
  actor: "all",
  result: "all",
  search: "",
  targetType: "all",
  timeRange: "all",
};

test("audit URL query restores only supported server filters and serializes canonically", () => {
  const query = readAuditQuery(
    "?page=3&search=%20ORDER-7%20&result=DENIED&actor=administrator"
    + "&targetType=Order&timeRange=7d&pageSize=999",
  );
  assert.deepEqual(query, {
    page: 3,
    pageSize: 30,
    search: "ORDER-7",
    result: "DENIED",
    actor: "administrator",
    targetType: "Order",
    timeRange: "7d",
  });
  assert.equal(
    auditQuerySearch(query),
    "page=3&search=ORDER-7&result=DENIED&actor=administrator&targetType=Order&timeRange=7d",
  );
  assert.deepEqual(auditFilterFromQuery(query), {
    actor: "administrator",
    result: "DENIED",
    search: "ORDER-7",
    targetType: "Order",
    timeRange: "7d",
  });
  assert.deepEqual(auditQueryFromFilter(defaultFilter), {
    page: 1,
    pageSize: 30,
    timeRange: "all",
  });
});

test("audit URL query rejects unsupported state without propagating it to the API", () => {
  const query = readAuditQuery(
    "?page=0&result=UNKNOWN&actor=owner&timeRange=forever&targetType=%20%20",
  );
  assert.deepEqual(query, {
    page: 1,
    pageSize: 30,
    timeRange: "30d",
  });
  assert.equal(auditQuerySearch(query), "");
});

test("audit records sort deterministically and list unique target types", () => {
  const events = sortAuditEvents([
    audit("older", "product.update", "2026-07-28T08:00:00.000Z", { targetType: "Product" }),
    audit("same-a", "order.status.update", "2026-07-29T08:00:00.000Z"),
    audit("same-b", "order.status.update", "2026-07-29T08:00:00.000Z"),
    audit("invalid", "unknown", "not-a-date", { targetType: "Product" }),
  ]);

  assert.deepEqual(events.map((event) => event.id), ["same-b", "same-a", "older", "invalid"]);
  assert.deepEqual(auditTargetTypes(events), ["Order", "Product"]);
});

test("audit filters use real loaded fields and localized action labels", () => {
  const now = Date.parse("2026-07-29T12:00:00.000Z");
  const events = sortAuditEvents([
    audit("admin", "order.status.update", "2026-07-29T11:00:00.000Z"),
    audit("system", "auth.login.failed", "2026-07-29T10:00:00.000Z", {
      actor: null,
      result: "FAILED",
      targetType: "AdminUser",
    }),
    audit("old", "product.update", "2026-06-01T10:00:00.000Z"),
  ]);

  assert.deepEqual(
    filterAuditEvents(events, { ...defaultFilter, actor: "system" }, now).map((event) => event.id),
    ["system"],
  );
  assert.deepEqual(
    filterAuditEvents(events, { ...defaultFilter, result: "FAILED" }, now).map((event) => event.id),
    ["system"],
  );
  assert.deepEqual(
    filterAuditEvents(events, { ...defaultFilter, targetType: "AdminUser" }, now).map((event) => event.id),
    ["system"],
  );
  assert.deepEqual(
    filterAuditEvents(events, { ...defaultFilter, timeRange: "24h" }, now).map((event) => event.id),
    ["admin", "system"],
  );
  assert.deepEqual(
    filterAuditEvents(events, { ...defaultFilter, search: "订单状态已更新" }, now).map((event) => event.id),
    ["admin"],
  );
  assert.deepEqual(
    filterAuditEvents(events, { ...defaultFilter, search: "request-system" }, now).map((event) => event.id),
    ["system"],
  );
});

test("audit summaries distinguish the loaded window from the database total", () => {
  const now = Date.parse("2026-07-29T12:00:00.000Z");
  const summary = summarizeAuditEvents([
    audit("recent", "order.status.update", "2026-07-29T11:00:00.000Z"),
    audit("failed", "auth.login.failed", "2026-07-29T10:00:00.000Z", { result: "FAILED" }),
    audit("older", "product.update", "2026-07-20T10:00:00.000Z"),
  ], 142, now);

  assert.deepEqual(summary, {
    deniedOrFailed: 1,
    last24Hours: 2,
    loaded: 3,
    totalAvailable: 142,
  });
});

test("audit action labels fall back to stable action codes", () => {
  assert.equal(auditActionLabel("product.update", "zh"), "商品已更新");
  assert.equal(auditActionLabel("custom.audit.action", "en"), "custom.audit.action");
});
