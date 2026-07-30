import assert from "node:assert/strict";
import test from "node:test";
import type { AdminOrderListItem } from "@cloudbridge/contracts";
import type { Overview } from "../src/api";
import {
  buildDashboardSnapshot,
  liveInventoryRiskCapabilityBody,
} from "../src/features/dashboard/model";

const order = (id: string, createdAt: string): AdminOrderListItem => ({
  id,
  orderNumber: `QA-${id}`,
  productId: `product-${id}`,
  productNameSnapshot: "QA product",
  amount: { amount: "10.00", currency: "MYR" },
  referenceAmount: null,
  maskedContact: "qa***@invalid.example",
  contactChannel: "EMAIL",
  status: "MANUAL_PENDING",
  paymentMode: "MANUAL",
  paymentStage: "NOT_RECORDED",
  reservedUntil: "2026-07-30T12:00:00.000Z",
  assignedTo: null,
  createdAt,
  updatedAt: createdAt,
});

const overview = (overrides: Partial<Overview> = {}): Overview => ({
  metrics: {
    productCount: 8,
    activeProducts: 5,
    openOrders: 4,
    categoryCount: 3,
  },
  inventoryRisk: {
    source: "LIVE_DATABASE_QUERY",
    threshold: 3,
    evaluatedProductCount: 5,
    affectedProductCount: 2,
    soldOutCount: 1,
    lowStockCount: 1,
    invalidStockCount: 0,
    sampleLimit: 6,
    items: [
      {
        id: "product-sold-out",
        slug: "sold-out",
        name: { zh: "售罄商品", en: "Sold-out product" },
        stockQuantity: 0,
        risk: "SOLD_OUT",
        updatedAt: "2026-07-29T11:00:00.000Z",
      },
      {
        id: "product-low-stock",
        slug: "low-stock",
        name: { zh: "低库存商品", en: "Low-stock product" },
        stockQuantity: 3,
        risk: "LOW_STOCK",
        updatedAt: "2026-07-29T10:00:00.000Z",
      },
    ],
  },
  latestOrders: [
    order("older", "2026-07-28T10:00:00.000Z"),
    order("newer", "2026-07-29T12:00:00.000Z"),
  ],
  ...overrides,
});

test("dashboard snapshot derives only values present in the overview response", () => {
  const source = overview();
  const snapshot = buildDashboardSnapshot(source);

  assert.equal(snapshot.inactiveProductCount, 3);
  assert.equal(snapshot.latestOrderCount, 2);
  assert.equal(snapshot.latestOrderAt, "2026-07-29T12:00:00.000Z");
  assert.equal(snapshot.inventoryRisk.affectedProductCount, 2);
  assert.notEqual(snapshot.inventoryRisk, source.inventoryRisk);
  assert.notEqual(snapshot.inventoryRisk.items, source.inventoryRisk.items);
});

test("dashboard snapshot separates live inventory evidence from missing alert evidence", () => {
  const snapshot = buildDashboardSnapshot(overview({ latestOrders: [] }));

  assert.equal(snapshot.latestOrderCount, 0);
  assert.equal(snapshot.latestOrderAt, null);
  assert.deepEqual(
    snapshot.capabilities.map(({ code, state }) => [code, state]),
    [
      ["RESERVATION_EXPIRY", "IMPLEMENTED_REQUEST_DRIVEN"],
      ["LOW_STOCK_ALERT", "IMPLEMENTED_LIVE_QUERY"],
      ["NOTIFICATION_DELIVERY", "IMPLEMENTED_RETRY_QUEUE"],
      ["SECURITY_ALERT", "IMPLEMENTED_RETRY_QUEUE"],
    ],
  );
});

test("dashboard snapshot closes inconsistent inactive-product counts at zero", () => {
  const snapshot = buildDashboardSnapshot(overview({
    metrics: {
      productCount: 2,
      activeProducts: 3,
      openOrders: 0,
      categoryCount: 1,
    },
  }));

  assert.equal(snapshot.inactiveProductCount, 0);
});

test("dashboard capability copy uses the inventory threshold from the live response", () => {
  assert.equal(
    liveInventoryRiskCapabilityBody("zh", 7),
    "工作台会实时查询全部在售商品，区分库存数据冲突、售罄和 1–7 件低库存；它不是通知投递或历史告警。",
  );
  assert.equal(
    liveInventoryRiskCapabilityBody("en", 7),
    "The workspace queries every active product and separates invalid stock, sold-out items, and low stock from 1–7. This is not notification delivery or alert history.",
  );
});
