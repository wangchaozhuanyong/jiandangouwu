import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanProductUrl,
  copyProductShare,
  renderProductShareTemplate,
  tryNativeProductShare,
} from "../lib/product-share.js";

test("share templates replace supported values and strip query or hash from URLs", () => {
  assert.equal(
    renderProductShareTemplate("推荐 {productName}，价格 {price}", "Codex 专业版", "19.12 EUR"),
    "推荐 Codex 专业版，价格 19.12 EUR",
  );
  assert.equal(
    cleanProductUrl("https://example.test/zh/products/codex?currency=EUR#order"),
    "https://example.test/zh/products/codex",
  );
});

test("native share distinguishes success, cancellation, failure, and unsupported browsers", async () => {
  const payload = { title: "Codex", text: "Share Codex", url: "https://example.test/products/codex" };
  assert.equal(await tryNativeProductShare(async () => undefined, payload), "shared");
  assert.equal(await tryNativeProductShare(
    async () => {
      throw new DOMException("cancel", "AbortError");
    },
    payload,
  ), "cancelled");
  assert.equal(await tryNativeProductShare(async () => {
    throw new Error("share unavailable");
  }, payload), "failed");
  assert.equal(await tryNativeProductShare(undefined, payload), "unsupported");
});

test("copy fallback reports the real clipboard result", async () => {
  let written = "";
  assert.equal(await copyProductShare(async (value) => {
    written = value;
  }, "Share Codex", "https://example.test/products/codex"), true);
  assert.equal(written, "Share Codex\nhttps://example.test/products/codex");
  assert.equal(await copyProductShare(async () => {
    throw new Error("permission denied");
  }, "Share Codex", "https://example.test/products/codex"), false);
  assert.equal(await copyProductShare(undefined, "Share Codex", "https://example.test/products/codex"), false);
});
