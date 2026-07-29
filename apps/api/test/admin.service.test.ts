import assert from "node:assert/strict";
import test from "node:test";
import { AdminService } from "../src/admin/admin.service.js";

test("audit listing projects an explicit frontend-safe field allowlist", async () => {
  let findManyQuery: Record<string, unknown> | null = null;
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
      count: async () => 11,
      findMany: async (query: Record<string, unknown>) => {
        findManyQuery = query;
        return [row];
      },
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };
  const service = new AdminService(prisma as never, { record: async () => undefined } as never);

  const result = await service.auditEvents({ page: 2, pageSize: 10 });

  assert.deepEqual(result, {
    data: [row],
    meta: {
      page: 2,
      pageSize: 10,
      total: 11,
      pageCount: 2,
    },
  });
  assert.ok(findManyQuery);
  const query = findManyQuery as Record<string, unknown>;
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
});
