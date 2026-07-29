import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { handleAdminApi } from "../server/admin-api.ts";
import { ApiInputError } from "../server/http.ts";

const migration = readFileSync(
  new URL("../drizzle/0000_salty_fat_cobra.sql", import.meta.url),
  "utf8",
).replaceAll("--> statement-breakpoint", "");

test("Sites product catalog applies status, literal search, pagination, and matching totals", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration);
  seedAdministrator(sqlite);
  sqlite.exec(`
    UPDATE products SET status = 'DRAFT' WHERE id = 'product-codex';
    UPDATE products SET status = 'ARCHIVED' WHERE id = 'product-gemini';
    UPDATE product_translations
      SET name = '100% Codex', normalized_name = '100% codex'
      WHERE product_id = 'product-codex' AND locale = 'EN';
  `);

  try {
    const defaultPayload = await productPayload(
      sqlite,
      "/v1/admin/products?page=1&pageSize=3",
    );
    assert.deepEqual(defaultPayload.meta, {
      page: 1,
      pageSize: 3,
      total: 7,
      pageCount: 3,
    });
    assert.deepEqual(
      defaultPayload.data.map((product) => product.id),
      ["product-codex", "product-chatgpt", "product-claude"],
    );
    assert.equal(
      defaultPayload.data.some((product) => product.status === "ARCHIVED"),
      false,
    );

    const archivedPayload = await productPayload(
      sqlite,
      "/v1/admin/products?status=ARCHIVED",
    );
    assert.equal(archivedPayload.meta.total, 1);
    assert.equal(archivedPayload.data[0]?.id, "product-gemini");

    const literalSearchPayload = await productPayload(
      sqlite,
      "/v1/admin/products?status=DRAFT&search=100%25",
    );
    assert.equal(literalSearchPayload.meta.total, 1);
    assert.equal(literalSearchPayload.data[0]?.id, "product-codex");

    const activePage = await productPayload(
      sqlite,
      "/v1/admin/products?page=2&pageSize=2&status=ACTIVE",
    );
    assert.deepEqual(activePage.meta, {
      page: 2,
      pageSize: 2,
      total: 6,
      pageCount: 3,
    });
    assert.deepEqual(
      activePage.data.map((product) => product.id),
      ["product-cursor", "product-perplexity"],
    );
  } finally {
    sqlite.close();
  }
});

test("Sites product catalog rejects invalid filters instead of changing their meaning", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration);
  seedAdministrator(sqlite);
  try {
    for (const [path, field] of [
      ["/v1/admin/products?page=1001", "page"],
      ["/v1/admin/products?pageSize=101", "pageSize"],
      ["/v1/admin/products?search=%20%20", "search"],
      ["/v1/admin/products?status=DELETED", "status"],
    ]) {
      await assert.rejects(
        handleAdminApi(
          productRequest(path),
          { DB: d1Adapter(sqlite), MEDIA: {} },
          "/v1/admin/products",
        ),
        (error) => error instanceof ApiInputError
          && error.code === "VALIDATION_FAILED"
          && error.details?.[0]?.field === field,
      );
    }
  } finally {
    sqlite.close();
  }
});

async function productPayload(sqlite, path) {
  const response = await handleAdminApi(
    productRequest(path),
    { DB: d1Adapter(sqlite), MEDIA: {} },
    "/v1/admin/products",
  );
  assert.ok(response);
  assert.equal(response.status, 200);
  return response.json();
}

function productRequest(path) {
  return new Request(`https://example.test${path}`, {
    headers: {
      "oai-authenticated-user-email": "owner@example.test",
    },
  });
}

function seedAdministrator(sqlite) {
  const now = new Date().toISOString();
  sqlite.prepare(
    `INSERT INTO admin_members
      (id, email, display_name, status, permissions_json, last_login_at, created_at, updated_at)
     VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?)`,
  ).run(
    "admin-owner",
    "owner@example.test",
    "Owner",
    JSON.stringify(["catalog.read"]),
    now,
    now,
    now,
  );
}

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
      return {
        success: true,
        results: statement.all(...values),
        meta: { changes: 0 },
      };
    },
    async run() {
      const result = statement.run(...values);
      return {
        success: true,
        results: [],
        meta: { changes: Number(result.changes) },
      };
    },
  };
}
