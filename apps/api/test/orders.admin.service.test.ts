import assert from "node:assert/strict";
import test from "node:test";
import type { OrderStatus } from "@cloudbridge/contracts";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma } from "../src/generated/prisma/client.js";
import {
  OrdersAdminService,
  orderTransitions,
} from "../src/orders/orders.admin.service.js";

const initialUpdatedAt = new Date("2026-07-28T12:00:00.000Z");
const committedUpdatedAt = new Date("2026-07-28T12:00:01.000Z");

type Assignee = {
  id: string;
  displayName: string;
};

type StatusHistoryRow = {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason: string | null;
  actor: Assignee | null;
  createdAt: Date;
};

const orderRow = (
  status: OrderStatus = "MANUAL_PENDING",
  assignedTo: Assignee | null = null,
) => ({
  id: "order-1",
  orderNumber: "CB-260728-ABC123",
  productId: "product-1",
  productNameSnapshot: "Midjourney",
  currencyCode: "CNY",
  amount: new Prisma.Decimal("119.16"),
  referenceCurrencyCode: "USDT",
  referenceAmount: new Prisma.Decimal("17.36"),
  contactChannel: "WHATSAPP" as const,
  maskedContact: "+60******18",
  status,
  paymentMode: "MANUAL" as const,
  reservedUntil: new Date("2026-07-28T12:30:00.000Z"),
  assignedTo,
  createdAt: new Date("2026-07-28T11:55:00.000Z"),
  updatedAt: new Date(initialUpdatedAt),
  exchangeRateSnapshot: new Prisma.Decimal("1.6200000000"),
  productVersion: 3,
  acceptedPolicyVersion: "2026-07-27",
  statusHistory: [] as StatusHistoryRow[],
});

const actor = () => ({
  userId: "admin-one",
  requestId: "request-123",
  ip: "127.0.0.1",
  reauthenticatedAt: Date.now(),
});

