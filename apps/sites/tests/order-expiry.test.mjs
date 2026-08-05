import assert from "node:assert/strict";
import test from "node:test";
import { reconcileExpiredOrders } from "../server/order-expiry.ts";
import { createTestDatabase } from "./test-helpers.mjs";

test("expired manual orders are cancelled and finite inventory is released exactly once", async () => {
  const { sqlite, db } = createTestDatabase();
  sqlite.prepare(
    `INSERT INTO orders (
      id, order_number, idempotency_key, product_id, product_name_snapshot,
      currency_code, amount, exchange_rate_snapshot, product_version,
      contact_channel, contact_encrypted, contact_hash, masked_contact,
      accepted_policy_version, status, payment_mode, reserved_until,
      inventory_reserved, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "order-expired",
    "CB-EXPIRED",
    "idempotency-expired",
    "product-codex",
    "Codex",
    "CNY",
    "89.00",
    "1.0000000000",
    1,
    "EMAIL",
    "encrypted",
    "hash",
    "te***@example.com",
    "2026-07-29",
    "MANUAL_PENDING",
    "MANUAL",
    "2026-07-29T00:10:00.000Z",
    1,
    "2026-07-29T00:00:00.000Z",
    "2026-07-29T00:00:00.000Z",
  );
  sqlite.prepare(
    "UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = 'product-codex'",
  ).run();
  sqlite.prepare(
    `INSERT INTO order_items (
      id, order_id, product_id, product_name_snapshot, currency_code, amount,
      exchange_rate_snapshot, product_version, sort_order, created_at
    ) VALUES ('item-expired', 'order-expired', 'product-codex', 'Codex', 'CNY',
      '89.00', '1.0000000000', 1, 0, '2026-07-29T00:00:00.000Z')`,
  ).run();

  const first = await reconcileExpiredOrders(db, new Date("2026-07-29T00:30:00.000Z"));
  assert.deepEqual(first, { candidates: 1, released: 1 });
  assert.deepEqual(
    { ...sqlite.prepare(
      "SELECT status, inventory_released_at AS releasedAt FROM orders WHERE id = 'order-expired'",
    ).get() },
    { status: "CANCELLED", releasedAt: "2026-07-29T00:30:00.000Z" },
  );
  assert.equal(
    sqlite.prepare("SELECT stock_quantity AS stock FROM products WHERE id = 'product-codex'").get().stock,
    12,
  );
  assert.equal(
    sqlite.prepare(
      "SELECT COUNT(*) AS count FROM order_status_history WHERE order_id = 'order-expired' AND to_status = 'CANCELLED'",
    ).get().count,
    1,
  );
  assert.equal(
    sqlite.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE target_id = 'order-expired' AND action = 'order.reservation.expired'",
    ).get().count,
    1,
  );

  const second = await reconcileExpiredOrders(db, new Date("2026-07-29T00:30:00.000Z"));
  assert.deepEqual(second, { candidates: 0, released: 0 });
  assert.equal(
    sqlite.prepare("SELECT stock_quantity AS stock FROM products WHERE id = 'product-codex'").get().stock,
    12,
  );
});

test("active reservations remain untouched before their expiry", async () => {
  const { sqlite, db } = createTestDatabase();
  sqlite.prepare(
    `INSERT INTO orders (
      id, order_number, idempotency_key, product_id, product_name_snapshot,
      currency_code, amount, exchange_rate_snapshot, product_version,
      contact_channel, contact_encrypted, contact_hash, masked_contact,
      accepted_policy_version, status, payment_mode, reserved_until,
      inventory_reserved, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "order-active",
    "CB-ACTIVE",
    "idempotency-active",
    "product-codex",
    "Codex",
    "CNY",
    "89.00",
    "1.0000000000",
    1,
    "EMAIL",
    "encrypted",
    "hash",
    "te***@example.com",
    "2026-07-29",
    "MANUAL_PENDING",
    "MANUAL",
    "2026-07-29T01:00:00.000Z",
    1,
    "2026-07-29T00:00:00.000Z",
    "2026-07-29T00:00:00.000Z",
  );

  const result = await reconcileExpiredOrders(db, new Date("2026-07-29T00:30:00.000Z"));
  assert.deepEqual(result, { candidates: 0, released: 0 });
  assert.equal(
    sqlite.prepare("SELECT status FROM orders WHERE id = 'order-active'").get().status,
    "MANUAL_PENDING",
  );
});
