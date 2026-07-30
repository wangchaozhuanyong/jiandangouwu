import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SHARE_TEMPLATE } from "@cloudbridge/contracts";
import { handleCloudBridgeRequest } from "../server/router.ts";
import { createTestDatabase, memoryR2 } from "./test-helpers.mjs";

test("old settings receive safe share defaults and unknown placeholders are rejected", async () => {
  const { db } = createTestDatabase();
  const env = { DB: db, MEDIA: memoryR2() };
  await call(env, "/v1/admin/auth/me");
  const current = await call(env, "/v1/admin/site-settings");
  assert.deepEqual(current.body.data.shareTemplate, DEFAULT_SHARE_TEMPLATE);

  const rejected = await call(env, "/v1/admin/site-settings", {
    method: "PATCH",
    body: {
      ...editable(current.body.data),
      shareTemplate: {
        zh: "推荐 {productName}，优惠 {discount}",
        en: "See {productName} with {discount}",
      },
      reason: "Reject unknown share-template placeholders",
    },
  });
  assert.equal(rejected.response.status, 422);
  assert.equal(rejected.body.error.code, "VALIDATION_FAILED");

  const saved = await call(env, "/v1/admin/site-settings", {
    method: "PATCH",
    body: {
      ...editable(current.body.data),
      shareTemplate: {
        zh: "推荐 {productName}，当前价格 {price}。",
        en: "See {productName}, currently {price}.",
      },
      reason: "Configure bilingual product sharing copy",
    },
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.body.data.shareTemplate.en, "See {productName}, currently {price}.");

  const publicConfig = await call(env, "/v1/storefront/config?locale=en", { auth: false });
  assert.deepEqual(publicConfig.body.data.settings.shareTemplate, saved.body.data.shareTemplate);
});

function editable(settings) {
  return {
    version: settings.version,
    siteName: settings.siteName,
    defaultLocale: settings.defaultLocale,
    seoDescription: settings.seoDescription,
    policyVersion: settings.policyVersion,
    acceptOrders: settings.acceptOrders,
    supportEnabled: settings.supportEnabled,
    inventoryRiskThreshold: settings.inventoryRiskThreshold,
    transitServiceEnabled: settings.transitServiceEnabled,
    transitServiceUrl: settings.transitServiceUrl,
    shareTemplate: settings.shareTemplate,
  };
}

async function call(env, path, {
  method = "GET",
  body,
  auth = true,
} = {}) {
  const headers = new Headers();
  if (auth) {
    headers.set("oai-authenticated-user-email", "owner@example.test");
    headers.set("oai-authenticated-user-full-name", "Owner");
    headers.set("oai-authenticated-user-full-name-encoding", "percent-encoded-utf-8");
  }
  if (method !== "GET") {
    headers.set("content-type", "application/json");
    headers.set("x-csrf-token", "sites-siwc");
  }
  const response = await handleCloudBridgeRequest(new Request(`https://example.test${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), env);
  assert.ok(response);
  return { response, body: await response.json() };
}
