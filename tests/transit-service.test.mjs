import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_TRANSIT_SERVICE_CONFIG,
  isTransitServiceConfigured,
  isTransitServiceVisible,
  normalizeTransitServiceConfig,
  normalizeTransitServiceUrl,
  readTransitServiceConfig,
  saveTransitServiceConfig,
  TRANSIT_SERVICE_STORAGE_KEY,
  validateTransitServiceUrl,
} from "../src/transit-service.js";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
};

test("accepts only normalized HTTPS destinations without embedded credentials", () => {
  assert.equal(normalizeTransitServiceUrl(" https://relay.example.com/path "), "https://relay.example.com/path");
  assert.equal(validateTransitServiceUrl("https://relay.example.com"), true);
  for (const unsafe of [
    "http://relay.example.com",
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///tmp/test",
    "mailto:hello@example.com",
    "https://user:secret@relay.example.com",
    "not a url",
  ]) {
    assert.equal(validateTransitServiceUrl(unsafe), false, `unsafe destination accepted: ${unsafe}`);
  }
});

test("distinguishes hidden, visible-unconfigured, and configured entry states", () => {
  assert.deepEqual(normalizeTransitServiceConfig({ enabled: false, url: "" }), {
    enabled: false,
    url: "",
  });
  assert.deepEqual(normalizeTransitServiceConfig({ enabled: true, url: "" }), {
    enabled: true,
    url: "",
  });
  assert.equal(normalizeTransitServiceConfig({ enabled: false, url: "javascript:alert(1)" }), null);
  assert.equal(isTransitServiceVisible({ enabled: false, url: "https://relay.example.com" }), false);
  assert.equal(isTransitServiceVisible({ enabled: true, url: "" }), true);
  assert.equal(isTransitServiceConfigured({ enabled: true, url: "" }), false);
  assert.equal(isTransitServiceVisible({ enabled: true, url: "https://relay.example.com" }), true);
  assert.equal(isTransitServiceConfigured({ enabled: true, url: "https://relay.example.com" }), true);
});

test("defaults to a visible unconfigured entry and preserves an explicit disable", () => {
  const storage = createStorage();
  assert.deepEqual(readTransitServiceConfig(storage), { enabled: true, url: "" });
  assert.equal(saveTransitServiceConfig(storage, { enabled: true, url: "" }), true);
  assert.deepEqual(readTransitServiceConfig(storage), { enabled: true, url: "" });
  assert.equal(saveTransitServiceConfig(storage, { enabled: false, url: "" }), true);
  assert.deepEqual(readTransitServiceConfig(storage), { enabled: false, url: "" });
});

test("persists a safe destination and falls back safely on damaged storage", () => {
  const storage = createStorage();
  const config = { enabled: true, url: "https://relay.example.com" };
  assert.equal(saveTransitServiceConfig(storage, config), true);
  assert.deepEqual(JSON.parse(storage.getItem(TRANSIT_SERVICE_STORAGE_KEY)), {
    enabled: true,
    url: "https://relay.example.com/",
  });
  assert.deepEqual(readTransitServiceConfig(storage), {
    enabled: true,
    url: "https://relay.example.com/",
  });

  storage.setItem(TRANSIT_SERVICE_STORAGE_KEY, "{\"enabled\":true,\"url\":\"javascript:alert(1)\"}");
  assert.deepEqual(readTransitServiceConfig(storage), DEFAULT_TRANSIT_SERVICE_CONFIG);
  storage.setItem(TRANSIT_SERVICE_STORAGE_KEY, "{broken");
  assert.deepEqual(readTransitServiceConfig(storage), DEFAULT_TRANSIT_SERVICE_CONFIG);
});

test("renders a bilingual safe external link and keeps admin support settings separate", async () => {
  const [linkSource, adminSource, css] = await Promise.all([
    readFile(new URL("../src/TransitServiceLink.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/AdminApp.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  ]);
  for (const evidence of [
    "中转站服务",
    "Transit Service",
    "onUnavailable",
    'target="_blank"',
    'rel="noopener noreferrer"',
  ]) {
    assert.ok(linkSource.includes(evidence), `missing external-link evidence: ${evidence}`);
  }
  assert.ok(adminSource.includes("悬浮客服入口"));
  assert.ok(adminSource.includes("外部服务入口"));
  assert.ok(adminSource.includes("当前是本地原型配置"));
  assert.equal(css.includes(".transit-service-link strong {\n  overflow: hidden"), false);
  assert.ok(css.includes("white-space: nowrap"));
  assert.ok(css.includes("transitServiceFloat"));
  assert.ok(css.includes("prefers-reduced-motion"));
  assert.ok(
    css.includes("rgba(183, 121, 47, 0.78)") && css.includes("blur(22px) saturate(135%)"),
    "floating entry must use the translucent bronze glass surface",
  );
});
