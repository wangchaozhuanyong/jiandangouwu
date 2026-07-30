import assert from "node:assert/strict";
import test from "node:test";
import { securityAuditActions } from "@cloudbridge/contracts";
import { AdminService } from "../src/admin/admin.service.js";

const reservations = {
  reconcileExpired: async () => ({ candidates: 0, cancelled: 0, stockRestored: 0 }),
};

test("product listing applies one deterministic server filter to count and page queries", async () => {
  let countQuery: Record<string, unknown> | null = null;
  let findManyQuery: Record<string, unknown> | null = null;
  const updatedAt = new Date("2026-07-29T10:00:00.000Z");
  const prisma = {
    product: {
      count: async (query: Record<string, unknown>) => {
        countQuery = query;
        return 11;
      },
      findMany: async (query: Record<string, unknown>) => {
        findManyQuery = query;
        return [{
          id: "product-codex",
          slug: "codex",
          imageKey: "/assets/product-codex.webp",
          basePrice: { toFixed: () => "89.00" },
          compareAtPrice: null,
          stockMode: "FINITE",
          stockQuantity: 12,
          status: "ACTIVE",
          sortOrder: 1,
          version: 2,
          category: {
            id: "category-development",
            slug: "development",
            translations: [
              { locale: "ZH", name: "编码开发" },
              { locale: "EN", name: "Coding" },
            ],
          },
          translations: [
            {
              locale: "ZH",
              name: "OpenAI Codex 专业版",
              kicker: "开发工作流",
              description: "中文说明",
            },
            {
              locale: "EN",
              name: "OpenAI Codex Professional",
              kicker: "Developer workflow",
              description: "English description",
            },
          ],
          updatedAt,
        }];
      },
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };
  const service = new AdminService(
    prisma as never,
    { record: async () => undefined } as never,
    reservations as never,
  );

  const result = await service.products({
    page: 2,
    pageSize: 10,
    search: "  CoDeX  ",
  });

  assert.ok(countQuery);
  assert.ok(findManyQuery);
  const count = countQuery as Record<string, unknown>;
  const list = findManyQuery as Record<string, unknown>;
  assert.deepEqual(count.where, {
    status: { not: "ARCHIVED" },
    OR: [
      { slug: { contains: "codex" } },
      { translations: { some: { normalizedName: { contains: "codex" } } } },
    ],
  });
  assert.deepEqual(list.where, count.where);
  assert.deepEqual(list.orderBy, [
    { sortOrder: "asc" },
    { updatedAt: "desc" },
    { id: "asc" },
  ]);
  assert.equal(list.skip, 10);
  assert.equal(list.take, 10);
  assert.deepEqual(result.meta, {
    page: 2,
    pageSize: 10,
    total: 11,
    pageCount: 2,
  });
  assert.equal(result.data[0]?.basePrice, "89.00");
  assert.equal(result.data[0]?.translations.zh?.name, "OpenAI Codex 专业版");
});

test("audit listing projects an explicit frontend-safe field allowlist", async () => {
  let countQuery: Record<string, unknown> | null = null;
  let findManyQuery: Record<string, unknown> | null = null;
  let groupByQuery: Record<string, unknown> | null = null;
  const row = {
    id: "audit-1",
    requestId: "request-1",
    action: "product.update",
    targetType: "Product",
    targetId: "product-1",
    result: "SUCCEEDED" as const,
    reason: "Approved catalog correction",
    createdAt: new Date("2026-07-29T10:00:00.000Z"),
    actor: {
      displayName: "Catalog operator",
      email: "operator@example.com",
    },
  };
  const prisma = {
    auditEvent: {
      count: async (query: Record<string, unknown>) => {
        countQuery = query;
        return 11;
      },
      findMany: async (query: Record<string, unknown>) => {
        findManyQuery = query;
        return [row];
      },
      groupBy: async (query: Record<string, unknown>) => {
        groupByQuery = query;
        return [{ targetType: "Order" }, { targetType: "Product" }];
      },
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };
  const service = new AdminService(
    prisma as never,
    { record: async () => undefined } as never,
    reservations as never,
  );

  const result = await service.auditEvents({
    page: 2,
    pageSize: 10,
    search: "operator",
    result: "SUCCEEDED",
    actor: "administrator",
    targetType: "Product",
    timeRange: "all",
  });

  assert.deepEqual(result, {
    data: {
      items: [row],
      facets: {
        targetTypes: ["Order", "Product"],
      },
    },
    meta: {
      page: 2,
      pageSize: 10,
      total: 11,
      pageCount: 2,
    },
  });
  assert.ok(countQuery);
  const countQueryRecord = countQuery as unknown as Record<string, unknown>;
  assert.deepEqual(countQueryRecord.where, {
    result: "SUCCEEDED",
    actorId: { not: null },
    targetType: "Product",
    OR: [
      { id: { contains: "operator" } },
      { requestId: { contains: "operator" } },
      { action: { contains: "operator" } },
      { targetType: { contains: "operator" } },
      { targetId: { contains: "operator" } },
      { reason: { contains: "operator" } },
      {
        actor: {
          is: {
            OR: [
              { displayName: { contains: "operator" } },
              { email: { contains: "operator" } },
            ],
          },
        },
      },
    ],
  });
  assert.ok(findManyQuery);
  const query = findManyQuery as Record<string, unknown>;
  assert.deepEqual(query.where, countQueryRecord.where);
  assert.equal(query.skip, 10);
  assert.equal(query.take, 10);
  assert.deepEqual(query.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  assert.deepEqual(query.select, {
    id: true,
    requestId: true,
    action: true,
    targetType: true,
    targetId: true,
    result: true,
    reason: true,
    createdAt: true,
    actor: {
      select: {
        displayName: true,
        email: true,
      },
    },
  });
  assert.equal(Object.hasOwn(query, "include"), false);
  assert.equal(Object.hasOwn(query.select as object, "beforeData"), false);
  assert.equal(Object.hasOwn(query.select as object, "afterData"), false);
  assert.equal(Object.hasOwn(query.select as object, "ipHash"), false);
  assert.deepEqual(groupByQuery, {
    by: ["targetType"],
    orderBy: { targetType: "asc" },
  });
});

test("security audit scope filters before paging and returns full-history summary", async () => {
  const countQueries: Array<Record<string, unknown>> = [];
  const countResults = [2, 10, 3, 4, 5];
  let findManyQuery: Record<string, unknown> | null = null;
  const row = {
    id: "audit-sites-setting",
    requestId: "request-sites-setting",
    action: "settings.storefront.updated",
    targetType: "SETTINGS",
    targetId: "storefront",
    result: "SUCCEEDED" as const,
    reason: "Approved setting change",
    createdAt: new Date("2026-07-29T10:00:00.000Z"),
    actor: {
      displayName: "Sites administrator",
      email: "operator@example.com",
    },
  };
  const prisma = {
    auditEvent: {
      count: async (query: Record<string, unknown>) => {
        countQueries.push(query);
        return countResults[countQueries.length - 1] ?? 0;
      },
      findMany: async (query: Record<string, unknown>) => {
        findManyQuery = query;
        return [row];
      },
      groupBy: async () => [{ targetType: "SETTINGS" }],
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };
  const service = new AdminService(
    prisma as never,
    { record: async () => undefined } as never,
    reservations as never,
  );

  const result = await service.auditEvents({
    page: 1,
    pageSize: 30,
    scope: "security",
    category: "configuration",
    severity: "medium",
    timeRange: "30d",
  });

  assert.deepEqual(result, {
    data: {
      items: [row],
      facets: {
        targetTypes: ["SETTINGS"],
        securitySummary: {
          total: 10,
          last24Hours: 3,
          needsReview: 4,
          deniedOrFailed: 5,
        },
      },
    },
    meta: {
      page: 1,
      pageSize: 30,
      total: 2,
      pageCount: 1,
    },
  });
  assert.equal(countQueries.length, 5);
  assert.ok(findManyQuery);
  const pageWhere = (findManyQuery as Record<string, unknown>).where;
  assert.deepEqual(pageWhere, countQueries[0]?.where);
  const serializedPageWhere = JSON.stringify(pageWhere);
  assert.match(serializedPageWhere, /settings\.storefront\.updated/u);
  assert.match(serializedPageWhere, /support\.channel\.updated/u);
  assert.match(serializedPageWhere, /SUCCEEDED/u);
  assert.match(serializedPageWhere, /createdAt/u);
  const scopeWhere = JSON.stringify(countQueries[1]?.where);
  assert.match(scopeWhere, /DENIED/u);
  for (const action of [
    "auth.sites.bootstrap",
    "order.contact.revealed",
    "notifications.telegram.intent.updated",
  ]) {
    assert.ok(securityAuditActions.includes(action));
    assert.match(scopeWhere, new RegExp(action.replaceAll(".", "\\."), "u"));
  }
  assert.match(JSON.stringify(countQueries[2]?.where), /createdAt/u);
  assert.doesNotMatch(JSON.stringify(countQueries[3]?.where), /createdAt/u);
  assert.match(JSON.stringify(countQueries[4]?.where), /FAILED/u);
});

test("audit CSV export uses the safe allowlist, neutralizes formulas, and audits success", async () => {
  let findManyQuery: Record<string, unknown> | null = null;
  const auditRecords: Array<Record<string, unknown>> = [];
  const prisma = {
    auditEvent: {
      count: async () => 1,
      findMany: async (query: Record<string, unknown>) => {
        findManyQuery = query;
        return [{
          id: "audit-export-source",
          requestId: "request-source",
          action: "=HYPERLINK(\"https://invalid.example\")",
          targetType: "Product",
          targetId: "-1",
          result: "DENIED" as const,
          reason: "@unsafe",
          createdAt: new Date("2026-07-29T10:00:00.000Z"),
          actor: {
            displayName: "+Operator",
            email: "operator@example.test",
          },
        }];
      },
    },
  };
  const service = new AdminService(
    prisma as never,
    { record: async (input: Record<string, unknown>) => { auditRecords.push(input); } } as never,
    reservations as never,
  );

  const result = await service.exportAuditEvents({
    result: "DENIED",
    timeRange: "all",
    reason: "Approved security review",
    confirmation: "EXPORT_AUDIT_CSV",
  }, {
    userId: "admin-1",
    requestId: "request-export",
    reauthenticatedAt: Date.now(),
  });

  assert.equal(result.recordCount, 1);
  assert.match(result.filename, /^cloudbridge-audit-\d{4}-\d{2}-\d{2}-\d{6}Z\.csv$/u);
  assert.equal(result.csv.startsWith("\uFEFF\"event_id\""), true);
  assert.equal(result.csv.includes("\"'=HYPERLINK(\"\"https://invalid.example\"\")\""), true);
  assert.equal(result.csv.includes("\"'+Operator\""), true);
  assert.equal(result.csv.includes("\"'-1\""), true);
  assert.equal(result.csv.includes("\"'@unsafe\""), true);
  assert.ok(findManyQuery);
  const query = findManyQuery as Record<string, unknown>;
  assert.equal(query.take, 5_001);
  assert.equal(Object.hasOwn(query.select as object, "beforeData"), false);
  assert.equal(Object.hasOwn(query.select as object, "afterData"), false);
  assert.equal(Object.hasOwn(query.select as object, "ipHash"), false);
  assert.equal(auditRecords.length, 1);
  assert.equal(auditRecords[0]?.action, "audit.export.csv");
  assert.equal(auditRecords[0]?.result, "SUCCEEDED");
});

test("audit CSV export fails closed when recent authentication expired", async () => {
  const auditRecords: Array<Record<string, unknown>> = [];
  let countCalled = false;
  const service = new AdminService(
    {
      auditEvent: {
        count: async () => {
          countCalled = true;
          return 0;
        },
      },
    } as never,
    { record: async (input: Record<string, unknown>) => { auditRecords.push(input); } } as never,
    reservations as never,
  );

  await assert.rejects(service.exportAuditEvents({
    reason: "Approved security review",
    confirmation: "EXPORT_AUDIT_CSV",
  }, {
    userId: "admin-1",
    requestId: "request-expired",
    reauthenticatedAt: Date.now() - 6 * 60_000,
  }), /Recent reauthentication is required/u);
  assert.equal(countCalled, false);
  assert.equal(auditRecords[0]?.result, "DENIED");
});

test("audit CSV export refuses filters above the server record limit", async () => {
  const auditRecords: Array<Record<string, unknown>> = [];
  let findManyCalled = false;
  const service = new AdminService(
    {
      auditEvent: {
        count: async () => 5_001,
        findMany: async () => {
          findManyCalled = true;
          return [];
        },
      },
    } as never,
    { record: async (input: Record<string, unknown>) => { auditRecords.push(input); } } as never,
    reservations as never,
  );

  await assert.rejects(service.exportAuditEvents({
    reason: "Approved security review",
    confirmation: "EXPORT_AUDIT_CSV",
  }, {
    userId: "admin-1",
    requestId: "request-too-large",
    reauthenticatedAt: Date.now(),
  }), /Narrow the filter before exporting/u);
  assert.equal(findManyCalled, false);
  assert.equal(auditRecords[0]?.result, "DENIED");
});
