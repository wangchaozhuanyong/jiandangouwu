import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DOCUMENT_LOCALE_HEADER,
  resolveDocumentLanguage,
  resolveDocumentLocale,
} from "../lib/document-language.js";

const read = (file: string) => readFileSync(
  new URL(`../${file}`, import.meta.url),
  "utf8",
);

test("document locale follows only the supported first URL segment", () => {
  assert.equal(resolveDocumentLocale("/en"), "en");
  assert.equal(resolveDocumentLocale("/en/products/codex"), "en");
  assert.equal(resolveDocumentLocale("/zh/policies/privacy"), "zh");
  assert.equal(resolveDocumentLocale("/admin"), "zh");
  assert.equal(resolveDocumentLocale("/EN"), "zh");
  assert.equal(resolveDocumentLocale("/unknown"), "zh");
});

test("document language fails closed to Simplified Chinese", () => {
  assert.equal(DOCUMENT_LOCALE_HEADER, "x-cloudbridge-document-locale");
  assert.equal(resolveDocumentLanguage("en"), "en");
  assert.equal(resolveDocumentLanguage("zh"), "zh-CN");
  assert.equal(resolveDocumentLanguage("spoofed"), "zh-CN");
  assert.equal(resolveDocumentLanguage(null), "zh-CN");
});

test("the proxy overwrites the internal locale header and the root layout reads it", () => {
  const proxy = read("proxy.ts");
  const layout = read("app/layout.tsx");

  assert.match(proxy, /requestHeaders\.set\(\s*DOCUMENT_LOCALE_HEADER/u);
  assert.match(proxy, /resolveDocumentLocale\(request\.nextUrl\.pathname\)/u);
  assert.match(layout, /await headers\(\)/u);
  assert.match(layout, /requestHeaders\.get\(DOCUMENT_LOCALE_HEADER\)/u);
  assert.match(layout, /<html[\s\S]*?lang=\{documentLanguage\}[\s\S]*?>/u);
  assert.doesNotMatch(layout, /<html lang="zh-CN">/u);
});
