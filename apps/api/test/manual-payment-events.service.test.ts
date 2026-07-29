import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "../src/generated/prisma/client.js";
import { ManualPaymentEventsService } from "../src/finance/manual-payment-events.service.js";

const baseOrder = {
  id: "order-1",
  orderNumber: "CB-260728-ABC123",
  productNameSnapshot: "Midjourney",
  currencyCode: "CNY",
  amount: new Prisma.Decimal("119.16"),
  referenceCurrencyCode: "USDT",
  referenceAmount: new Prisma.Decimal("17.36"),
  exchangeRateSnapshot: new Prisma.Decimal("1.6200000000"),
  status: "REFUNDED" as const,
  assignedTo: {
    id: "admin-two",
    displayName: "Bob",
  },
  idempotencyKey: "must-not-leak",
  contactEncrypted: "encrypted-contact",
  contactHash: "contact-hash",
  maskedContact: "+60******18",
};

const historyRow = (
  id: string,
  toStatus: "PAID" | "REFUND_PENDING" | "REFUNDED" | "DISPUTED",
) => ({
  id,
  fromStatus: "PAYMENT_PROCESSING" as const,
  toStatus,
  reason: "人工复核后记录",
  createdAt: new Date("2026-07-28T12:00:00.000Z"),
  actor: {
    id: "admin-one",
    displayName: "Alice",
  },
  order: baseOrder,
});

test("manual payment events map stable event types and expose only safe fields", async () => {
  let select: Record<string, unknown> | undefined;
  const rows = [
    historyRow("history-paid", "PAID"),
    historyRow("history-review", "REFUND_PENDING"),
    historyRow("history-refunded", "REFUNDED"),
    historyRow("history-dispute", "DISPUTED"),
  ];
  const prisma = {
    orderStatusHistory: {
      count: async () => rows.length,
      findMany: async (input: { select: Record<string, unknown> }) => {
        select = input.select;
        return rows;
      },
    },
    currency: {
      findMany: async () => [
        { code: "CNY", digits: 2 },
        { code: "USDT", digits: 2 },
      ],
    },
    $transaction: async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
  };
  const service = new ManualPaymentEventsService(prisma as never);

  const result = await service.list({
    page: 1,
    pageSize: 30,
  });

  assert.deepEqual(
    result.data.map((event) => event.eventType),
    [
      "MANUALLY_RECORDED_PAID",
      "REFUND_REVIEW_STARTED",
      "MANUALLY_RECORDED_REFUNDED",
      "DISPUTE_REVIEW_STARTED",
    ],
  );
  assert.equal(
    result.data.every((event) => event.externalActionVerified === false),
    true,
  );
  assert.deepEqual(result.data[2], {
    statusHistoryId: "history-refunded",
    eventType: "MANUALLY_RECORDED_REFUNDED",
    fromStatus: "PAYMENT_PROCESSING",
    toStatus: "REFUNDED",
    orderId: "order-1",
    orderNumber: "CB-260728-ABC123",
    productNameSnapshot: "Midjourney",
    orderAmount: {
      amount: "119.16",
      currency: "CNY",
    },
    referenceAmount: {
      amount: "17.36",
      currency: "USDT",
    },
    exchangeRateSnapshot: "1.6200000000",
    currentStatus: "REFUNDED",
    currentAssignee: {
      id: "admin-two",
      displayName: "Bob",
    },
    actor: {
      id: "admin-one",
      displayName: "Alice",
    },
    reason: "人工复核后记录",
    recordedAt: "2026-07-28T12:00:00.000Z",
    externalActionVerified: false,
  });

  const orderSelect = (
    select?.order as { select?: Record<string, unknown> } | undefined
  )?.select;
  for (const sensitiveField of [
    "idempotencyKey",
    "contactEncrypted",
    "contactHash",
    "maskedContact",
  ]) {
    assert.equal(Object.hasOwn(orderSelect ?? {}, sensitiveField), false);
    assert.equal(JSON.stringify(result).includes(
      baseOrder[sensitiveField as keyof typeof baseOrder] as string,
    ), false);
  }
});

test("manual payment event filters and pagination are fully server-side", async () => {
  let countWhere: Record<string, unknown> | undefined;
  let findManyInput: Record<string, unknown> | undefined;
  const prisma = {
    orderStatusHistory: {
      count: async (input: { where: Record<string, unknown> }) => {
        countWhere = input.where;
        return 31;
      },
      findMany: async (input: Record<string, unknown>) => {
        findManyInput = input;
        return [];
      },
    },
    currency: {
      findMany: async () => [],
    },
    $transaction: async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
  };
  const service = new ManualPaymentEventsService(prisma as never);

  const result = await service.list({
    page: 2,
    pageSize: 30,
    search: "ABC123",
    eventType: "MANUALLY_RECORDED_REFUNDED",
    currencyCode: "CNY",
    actorId: "admin-one",
    assigneeId: "admin-two",
  });

  const expectedWhere = {
    toStatus: "REFUNDED",
    actorId: "admin-one",
    order: {
      currencyCode: "CNY",
      assignedToId: "admin-two",
    },
    OR: [
      { id: { contains: "ABC123" } },
      { order: { orderNumber: { contains: "ABC123" } } },
      { order: { productNameSnapshot: { contains: "ABC123" } } },
    ],
  };
  assert.deepEqual(countWhere, expectedWhere);
  assert.deepEqual(findManyInput?.where, expectedWhere);
  assert.equal(findManyInput?.skip, 30);
  assert.equal(findManyInput?.take, 30);
  assert.deepEqual(findManyInput?.orderBy, [
    { createdAt: "desc" },
    { id: "desc" },
  ]);
  assert.deepEqual(result.meta, {
    page: 2,
    pageSize: 30,
    total: 31,
    pageCount: 2,
  });
});
