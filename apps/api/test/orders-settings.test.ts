import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import { OrdersService } from "../src/orders/orders.service.js";

const input = {
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
};

const reservations = {
  reconcileExpired: async () => ({ candidates: 0, cancelled: 0, stockRestored: 0 }),
};

function orderHarness(
  settingsValue: unknown,
  activeChannel: boolean,
  publicAccount = "+60 12 888 6618",
) {
  let productReads = 0;
  const transaction = {
    siteSetting: {
      findUnique: async ({ where }: { where: { key: string } }) => ({
        key: where.key,
        value: where.key === "storefront.settings" ? settingsValue : "2026-07-27",
      }),
    },
    merchantChannel: {
      findFirst: async () => activeChannel ? {
        id: "channel-1",
        type: "WHATSAPP",
        mode: "DIRECT_LINK",
        publicAccount,
        directTarget: "https://wa.me/60128886618",
      } : null,
    },
    product: {
      findFirst: async () => {
        productReads += 1;
        return null;
      },
    },
  };
  const prisma = {
    order: {
      findUnique: async () => null,
    },
    $transaction: async (callback: (client: typeof transaction) => unknown) => callback(transaction),
  };
  const contacts = {
    protect: () => ({ encrypted: "encrypted", hash: "hash", masked: "***" }),
  };
  return {
    service: new OrdersService(
      prisma as never,
      contacts as never,
      reservations as never,
    ),
    productReads: () => productReads,
  };
}

test("paused ordering is rejected before product or stock access", async () => {
  const { service, productReads } = orderHarness({
    acceptOrders: false,
    policyVersion: "2026-07-27",
  }, true);
  await assert.rejects(service.create(input, "idempotency-key"), ConflictException);
  assert.equal(productReads(), 0);
});

test("missing order settings fail closed before product or stock access", async () => {
  const missing = orderHarness(null, true);
  await assert.rejects(missing.service.create(input, "missing-settings"), ConflictException);
  assert.equal(missing.productReads(), 0);
});

test("outdated policy and disabled channels are rejected before stock access", async () => {
  const outdated = orderHarness({
    acceptOrders: true,
    policyVersion: "2026-08-01",
  }, true);
  await assert.rejects(outdated.service.create(input, "outdated-policy"), ConflictException);
  assert.equal(outdated.productReads(), 0);

  const disabled = orderHarness({
    acceptOrders: true,
    policyVersion: "2026-07-27",
  }, false);
  await assert.rejects(disabled.service.create(input, "disabled-channel"), ConflictException);
  assert.equal(disabled.productReads(), 0);

  const placeholder = orderHarness({
    acceptOrders: true,
    policyVersion: "2026-07-27",
  }, true, "未配置");
  await assert.rejects(placeholder.service.create(input, "placeholder-channel"), ConflictException);
  assert.equal(placeholder.productReads(), 0);
});
