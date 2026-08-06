import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  handlePublicApi,
  storefrontBanners,
  storefrontCategoryTree,
  storefrontProduct,
  storefrontProducts,
  storefrontSkill,
  storefrontSkillCategories,
  storefrontSkills,
} from "../server/public-api.ts";
import { reconcileExpiredOrders } from "../server/order-expiry.ts";
import { createTestDatabase } from "./test-helpers.mjs";

const migrationDirectory = new URL("../drizzle/", import.meta.url);
const migration = (name) => readFileSync(new URL(name, migrationDirectory), "utf8")
  .replaceAll("--> statement-breakpoint", "");

test("V2 forward migration preserves legacy ids and backfills hierarchy, surfaces, and order items", () => {
  const sqlite = new DatabaseSync(":memory:");
  const names = readdirSync(migrationDirectory)
    .filter((name) => /^000[0-6]_.*\.sql$/u.test(name))
    .sort();
  sqlite.exec(names.map(migration).join("\n"));
  sqlite.prepare(
    `INSERT INTO orders (
      id, order_number, idempotency_key, product_id, product_name_snapshot,
      currency_code, amount, exchange_rate_snapshot, product_version,
      contact_channel, contact_encrypted, contact_hash, masked_contact,
      accepted_policy_version, status, payment_mode, reserved_until,
      inventory_reserved, created_at, updated_at
    ) VALUES ('legacy-order', 'CB-LEGACY', 'legacy-idempotency', 'product-codex',
      'OpenAI Codex Professional', 'CNY', '89.00', '1.0000000000', 1,
      'EMAIL', 'encrypted', 'hash', 'le***@example.test', '2026-07-29',
      'MANUAL_PENDING', 'MANUAL', '2026-07-29T00:30:00.000Z', 0,
      '2026-07-29T00:00:00.000Z', '2026-07-29T00:00:00.000Z')`,
  ).run();

  sqlite.exec(migration("0007_material_nightmare.sql"));

  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM categories WHERE parent_id = 'category-primary-ai-services'").get().count,
    4,
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM product_surfaces WHERE surface = 'HOME'").get().count,
    8,
  );
  assert.equal(
    sqlite.prepare("SELECT product_id AS productId FROM order_items WHERE order_id = 'legacy-order'").get().productId,
    "product-codex",
  );
  assert.equal(sqlite.prepare("PRAGMA foreign_key_check").all().length, 0);
  sqlite.close();
});

test("V2 catalog APIs expose populated two-level categories and surface filters without duplicating products", async () => {
  const { sqlite, db } = createTestDatabase();
  try {
    const tree = await storefrontCategoryTree(db, "zh", "HOME");
    assert.equal(tree.length, 1);
    assert.equal(tree[0]?.slug, "ai-services");
    assert.equal(tree[0]?.children?.length, 4);

    const home = await storefrontProducts(db, {
      locale: "zh",
      currency: "CNY",
      category: "",
      surface: "HOME",
      platform: null,
      transitPlanType: null,
      search: "",
      pageSize: 48,
      offset: 0,
    });
    assert.equal(home.total, 8);
    assert.equal(new Set(home.items.map((item) => item.id)).size, 8);

    sqlite.prepare(
      "UPDATE product_surfaces SET is_visible = 0 WHERE product_id = 'product-codex' AND surface = 'HOME'",
    ).run();
    const visibleHome = await storefrontProducts(db, {
      locale: "zh",
      currency: "CNY",
      category: "ai-services",
      surface: "HOME",
      platform: null,
      transitPlanType: null,
      search: "",
      pageSize: 48,
      offset: 0,
    });
    assert.equal(visibleHome.total, 7);

    const detail = await storefrontProduct(db, "chatgpt", "zh", "CNY");
    assert.equal(detail?.platformKey, null);
    assert.equal(detail?.transitPlanType, null);
  } finally {
    sqlite.close();
  }
});

