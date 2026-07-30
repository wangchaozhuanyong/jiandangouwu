import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

export function createTestDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const migrationDirectory = new URL("../drizzle/", import.meta.url);
  const sql = readdirSync(migrationDirectory)
    .filter((name) => /^\d{4}_.*\.sql$/u.test(name))
    .sort()
    .map((name) => readFileSync(new URL(name, migrationDirectory), "utf8"))
    .join("\n")
    .replaceAll("--> statement-breakpoint", "");
  sqlite.exec(sql);
  return { sqlite, db: d1Adapter(sqlite) };
}

export function d1Adapter(sqlite) {
  return {
    prepare(query) {
      return statementAdapter(sqlite.prepare(query), query);
    },
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.batchResult());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

function statementAdapter(statement, query) {
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
    async batchResult() {
      if (/^\s*SELECT\b/iu.test(query)) return this.all();
      return this.run();
    },
  };
}

export function memoryR2({ failPut = false } = {}) {
  const objects = new Map();
  return {
    async get(key) {
      const object = objects.get(key);
      if (!object) return null;
      return {
        body: object.value,
        httpEtag: object.etag,
        writeHttpMetadata(headers) {
          headers.set("content-type", object.contentType);
        },
      };
    },
    async put(key, value, options) {
      if (failPut) throw new Error("R2 put failed for test");
      const text = typeof value === "string" ? value : await new Response(value).text();
      objects.set(key, {
        value: text,
        etag: `"${key.length}-${text.length}"`,
        contentType: options?.httpMetadata?.contentType ?? "application/octet-stream",
      });
    },
    async delete(key) {
      objects.delete(key);
    },
    values() {
      return [...objects.values()].map((item) => item.value);
    },
    size() {
      return objects.size;
    },
  };
}

export const testActor = {
  id: "sites-owner",
  email: "owner@example.test",
  displayName: "Owner",
  permissions: ["settings.read", "settings.write", "orders.read"],
};

export async function seedOrder(sqlite, {
  contactEncrypted,
  contactHash,
  contact = "cu***@example.test",
  id = "order-governance-test",
  status = "COMPLETED",
  updatedAt = "2025-01-01T00:00:00.000Z",
} = {}) {
  sqlite.prepare(
    `INSERT INTO orders
      (id, order_number, idempotency_key, product_id, product_name_snapshot,
       currency_code, amount, reference_currency_code, reference_amount,
       exchange_rate_snapshot, product_version, contact_channel, contact_encrypted,
       contact_hash, masked_contact, accepted_policy_version, status, payment_mode,
       reserved_until, inventory_reserved, inventory_released_at, assigned_to_id,
       created_at, updated_at)
     VALUES (?, ?, ?, 'product-codex', 'OpenAI Codex Professional',
       'MYR', '89.00', 'USDT', '20.00', '1.0000000000', 1, 'EMAIL', ?,
       ?, ?, '2026-07-29', ?, 'MANUAL', ?, 0, NULL, NULL, ?, ?)`,
  ).run(
    id,
    `CB-${id}`,
    `idem-${id}`,
    contactEncrypted,
    contactHash,
    contact,
    status,
    updatedAt,
    updatedAt,
    updatedAt,
  );
}
