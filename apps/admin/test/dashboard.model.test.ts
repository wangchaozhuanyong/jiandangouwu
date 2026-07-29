import assert from "node:assert/strict";
import test from "node:test";
import type { AdminOrderListItem } from "@cloudbridge/contracts";
import type { Overview } from "../src/api";
import { buildDashboardSnapshot } from "../src/features/dashboard/model";

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
  latestOrders: [
    order("older", "2026-07-28T10:00:00.000Z"),
    order("newer", "2026-07-29T12:00:00.000Z"),
  ],
  ...overrides,
});

test("dashboard snapshot derives only values present in the overview response", () => {
  const snapshot = buildDashboardSnapshot(overview());

  assert.equal(snapshot.inactiveProductCount, 3);
  assert.equal(snapshot.latestOrderCount, 2);
  assert.equal(snapshot.latestOrderAt, "2026-07-29T12:00:00.000Z");
});

test("dashboard snapshot does not turn missing alert evidence into zero", () => {
  const snapshot = buildDashboardSnapshot(overview({ latestOrders: [] }));

  assert.equal(snapshot.latestOrderCount, 0);
  assert.equal(snapshot.latestOrderAt, null);
  assert.deepEqual(
    snapshot.capabilities.map(({ code, state }) => [code, state]),
    [
      ["RESERVATION_EXPIRY", "NOT_IMPLEMENTED"],
      ["LOW_STOCK_ALERT", "NOT_COLLECTED"],
      ["NOTIFICATION_DELIVERY", "NOT_COLLECTED"],
      ["SECURITY_ALERT", "NOT_IMPLEMENTED"],
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