test("V2 banner and Skill reads stay placement-aware, bilingual, and GitHub-safe", async () => {
  const { sqlite, db } = createTestDatabase();
  const now = "2026-08-04T00:00:00.000Z";
  try {
    assert.equal((await storefrontBanners(db, "zh", "HOME")).length, 4);
    assert.equal((await storefrontBanners(db, "zh", "AI_RECHARGE")).length, 0);

    sqlite.prepare(
      `INSERT INTO skill_categories (id, slug, status, sort_order, version, created_at, updated_at)
       VALUES ('skill-category-development', 'developer-tools', 'ACTIVE', 1, 1, ?, ?)`,
    ).run(now, now);
    sqlite.prepare(
      `INSERT INTO skill_category_translations (category_id, locale, name)
       VALUES ('skill-category-development', 'ZH', '开发工具'),
              ('skill-category-development', 'EN', 'Developer tools')`,
    ).run();
    for (const [id, slug, githubUrl, status] of [
      ["skill-codex", "codex-cli", "https://github.com/openai/codex", "ACTIVE"],
      ["skill-unsafe", "unsafe-source", "https://github.com.evil.test/openai/codex", "ACTIVE"],
    ]) {
      sqlite.prepare(
        `INSERT INTO skills (
          id, slug, category_id, resource_type, source_level, maintainer,
          github_url, documentation_url, license, compatible_environments_json,
          verified_at, status, sort_order, version, created_at, updated_at
        ) VALUES (?, ?, 'skill-category-development', 'SKILL', 'OFFICIAL', 'OpenAI',
          ?, 'https://developers.openai.com/codex/', 'Apache-2.0', '["Codex"]',
          ?, ?, 1, 1, ?, ?)`,
      ).run(id, slug, githubUrl, now, status, now, now);
      sqlite.prepare(
        `INSERT INTO skill_translations (
          skill_id, locale, name, normalized_name, summary, description,
          suitable_for_json, unsuitable_for_json, install_hint
        ) VALUES (?, 'ZH', ?, ?, '命令行开发助手', '用于真实开发工作流。',
          '["代码开发"]', '["自动付款"]', '安装前阅读官方文档'),
          (?, 'EN', ?, ?, 'Command-line development assistant',
          'For real development workflows.', '["Code development"]',
          '["Automatic payments"]', 'Read the official documentation first')`,
      ).run(id, slug === "codex-cli" ? "OpenAI Codex" : "Unsafe", slug, id, slug, slug);
    }

    const categories = await storefrontSkillCategories(db, "zh");
    assert.deepEqual(categories.map((category) => category.slug), ["developer-tools"]);
    const listing = await storefrontSkills(db, {
      locale: "zh",
      category: "developer-tools",
      resourceType: "SKILL",
      sourceLevel: "OFFICIAL",
      search: "codex",
      page: 1,
      pageSize: 24,
      offset: 0,
    });
    assert.equal(listing.total, 1);
    assert.equal(listing.items[0]?.githubUrl, "https://github.com/openai/codex");
    assert.equal((await storefrontSkill(db, "codex-cli", "en"))?.license, "Apache-2.0");
    assert.equal(await storefrontSkill(db, "unsafe-source", "en"), null);
  } finally {
    sqlite.close();
  }
});

