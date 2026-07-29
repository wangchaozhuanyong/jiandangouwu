import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_STOREFRONT_SETTINGS,
  parseOrderGateSettings,
  parseStorefrontSettings,
} from "../src/settings/settings.model.js";

test("site settings use safe defaults for missing or damaged values", () => {
  assert.deepEqual(parseStorefrontSettings(null), DEFAULT_STOREFRONT_SETTINGS);
  assert.deepEqual(parseStorefrontSettings(["unexpected"]), DEFAULT_STOREFRONT_SETTINGS);

  const parsed = parseStorefrontSettings({
    siteName: { zh: "", en: 42 },
    defaultLocale: "fr",
    seoDescription: null,
    policyVersion: "",
    acceptOrders: "yes",
    supportEnabled: false,
    transitServiceEnabled: true,
    transitServiceUrl: "javascript:alert(1)",
    secret: "must-never-be-exposed",
  });

  assert.equal(parsed.siteName.zh, DEFAULT_STOREFRONT_SETTINGS.siteName.zh);
  assert.equal(parsed.siteName.en, DEFAULT_STOREFRONT_SETTINGS.siteName.en);
  assert.equal(parsed.defaultLocale, "zh");
  assert.equal(parsed.acceptOrders, true);
  assert.equal(parsed.supportEnabled, false);
  assert.equal(parsed.transitServiceUrl, null);
  assert.equal("secret" in parsed, false);
});

test("site settings reject HTTPS URLs with embedded credentials", () => {
  const parsed = parseStorefrontSettings({
    transitServiceUrl: "https://user:password@transit.example.com/path",
  });
  assert.equal(parsed.transitServiceUrl, null);
});

test("site settings preserve valid localized content and HTTPS transit URLs", () => {
  const parsed = parseStorefrontSettings({
    siteName: { zh: "新云桥", en: "New CloudBridge" },
    defaultLocale: "en",
    seoDescription: { zh: "中文介绍", en: "English description" },
    policyVersion: "2026-08-01",
    acceptOrders: false,
    supportEnabled: true,
    transitServiceEnabled: true,
    transitServiceUrl: "https://transit.example.com/path",
  });

  assert.deepEqual(parsed, {
    siteName: { zh: "新云桥", en: "New CloudBridge" },
    defaultLocale: "en",
    seoDescription: { zh: "中文介绍", en: "English description" },
    policyVersion: "2026-08-01",
    acceptOrders: false,
    supportEnabled: true,
    transitServiceEnabled: true,
    transitServiceUrl: "https://transit.example.com/path",
  });
});

test("order gates fail closed when stored settings are missing or damaged", () => {
  assert.deepEqual(parseOrderGateSettings(null, "2026-08-01"), {
    acceptOrders: false,
    policyVersion: "2026-08-01",
  });
  assert.deepEqual(parseOrderGateSettings({
    acceptOrders: "yes",
    policyVersion: "2026-08-01",
  }), {
    acceptOrders: false,
    policyVersion: "2026-08-01",
  });
  assert.deepEqual(parseOrderGateSettings({
    acceptOrders: true,
    policyVersion: "2026-08-01",
  }), {
    acceptOrders: true,
    policyVersion: "2026-08-01",
  });
});