test("order list uses an explicit safe projection and returns the shared list contract", async () => {
  let select: Record<string, unknown> | undefined;
  let where: Record<string, unknown> | undefined;
  const row = {
    ...orderRow("CONTACTED", { id: "admin-one", displayName: "Alice" }),
    idempotencyKey: "must-not-leak",
    contactEncrypted: "ciphertext",
    contactHash: "contact-hash",
  };
  const prisma = {
    order: {
      count: async () => 1,
      findMany: async (input: {
        select: Record<string, unknown>;
        where: Record<string, unknown>;
      }) => {
        select = input.select;
        where = input.where;
        return [row];
      },
    },
    currency: {
      findMany: async () => [
        { code: "CNY", digits: 2 },
        { code: "USDT", digits: 2 },
      ],
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };
  const service = new OrdersAdminService(
    prisma as never,
    { record: async () => undefined } as never,
    { reveal: () => "" } as never,
  );

  const result = await service.list({
    page: 1,
    pageSize: 30,
    search: "ABC123",
    status: "CONTACTED",
    assigneeId: "admin-one",
    contactChannel: "WHATSAPP",
  });

  for (const secret of ["idempotencyKey", "contactEncrypted", "contactHash"]) {
    assert.equal(Object.hasOwn(select ?? {}, secret), false);
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.equal(JSON.stringify(result).includes(row[secret as keyof typeof row] as string), false);
  }
  assert.deepEqual(where, {
    status: "CONTACTED",
    contactChannel: "WHATSAPP",
    assignedToId: "admin-one",
    OR: [
      { orderNumber: { contains: "ABC123" } },
      { productNameSnapshot: { contains: "ABC123" } },
      { maskedContact: { contains: "ABC123" } },
    ],
  });
  assert.deepEqual(result.data[0], {
    id: "order-1",
    orderNumber: "CB-260728-ABC123",
    productId: "product-1",
    productNameSnapshot: "Midjourney",
    amount: { amount: "119.16", currency: "CNY" },
    referenceAmount: { amount: "17.36", currency: "USDT" },
    contactChannel: "WHATSAPP",
    maskedContact: "+60******18",
    status: "CONTACTED",
    paymentMode: "MANUAL",
    paymentStage: "NOT_RECORDED",
    reservedUntil: "2026-07-28T12:30:00.000Z",
    assignedTo: { id: "admin-one", displayName: "Alice" },
    createdAt: "2026-07-28T11:55:00.000Z",
    updatedAt: "2026-07-28T12:00:00.000Z",
  });
});

test("after-sales list scope uses a whitelisted status set and keeps pagination", async () => {
  let countWhere: Record<string, unknown> | undefined;
  let findManyInput: Record<string, unknown> | undefined;
  const prisma = {
    order: {
      count: async (input: { where: Record<string, unknown> }) => {
        countWhere = input.where;
        return 0;
      },
      findMany: async (input: Record<string, unknown>) => {
        findManyInput = input;
        return [];
      },
    },
    currency: {
      findMany: async () => [],
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };
  const service = new OrdersAdminService(
    prisma as never,
    { record: async () => undefined } as never,
    { reveal: () => "" } as never,
  );

  const result = await service.list({
    page: 2,
    pageSize: 30,
    scope: "AFTER_SALES",
  });

  const expectedWhere = {
    status: {
      in: ["REFUND_PENDING", "REFUNDED", "DISPUTED"],
    },
  };
  assert.deepEqual(countWhere, expectedWhere);
  assert.deepEqual(findManyInput?.where, expectedWhere);
  assert.equal(findManyInput?.skip, 30);
  assert.equal(findManyInput?.take, 30);
  assert.deepEqual(result.meta, {
    page: 2,
    pageSize: 30,
    total: 0,
    pageCount: 0,
  });
});

test("after-sales list scope rejects an incompatible status before querying", async () => {
  let queried = false;
  const prisma = {
    order: {
      count: async () => {
        queried = true;
        return 0;
      },
      findMany: async () => {
        queried = true;
        return [];
      },
    },
    currency: {
      findMany: async () => {
        queried = true;
        return [];
      },
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };
  const service = new OrdersAdminService(
    prisma as never,
    { record: async () => undefined } as never,
    { reveal: () => "" } as never,
  );

  await assert.rejects(
    service.list({
      page: 1,
      pageSize: 30,
      scope: "AFTER_SALES",
      status: "CONTACTED",
    }),
    BadRequestException,
  );
  assert.equal(queried, false);
});

function statusHarness(updateCount = 1) {
  const row = orderRow();
  const updateCalls: Array<Record<string, unknown>> = [];
  const historyCalls: Array<Record<string, unknown>> = [];
  const auditCalls: Array<{
    event: Record<string, unknown>;
    client: unknown;
  }> = [];
  let transactionOptions: Record<string, unknown> | undefined;

  const transaction = {
    order: {
      findUnique: async (input: { select: Record<string, unknown> }) => {
        if (Object.hasOwn(input.select, "statusHistory")) return row;
        return {
          id: row.id,
          status: "MANUAL_PENDING" as const,
          updatedAt: initialUpdatedAt,
        };
      },
      updateMany: async (input: {
        where: Record<string, unknown>;
        data: { status: OrderStatus };
      }) => {
        updateCalls.push(input as unknown as Record<string, unknown>);
        if (updateCount === 1) {
          row.status = input.data.status;
          row.updatedAt = new Date(committedUpdatedAt);
        }
        return { count: updateCount };
      },
    },
    orderStatusHistory: {
      create: async (input: { data: Record<string, unknown> }) => {
        historyCalls.push(input.data);
        row.statusHistory.push({
          id: "history-2",
          fromStatus: input.data.fromStatus as OrderStatus,
          toStatus: input.data.toStatus as OrderStatus,
          reason: input.data.reason as string,
          actor: { id: "admin-one", displayName: "Alice" },
          createdAt: committedUpdatedAt,
        });
      },
    },
    currency: {
      findMany: async () => [
        { code: "CNY", digits: 2 },
        { code: "USDT", digits: 2 },
      ],
    },
  };
  const prisma = {
    $transaction: async (
      callback: (client: typeof transaction) => unknown,
      options: Record<string, unknown>,
    ) => {
      transactionOptions = options;
      return callback(transaction);
    },
  };
  const audit = {
    record: async (event: Record<string, unknown>, client: unknown) => {
      auditCalls.push({ event, client });
    },
  };
  return {
    service: new OrdersAdminService(
      prisma as never,
      audit as never,
      { reveal: () => "" } as never,
    ),
    transaction,
    transactionOptions: () => transactionOptions,
    updateCalls,
    historyCalls,
    auditCalls,
  };
}

const updateStatusInput = (status: OrderStatus = "CONTACTED") => ({
  expectedStatus: "MANUAL_PENDING" as const,
  expectedUpdatedAt: initialUpdatedAt.toISOString(),
  status,
  reason: "客服已经确认联系方式",
});

test("status transition uses CAS and writes history and audit through one transaction client", async () => {
  const harness = statusHarness();
  assert.deepEqual(orderTransitions.MANUAL_PENDING, ["CONTACTED", "CANCELLED"]);

  const result = await harness.service.updateStatus(
    "order-1",
    updateStatusInput(),
    actor(),
  );

  assert.equal(result.status, "CONTACTED");
  assert.deepEqual(result.allowedTransitions, ["AWAITING_PAYMENT", "CANCELLED"]);
  assert.deepEqual(harness.updateCalls[0]?.where, {
    id: "order-1",
    status: "MANUAL_PENDING",
    updatedAt: initialUpdatedAt,
  });
  assert.deepEqual(harness.historyCalls, [{
    orderId: "order-1",
    fromStatus: "MANUAL_PENDING",
    toStatus: "CONTACTED",
    reason: "客服已经确认联系方式",
    actorId: "admin-one",
  }]);
  assert.equal(harness.auditCalls.length, 1);
  assert.equal(harness.auditCalls[0]?.client, harness.transaction);
  assert.deepEqual(harness.auditCalls[0]?.event.afterData, {
    status: "CONTACTED",
    externalActionVerified: false,
  });
  assert.deepEqual(harness.transactionOptions(), {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
});

test("status mutation rejects illegal transitions and CAS conflicts before history or audit", async () => {
  const illegal = statusHarness();
  await assert.rejects(
    illegal.service.updateStatus(
      "order-1",
      updateStatusInput("PAID"),
      actor(),
    ),
    ConflictException,
  );
  assert.equal(illegal.updateCalls.length, 0);
  assert.equal(illegal.historyCalls.length, 0);
  assert.equal(illegal.auditCalls.length, 0);

  const stale = statusHarness(0);
  await assert.rejects(
    stale.service.updateStatus(
      "order-1",
      updateStatusInput(),
      actor(),
    ),
    ConflictException,
  );
  assert.equal(stale.updateCalls.length, 1);
  assert.equal(stale.historyCalls.length, 0);
  assert.equal(stale.auditCalls.length, 0);
});

function assignmentHarness(options: {
  eligible?: boolean;
  updateCount?: number;
} = {}) {
  const eligible = options.eligible ?? true;
  const updateCount = options.updateCount ?? 1;
  const row = orderRow("CONTACTED");
  const assigneeReads: Array<Record<string, unknown>> = [];
  const updateCalls: Array<Record<string, unknown>> = [];
  const auditCalls: Array<{
    event: Record<string, unknown>;
    client: unknown;
  }> = [];
  const transaction = {
    order: {
      findUnique: async (input: { select: Record<string, unknown> }) => {
        if (Object.hasOwn(input.select, "statusHistory")) return row;
        return {
          id: row.id,
          assignedToId: null,
          updatedAt: initialUpdatedAt,
        };
      },
      updateMany: async (input: {
        where: Record<string, unknown>;
        data: { assignedToId: string | null };
      }) => {
        updateCalls.push(input as unknown as Record<string, unknown>);
        if (updateCount === 1) {
          row.assignedTo = input.data.assignedToId
            ? { id: input.data.assignedToId, displayName: "Bob" }
            : null;
          row.updatedAt = new Date(committedUpdatedAt);
        }
        return { count: updateCount };
      },
    },
    adminUser: {
      findFirst: async (input: { where: Record<string, unknown> }) => {
        assigneeReads.push(input.where);
        return eligible ? { id: "admin-two" } : null;
      },
    },
    currency: {
      findMany: async () => [
        { code: "CNY", digits: 2 },
        { code: "USDT", digits: 2 },
      ],
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof transaction) => unknown) =>
      callback(transaction),
  };
  const audit = {
    record: async (event: Record<string, unknown>, client: unknown) => {
      auditCalls.push({ event, client });
    },
  };
  return {
    service: new OrdersAdminService(
      prisma as never,
      audit as never,
      { reveal: () => "" } as never,
    ),
    transaction,
    assigneeReads,
    updateCalls,
    auditCalls,
  };
}

const assignmentInput = () => ({
  assigneeId: "admin-two",
  expectedAssigneeId: null,
  expectedUpdatedAt: initialUpdatedAt.toISOString(),
  reason: "转交给当班订单管理员",
});

test("assignment requires an active orders.write admin and uses CAS plus transactional audit", async () => {
  const harness = assignmentHarness();
  const result = await harness.service.updateAssignment(
    "order-1",
    assignmentInput(),
    actor(),
  );

  assert.deepEqual(harness.assigneeReads[0], {
    id: "admin-two",
    status: "ACTIVE",
    roles: {
      some: {
        role: {
          permissions: {
            some: {
              permission: {
                key: "orders.write",
              },
            },
          },
        },
      },
    },
  });
  assert.deepEqual(harness.updateCalls[0]?.where, {
    id: "order-1",
    assignedToId: null,
    updatedAt: initialUpdatedAt,
  });
  assert.deepEqual(result.assignedTo, {
    id: "admin-two",
    displayName: "Bob",
  });
  assert.equal(harness.auditCalls[0]?.client, harness.transaction);
  assert.deepEqual(harness.auditCalls[0]?.event.beforeData, {
    assigneeId: null,
  });
  assert.deepEqual(harness.auditCalls[0]?.event.afterData, {
    assigneeId: "admin-two",
  });
});

test("assignment rejects unavailable assignees and CAS conflicts without audit", async () => {
  const unavailable = assignmentHarness({ eligible: false });
  await assert.rejects(
    unavailable.service.updateAssignment(
      "order-1",
      assignmentInput(),
      actor(),
    ),
    BadRequestException,
  );
  assert.equal(unavailable.updateCalls.length, 0);
  assert.equal(unavailable.auditCalls.length, 0);

  const stale = assignmentHarness({ updateCount: 0 });
  await assert.rejects(
    stale.service.updateAssignment(
      "order-1",
      assignmentInput(),
      actor(),
    ),
    ConflictException,
  );
  assert.equal(stale.updateCalls.length, 1);
  assert.equal(stale.auditCalls.length, 0);
});

test("contact reveal audits stale reauthentication denial without reading contact data", async () => {
  let orderReads = 0;
  let reveals = 0;
  const auditEvents: Array<Record<string, unknown>> = [];
  const service = new OrdersAdminService(
    {
      order: {
        findUnique: async () => {
          orderReads += 1;
          return null;
        },
      },
    } as never,
    {
      record: async (event: Record<string, unknown>) => {
        auditEvents.push(event);
      },
    } as never,
    {
      reveal: () => {
        reveals += 1;
        return "customer@example.com";
      },
    } as never,
  );

  await assert.rejects(
    service.revealContact(
      "order-1",
      { reason: "处理订单需要联系客户" },
      {
        ...actor(),
        reauthenticatedAt: Date.now() - 6 * 60_000,
      },
    ),
    ForbiddenException,
  );

  assert.equal(orderReads, 0);
  assert.equal(reveals, 0);
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0]?.result, "DENIED");
  assert.equal(auditEvents[0]?.reason, "处理订单需要联系客户");
});

test("successful contact reveal selects only encrypted contact fields and never audits plaintext", async () => {
  let select: Record<string, unknown> | undefined;
  const auditEvents: Array<Record<string, unknown>> = [];
  const plaintext = "customer@example.com";
  const service = new OrdersAdminService(
    {
      order: {
        findUnique: async (input: { select: Record<string, unknown> }) => {
          select = input.select;
          return {
            contactEncrypted: "encrypted-contact",
            contactChannel: "EMAIL",
          };
        },
      },
    } as never,
    {
      record: async (event: Record<string, unknown>) => {
        auditEvents.push(event);
      },
    } as never,
    {
      reveal: () => plaintext,
    } as never,
  );

  const result = await service.revealContact(
    "order-1",
    { reason: "处理订单需要联系客户" },
    actor(),
  );

  assert.deepEqual(select, {
    contactEncrypted: true,
    contactChannel: true,
  });
  assert.deepEqual(result, {
    contact: plaintext,
    channel: "EMAIL",
  });
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0]?.result, "SUCCEEDED");
  assert.equal(auditEvents[0]?.reason, "处理订单需要联系客户");
  assert.equal(JSON.stringify(auditEvents).includes(plaintext), false);
  assert.equal(JSON.stringify(auditEvents).includes("encrypted-contact"), false);
});
