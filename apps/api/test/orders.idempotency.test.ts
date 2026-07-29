import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import { Prisma } from "../src/generated/prisma/client.js";
import { OrdersService } from "../src/orders/orders.service.js";

const input = () => ({
  locale: "zh" as const,
  productId: "product-1",
  currency: "CNY",
  contactChannel: "WHATSAPP" as const,
  contactValue: "+60128886618",
  acceptedPolicyVersion: "2026-07-27",
  expectedPrice: {
    amount: "119.16",
    currency: "CNY",
  },
});

const existingOrder = () => ({
  id: "order-1",
  orderNumber: "CB-260728-ABC123",
  idempotencyKey: "idempotency-key-0001",
  productId: "product-1",
  productNameSnapshot: "Midjourney",
  currencyCode: "CNY",
  amount: new Prisma.Decimal("119.16"),
  referenceCurrencyCode: "USDT",
  referenceAmount: new Prisma.Decimal("17.36"),
  exchangeRateSnapshot: new Prisma.Decimal("1.6200000000"),
  productVersion: 3,
  contactChannel: "WHATSAPP" as const,
  contactEncrypted: "encrypted",
  contactHash: "same-contact-hash",
  maskedContact: "+60******18",
  acceptedPolicyVersion: "2026-07-27",
  status: "MANUAL_PENDING" as const,
  paymentMode: "MANUAL" as const,
  reservedUntil: new Date("2026-07-28T12:30:00.000Z"),
  assignedToId: null,
  createdAt: new Date("2026-07-28T12:00:00.000Z"),
  updatedAt: new Date("2026-07-28T12:00:00.000Z"),
});

function replayHarness() {
  let transactionCalls = 0;
  const prisma = {
    order: {
      findUnique: async () => existingOrder(),
    },
    currency: {
      findMany: async () => [
        { code: "CNY", digits: 2 },
        { code: "USDT", digits: 2 },
      ],
    },
    $transaction: async () => {
      transactionCalls += 1;
      throw new Error("idempotent replay must not start a write transaction");
    },
  };
  const contacts = {
    protect: () => ({
      encrypted: "new-random-ciphertext",
      hash: "same-contact-hash",
      masked: "+60******18",
    }),
  };
  return {
    service: new OrdersService(prisma as never, contacts as never),
    transactionCalls: () => transactionCalls,
  };
}

test("same idempotency key and payload reuses the original receipt", async () => {
  const harness = replayHarness();
  const receipt = await harness.service.create(
    input(),
    "idempotency-key-0001",
  );

  assert.equal(harness.transactionCalls(), 0);
  assert.deepEqual(receipt, {
    orderNumber: "CB-260728-ABC123",
    status: "MANUAL_PENDING",
    productName: "Midjourney",
    amount: {
      amount: "119.16",
      currency: "CNY",
    },
    referenceAmount: {
      amount: "17.36",
      currency: "USDT",
    },
    contactChannel: "WHATSAPP",
    maskedContact: "+60******18",
    reservedUntil: "2026-07-28T12:30:00.000Z",
  });
});

test("same idempotency key with a different payload returns conflict", async () => {
  const harness = replayHarness();
  for (const changed of [
    { ...input(), productId: "product-2" },
    { ...input(), currency: "USD", expectedPrice: { amount: "28.00", currency: "USD" } },
    { ...input(), acceptedPolicyVersion: "2026-08-01" },
  ]) {
    await assert.rejects(
      harness.service.create(changed, "idempotency-key-0001"),
      (error: unknown) => (
        error instanceof ConflictException
        && error.getStatus() === 409
      ),
    );
  }
  assert.equal(harness.transactionCalls(), 0);
});
