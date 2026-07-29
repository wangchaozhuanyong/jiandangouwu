import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "../src/generated/prisma/client.js";
import { OrderReservationService } from "../src/orders/order-reservation.service.js";

const now = new Date("2026-07-29T12:30:00.000Z");

function reconciliationHarness(options: {
  candidates?: Array<{ id: string; productId: string }>;
  orderUpdateCount?: number;
  productUpdateCount?: number;
} = {}) {
  const candidates = options.candidates ?? [{
    id: "order-expired",
    productId: "product-finite",
  }];
  const orderUpdates: Array<Record<string, unknown>> = [];
  const productUpdates: Array<Record<string, unknown>> = [];
  const historyCreates: Array<Record<string, unknown>> = [];
  const auditCalls: Array<{ event: Record<string, unknown>; client: unknown }> = [];
  let candidateQuery: Record<string, unknown> | undefined;
  let transactionOptions: Record<string, unknown> | undefined;
  let transactionCalls = 0;

  const transaction = {
    order: {
      updateMany: async (input: Record<string, unknown>) => {
        orderUpdates.push(input);
        return { count: options.orderUpdateCount ?? 1 };
      },
    },
    product: {
      updateMany: async (input: Record<string, unknown>) => {
        productUpdates.push(input);
        return { count: options.productUpdateCount ?? 1 };
      },
    },
    orderStatusHistory: {
      create: async (input: { data: Record<string, unknown> }) => {
        historyCreates.push(input.data);
      },
    },
  };
  const prisma = {
    order: {
      findMany: async (input: Record<string, unknown>) => {
        candidateQuery = input;
        return candidates;
      },
    },
    $transaction: async (
      callback: (client: typeof transaction) => unknown,
      settings: Record<string, unknown>,
    ) => {
      transactionCalls += 1;
      transactionOptions = settings;
      return callback(transaction);
    },
  };
  const audit = {
    record: async (event: Record<string, unknown>, client: unknown) => {
      auditCalls.push({ event, client });
    },
  };
  return {
    service: new OrderReservationService(prisma as never, audit as never),
    transaction,
    candidateQuery: () => candidateQuery,
    transactionOptions: () => transactionOptions,
    transactionCalls: () => transactionCalls,
    orderUpdates,
    productUpdates,
    historyCreates,
    auditCalls,
  };
}

test("expired finite reservations are cancelled, restored, historized, and audited atomically", async () => {
  const harness = reconciliationHarness();
  const result = await harness.service.reconcileExpired(now);

  assert.deepEqual(result, {
    candidates: 1,
    cancelled: 1,
    stockRestored: 1,
  });
  assert.deepEqual(harness.candidateQuery(), {
    where: {
      status: "MANUAL_PENDING",
      inventoryReserved: true,
      inventoryReleasedAt: null,
      reservedUntil: { lte: now },
    },
    orderBy: [
      { reservedUntil: "asc" },
      { id: "asc" },
    ],
    take: 100,
    select: {
      id: true,
      productId: true,
    },
  });
  assert.deepEqual(harness.orderUpdates[0], {
    where: {
      id: "order-expired",
      status: "MANUAL_PENDING",
      inventoryReserved: true,
      inventoryReleasedAt: null,
      reservedUntil: { lte: now },
    },
    data: {
      status: "CANCELLED",
      inventoryReleasedAt: now,
    },
  });
  assert.deepEqual(harness.productUpdates[0], {
    where: {
      id: "product-finite",
      stockMode: "FINITE",
      stockQuantity: { not: null },
    },
    data: {
      stockQuantity: { increment: 1 },
      version: { increment: 1 },
    },
  });
  assert.deepEqual(harness.historyCreates, [{
    orderId: "order-expired",
    fromStatus: "MANUAL_PENDING",
    toStatus: "CANCELLED",
    reason: "Reservation expired before merchant confirmation",
  }]);
  assert.equal(harness.auditCalls.length, 1);
  assert.equal(harness.auditCalls[0]?.client, harness.transaction);
  assert.equal(harness.auditCalls[0]?.event.action, "order.reservation.expired");
  assert.deepEqual(harness.auditCalls[0]?.event.afterData, {
    status: "CANCELLED",
    inventoryReleasedAt: now.toISOString(),
    stockRestored: true,
  });
  assert.deepEqual(harness.transactionOptions(), {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
});

test("a losing concurrent scan performs no inventory, history, or audit side effects", async () => {
  const harness = reconciliationHarness({ orderUpdateCount: 0 });
  const result = await harness.service.reconcileExpired(now);

  assert.deepEqual(result, {
    candidates: 1,
    cancelled: 0,
    stockRestored: 0,
  });
  assert.equal(harness.productUpdates.length, 0);
  assert.equal(harness.historyCreates.length, 0);
  assert.equal(harness.auditCalls.length, 0);
});

test("an empty scan remains bounded and starts no write transaction", async () => {
  const harness = reconciliationHarness({ candidates: [] });
  const result = await harness.service.reconcileExpired(now);

  assert.deepEqual(result, {
    candidates: 0,
    cancelled: 0,
    stockRestored: 0,
  });
  assert.equal(harness.transactionCalls(), 0);
});

test("a later unlimited product still closes the reservation without inventing stock", async () => {
  const harness = reconciliationHarness({ productUpdateCount: 0 });
  const result = await harness.service.reconcileExpired(now);

  assert.deepEqual(result, {
    candidates: 1,
    cancelled: 1,
    stockRestored: 0,
  });
  assert.equal(harness.historyCreates.length, 1);
  assert.deepEqual(harness.auditCalls[0]?.event.afterData, {
    status: "CANCELLED",
    inventoryReleasedAt: now.toISOString(),
    stockRestored: false,
  });
});