test("V2 cart order creates one manual order with distinct server-priced items and strong order number entropy", async () => {
  const { sqlite, db } = createTestDatabase();
  const dataKey = Buffer.alloc(32, 7).toString("base64url");
  try {
    sqlite.prepare(
      `UPDATE merchant_channels
       SET public_account = 'orders@example.test', direct_target = 'mailto:orders@example.test', active = 1
       WHERE type = 'EMAIL'`,
    ).run();
    sqlite.prepare(
      `UPDATE site_settings
       SET value_json = json_set(value_json, '$.supportEnabled', json('true'), '$.acceptOrders', json('true'))
       WHERE key = 'storefront.settings'`,
    ).run();
    const rateEffectiveAt = new Date().toISOString();
    const rateExpiresAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    sqlite.prepare(
      "UPDATE exchange_rates SET effective_at = ?, expires_at = ? WHERE from_code = 'MYR'",
    ).run(rateEffectiveAt, rateExpiresAt);
    const listing = await storefrontProducts(db, {
      locale: "zh",
      currency: "CNY",
      category: "",
      surface: "HOME",
      platform: null,
      transitPlanType: null,
      search: "",
      pageSize: 48,
      offset: 0,
    });
    const selected = listing.items.slice(0, 2);
    const request = new Request("https://example.test/v1/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "v2-cart-order-test",
      },
      body: JSON.stringify({
        locale: "zh",
        currency: "CNY",
        contactChannel: "EMAIL",
        contactValue: "customer@example.test",
        acceptedPolicyVersion: "2026-07-29",
        items: selected.map((item) => ({
          productId: item.id,
          expectedPrice: item.price,
        })),
      }),
    });
    const replayRequest = request.clone();
    const response = await handlePublicApi(
      request,
      { DB: db, CLOUDBRIDGE_DATA_KEY: dataKey },
      "/v1/orders",
    );
    assert.ok(response);
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.match(payload.data.orderNumber, /^CB\d{8}[A-F0-9]{24}$/u);
    assert.equal(payload.data.items.length, 2);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM orders").get().count, 1);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM order_items").get().count, 2);
    const orderCreatedAt = sqlite.prepare("SELECT created_at AS createdAt FROM orders LIMIT 1").get().createdAt;
    assert.deepEqual(
      sqlite.prepare(
        "SELECT sort_order AS sortOrder, created_at AS createdAt FROM order_items ORDER BY sort_order",
      ).all().map((row) => ({ ...row })),
      [
        { sortOrder: 0, createdAt: orderCreatedAt },
        { sortOrder: 1, createdAt: orderCreatedAt },
      ],
    );
    assert.deepEqual(
      sqlite.prepare(
        "SELECT id, stock_quantity AS stock FROM products WHERE id IN ('product-codex', 'product-gemini') ORDER BY id",
      ).all().map((row) => ({ ...row })),
      [
        { id: "product-codex", stock: 11 },
        { id: "product-gemini", stock: 7 },
      ],
    );

    const replay = await handlePublicApi(
      replayRequest,
      { DB: db, CLOUDBRIDGE_DATA_KEY: dataKey },
      "/v1/orders",
    );
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).data.items.length, 2);

    const lookupResponse = await handlePublicApi(
      new Request("https://example.test/v1/orders/lookup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.20",
        },
        body: JSON.stringify({
          locale: "zh",
          mode: "ORDER_NUMBER",
          orderNumber: payload.data.orderNumber,
        }),
      }),
      { DB: db, CLOUDBRIDGE_DATA_KEY: dataKey },
      "/v1/orders/lookup",
    );
    assert.equal(lookupResponse.status, 200);
    assert.equal(lookupResponse.headers.get("cache-control"), "no-store");
    assert.equal((await lookupResponse.json()).data.items.length, 2);

    const missingOrderNumber = `CB20260804${"F".repeat(24)}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const missing = await handlePublicApi(
        lookupRequest(missingOrderNumber),
        { DB: db, CLOUDBRIDGE_DATA_KEY: dataKey },
        "/v1/orders/lookup",
      );
      assert.equal(missing.status, 404);
      assert.equal((await missing.json()).error.code, "ORDER_LOOKUP_NOT_FOUND");
    }
    const limited = await handlePublicApi(
      lookupRequest(missingOrderNumber),
      { DB: db, CLOUDBRIDGE_DATA_KEY: dataKey },
      "/v1/orders/lookup",
    );
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("retry-after")) > 0);
    const contactLookup = await handlePublicApi(
      contactLookupRequest(payload.data.orderNumber, "EMAIL", "customer@example.test"),
      { DB: db, CLOUDBRIDGE_DATA_KEY: dataKey },
      "/v1/orders/lookup",
    );
    assert.equal(contactLookup.status, 200);
    assert.equal(contactLookup.headers.get("cache-control"), "no-store");
    assert.equal((await contactLookup.json()).data.orderNumber, payload.data.orderNumber);

    const wrongContact = await handlePublicApi(
      contactLookupRequest(payload.data.orderNumber, "EMAIL", "other@example.test"),
      { DB: db, CLOUDBRIDGE_DATA_KEY: dataKey },
      "/v1/orders/lookup",
    );
    const wrongChannel = await handlePublicApi(
      contactLookupRequest(payload.data.orderNumber, "WHATSAPP", "customer@example.test"),
      { DB: db, CLOUDBRIDGE_DATA_KEY: dataKey },
      "/v1/orders/lookup",
    );
    assert.equal(wrongContact.status, 404);
    assert.equal(wrongChannel.status, 404);
    const wrongContactError = (await wrongContact.json()).error;
    const wrongChannelError = (await wrongChannel.json()).error;
    assert.deepEqual(wrongContactError, wrongChannelError);

    sqlite.prepare(
      "UPDATE orders SET contact_erased_at = ? WHERE order_number = ?",
    ).run(new Date().toISOString(), payload.data.orderNumber);
    const erasedContact = await handlePublicApi(
      contactLookupRequest(payload.data.orderNumber, "EMAIL", "customer@example.test"),
      { DB: db, CLOUDBRIDGE_DATA_KEY: dataKey },
      "/v1/orders/lookup",
    );
    assert.equal(erasedContact.status, 404);
    assert.deepEqual((await erasedContact.json()).error, wrongContactError);

    const persistedRateData = JSON.stringify(
      sqlite.prepare("SELECT * FROM order_lookup_rate_limits").all(),
    );
    assert.doesNotMatch(
      persistedRateData,
      /203\.0\.113\.20|CB20260804|customer@example\.test/u,
    );
    assert.ok(
      sqlite.prepare(
        "SELECT COUNT(*) AS count FROM order_lookup_rate_limits WHERE subject_kind = 'CONTACT'",
      ).get().count >= 1,
    );

    const expiry = await reconcileExpiredOrders(db, new Date(Date.now() + 31 * 60_000));
    assert.deepEqual(expiry, { candidates: 1, released: 1 });
    assert.deepEqual(
      sqlite.prepare(
        "SELECT id, stock_quantity AS stock FROM products WHERE id IN ('product-codex', 'product-gemini') ORDER BY id",
      ).all().map((row) => ({ ...row })),
      [
        { id: "product-codex", stock: 12 },
        { id: "product-gemini", stock: 8 },
      ],
    );
  } finally {
    sqlite.close();
  }
});

function lookupRequest(orderNumber) {
  return new Request("https://example.test/v1/orders/lookup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": "203.0.113.20",
    },
    body: JSON.stringify({ locale: "zh", mode: "ORDER_NUMBER", orderNumber }),
  });
}

function contactLookupRequest(orderNumber, contactChannel, contactValue) {
  return new Request("https://example.test/v1/orders/lookup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": "203.0.113.21",
    },
    body: JSON.stringify({
      locale: "zh",
      mode: "CONTACT",
      orderNumber,
      contactChannel,
      contactValue,
    }),
  });
}
