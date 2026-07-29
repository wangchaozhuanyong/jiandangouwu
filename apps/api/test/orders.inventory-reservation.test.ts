import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "../src/generated/prisma/client.js";
import { OrdersService } from "../src/orders/orders.service.js";

const orderInput = {
  locale: "zh" as const,
  productId: "product-finite",
  currency: "CNY",
  contactChannel: "WHATSAPP" as const,
  contactValue: "+60128886618",
  acceptedPolicyVersion: "2026-07-29",
  expectedPrice: {
    amount: "119.16",
    currency: "CNY",
  },
};

test("a successful finite-stock order persists its reservation marker with the stock decrement", async () => {
  let orderData: Record<string, unknown> | undefined;
  const product = {
    id: "product-finite",
    slug: "midjourney",
    basePrice: new Prisma.Decimal("73.5555555556"),
    stockMode: "FINITE" as const,
    stockQuantity: 2,
    version: 7,
    translations: [{ name: "Midjourney" }],
  };
  const transaction = {
    siteSetting: {
      findUnique: async ({ where }: { where: { key: string } }) => ({
        key: where.key,
        value: where.key === "storefront.settings"
          ? {
              acceptOrders: true,
              supportEnabled: true,
              policyVersion: "2026-07-29",
            }
          : "2026-07-29",
      }),
    },
    merchantChannel: {
      findFirst: async () => ({
        id: "channel-1",
        type: "WHATSAPP",
        mode: "DIRECT_LINK",
        publicAccount: "+60128886618",
        directTarget: "https://wa.me/60128886618",
      }),
    },
    product: {
      findFirst: async () => product,
      updateMany: async () => ({ count: 1 }),
    },
    currency: {
      findFirst: async () => ({
        code: "CNY",
        active: true,
        digits: 2,
      }),
    },
    exchangeRate: {
      findFirst: async ({ where }: { where: { toCode: string } }) => (
        where.toCode === "CNY"
          ? {
              fromCode: "MYR",
              toCode: "CNY",
              rate: new Prisma.Decimal("1.6200000000"),
            }
          : {
              fromCode: "MYR",
              toCode: "USDT",
              rate: new Prisma.Decimal("0.1360000000"),
              toCurrency: { digits: 2 },
            }
      ),
    },
    order: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        orderData = data;
        return {
          orderNumber: "CB-260729-ABC123",
          status: "MANUAL_PENDING",
          productNameSnapshot: "Midjourney",
          amount: new Prisma.Decimal("119.16"),
          currencyCode: "CNY",
          referenceAmount: new Prisma.Decimal("10.00"),
          referenceCurrencyCode: "USDT",
          contactChannel: "WHATSAPP",
          maskedContact: "+60******18",
          reservedUntil: data.reservedUntil as Date,
        };
      },
    },
  };
  const prisma = {
    order: {
      findUnique: async () => null,
    },
    currency: {
      findMany: async () => [
        { code: "CNY", digits: 2 },
        { code: "USDT", digits: 2 },
      ],
    },
    $transaction: async (
      callback: (client: typeof transaction) => unknown,
      options: Record<string, unknown>,
    ) => {
      assert.deepEqual(options, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      return callback(transaction);
    },
  };
  let reconciliations = 0;
  const service = new OrdersService(
    prisma as never,
    {
      protect: () => ({
        encrypted: "encrypted",
        hash: "contact-hash",
        masked: "+60******18",
      }),
    } as never,
    {
      reconcileExpired: async () => {
        reconciliations += 1;
        return { candidates: 0, cancelled: 0, stockRestored: 0 };
      },
    } as never,
  );

  const receipt = await service.create(orderInput, "inventory-reservation-key");

  assert.equal(reconciliations, 1);
  assert.equal(orderData?.inventoryReserved, true);
  assert.equal(orderData?.productVersion, 7);
  assert.equal(receipt.status, "MANUAL_PENDING");
});
