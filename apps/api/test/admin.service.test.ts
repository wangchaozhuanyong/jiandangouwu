import assert from "node:assert/strict";
import test from "node:test";
import { AdminService } from "../src/admin/admin.service.js";

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
  const service = new AdminService(prisma as never, { record: async () => undefined } as never);

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
