import assert from "node:assert/strict";
import test from "node:test";
import { AdminService } from "../src/admin/admin.service.js";

const reservations = {
  reconcileExpired: async () => ({ candidates: 0, cancelled: 0, stockRestored: 0 }),
};

const riskProduct = (
  id: string,
  stockQuantity: number | null,
  updatedAt: string,
) => ({
  id,
  slug: id,
  stockQuantity,
  updatedAt: new Date(updatedAt),
  translations: [
    { locale: "ZH", name: `${id} 中文` },
    { locale: "EN", name: `${id} English` },
  ],
});

test("admin overview queries the complete active catalog for live inventory risks", async () => {
  const productCountQueries: Array<Record<string, unknown> | undefined> = [];
  const productListQueries: Array<Record<string, unknown>> = [];
  const prisma = {
    product: {
      count: async (query?: Record<string, unknown>) => {
        productCountQueries.push(query);
        const where = query?.where as Record<string, unknown> | undefined;
        if (!where) return 8;
        if (Array.isArray(where.OR)) return 1;
        if (where.stockQuantity === 0) return 1;
        if (typeof where.stockQuantity === "object") return 1;
        if (where.status === "ACTIVE") return 5;
        return 0;
      },
      findMany: async (query: Record<string, unknown>) => {
        productListQueries.push(query);
        const where = query.where as Record<string, unknown>;
        if (Array.isArray(where.OR)) {
          return [riskProduct("invalid-stock", null, "2026-07-29T13:00:00.000Z")];
        }
        if (where.stockQuantity === 0) {
          return [riskProduct("sold-out", 0, "2026-07-29T12:00:00.000Z")];
        }
        return [riskProduct("low-stock", 3, "2026-07-29T11:00:00.000Z")];
      },
    },
    order: {
      count: async () => 2,
      findMany: async () => [{
        id: "order-1",
        orderNumber: "CB-QA-1",
        productId: "sold-out",
        productNameSnapshot: "Sold out",
        currencyCode: "MYR",
        amount: { toFixed: () => "89.00" },
        referenceCurrencyCode: null,
        referenceAmount: null,
        maskedContact: "qa***@invalid.example",
        contactChannel: "EMAIL",
        status: "MANUAL_PENDING",
        paymentMode: "MANUAL",
        reservedUntil: new Date("2026-07-29T14:00:00.000Z"),
        assignedTo: null,
        createdAt: new Date("2026-07-29T13:30:00.000Z"),
        updatedAt: new Date("2026-07-29T13:30:00.000Z"),
      }],
    },
    category: {
      count: async () => 4,
    },
    currency: {
      findMany: async () => [{ code: "MYR", digits: 2 }],
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };
  const service = new AdminService(
    prisma as never,
    { record: async () => undefined } as never,
    reservations as never,
  );

  const result = await service.overview();

  assert.deepEqual(result.metrics, {
    productCount: 8,
    activeProducts: 5,
    openOrders: 2,
    categoryCount: 4,
  });
  assert.deepEqual(result.inventoryRisk, {
    source: "LIVE_DATABASE_QUERY",
    threshold: 3,
    evaluatedProductCount: 5,
    affectedProductCount: 3,
    soldOutCount: 1,
    lowStockCount: 1,
    invalidStockCount: 1,
    sampleLimit: 6,
    items: [
      {
        id: "invalid-stock",
        slug: "invalid-stock",
        name: { zh: "invalid-stock 中文", en: "invalid-stock English" },
        stockQuantity: null,
        risk: "INVALID_STOCK",
        updatedAt: "2026-07-29T13:00:00.000Z",
      },
      {
        id: "sold-out",
        slug: "sold-out",
        name: { zh: "sold-out 中文", en: "sold-out English" },
        stockQuantity: 0,
        risk: "SOLD_OUT",
        updatedAt: "2026-07-29T12:00:00.000Z",
      },
      {
        id: "low-stock",
        slug: "low-stock",
        name: { zh: "low-stock 中文", en: "low-stock English" },
        stockQuantity: 3,
        risk: "LOW_STOCK",
        updatedAt: "2026-07-29T11:00:00.000Z",
      },
    ],
  });
  assert.equal(productCountQueries.length, 6);
  assert.equal(productListQueries.length, 3);
  assert.equal(
    (productListQueries[2]?.where as {
      stockQuantity?: { gt?: number; lte?: number };
    }).stockQuantity?.lte,
    3,
  );
  assert.deepEqual(
    productListQueries.map((query) => query.take),
    [6, 6, 6],
  );
});
