import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { reconcileExpiredOrders } from "../server/order-expiry.ts";

const migration = readFileSync(
  new URL("../drizzle/0000_salty_fat_cobra.sql", import.meta.url),
  "utf8",
).replaceAll("--> statement-breakpoint", "");

test("expired manual orders are cancelled and finite inventory is released exactly once", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration);
  const db = d1Adapter(sqlite);
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
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration);
  const db = d1Adapter(sqlite);
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

function d1Adapter(sqlite) {
  return {
    prepare(query) {
      return statementAdapter(sqlite.prepare(query));
    },
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

function statementAdapter(statement) {
  let values = [];
  return {
    bind(...nextValues) {
      values = nextValues;
      return this;
    },
    async first() {
      return statement.get(...values) ?? null;
    },
    async all() {
      return { success: true, results: statement.all(...values), meta: { changes: 0 } };
    },
    async run() {
      const result = statement.run(...values);
      return { success: true, results: [], meta: { changes: Number(result.changes) } };
    },
  };
}
