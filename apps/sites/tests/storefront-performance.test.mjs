import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeStorefrontBootstrap,
  encodeStorefrontBootstrap,
} from "../lib/storefront-bootstrap.ts";
import {
  handlePublicApi,
  storefrontConfig,
  storefrontProducts,
} from "../server/public-api.ts";
import { serveStaticAsset } from "../server/static-assets.ts";
import { buildStorefrontBootstrap } from "../server/storefront-bootstrap.ts";
import { createTestDatabase } from "./test-helpers.mjs";

test("storefront bootstrap returns localized first-render data in batched reads", async () => {
  const { sqlite, db } = createTestDatabase();
  const batchSizes = [];
  const instrumentedDb = {
    prepare: (query) => db.prepare(query),
    batch: (statements) => {
      batchSizes.push(statements.length);
      return db.batch(statements);
    },
  };
  try {
    const bootstrap = await buildStorefrontBootstrap(
      instrumentedDb,
      new URL("https://example.test/zh?category=assistant&q=ChatGPT"),
    );
    assert.equal(bootstrap?.kind, "home");
    assert.equal(bootstrap?.data.products.length, 1);
    assert.equal(bootstrap?.data.products[0]?.slug, "chatgpt");
    assert.equal(bootstrap?.data.categories.length, 4);
    assert.deepEqual(batchSizes, [4, 4]);

    const encoded = encodeStorefrontBootstrap(bootstrap);
    assert.equal(
      JSON.stringify(decodeStorefrontBootstrap(encoded)),
      JSON.stringify(bootstrap),
    );
    assert.equal(decodeStorefrontBootstrap("not-base64"), null);
  } finally {
    sqlite.close();
  }
});

test("public storefront responses declare short shared caches", async () => {
  const { sqlite, db } = createTestDatabase();
  const waits = [];
  const context = {
    waitUntil: (promise) => waits.push(promise),
    passThroughOnException() {},
  };
  try {
    const response = await handlePublicApi(
      new Request("https://example.test/v1/products?locale=en&currency=CNY"),
      { DB: db },
      "/v1/products",
      context,
    );
    assert.ok(response);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control"), /s-maxage=15/u);
    assert.equal(response.headers.get("vary"), "accept-encoding");
    const payload = await response.json();
    assert.equal(payload.data.length, 8);
    await Promise.allSettled(waits);
  } finally {
    sqlite.close();
  }
});

test("storefront config and listing use one D1 batch each", async () => {
  const { sqlite, db } = createTestDatabase();
  let batchCalls = 0;
  const instrumentedDb = {
    prepare: (query) => db.prepare(query),
    batch: (statements) => {
      batchCalls += 1;
      return db.batch(statements);
    },
  };
  try {
    await storefrontConfig(instrumentedDb, "en");
    await storefrontProducts(instrumentedDb, {
      locale: "en",
      currency: "CNY",
      category: "",
      search: "",
      pageSize: 48,
      offset: 0,
    });
    assert.equal(batchCalls, 2);
  } finally {
    sqlite.close();
  }
});

test("static asset responses get MIME and immutable caching only when hashed", async () => {
  const assets = {
    fetch: async () =>
      new Response("asset", {
        headers: { "content-type": "application/octet-stream" },
      }),
  };
  const hashed = await serveStaticAsset(
    new Request("https://example.test/assets/index-AbCdEf12.js"),
    assets,
  );
  assert.equal(hashed.headers.get("content-type"), "text/javascript; charset=utf-8");
  assert.match(hashed.headers.get("cache-control"), /immutable/u);

  const stable = await serveStaticAsset(
    new Request(
      "https://example.test/assets/responsive/hero-main-640.webp",
    ),
    assets,
  );
  assert.equal(stable.headers.get("content-type"), "image/webp");
  assert.doesNotMatch(stable.headers.get("cache-control"), /immutable/u);
});
