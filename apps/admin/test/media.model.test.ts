import assert from "node:assert/strict";
import test from "node:test";
import type { AdminHero } from "@cloudbridge/contracts";
import type { AdminProduct } from "../src/api";
import {
  buildReferencedMediaAssets,
  filterReferencedMediaAssets,
  isSafeReferencedMediaPath,
  mergeMediaInventory,
  summarizeReferencedMediaAssets,
} from "../src/features/media/model";

const product = (
  id: string,
  imageKey: string,
  nameZh: string,
  overrides: Partial<AdminProduct> = {},
): AdminProduct => ({
  id,
  slug: id,
  imageKey,
  basePrice: "89.00",
  compareAtPrice: null,
  stockMode: "FINITE",
  stockQuantity: 8,
  status: "ACTIVE",
  sortOrder: 1,
  version: 1,
  category: {
    id: "category-1",
    slug: "development",
    name: { zh: "开发", en: "Development" },
  },
  translations: {
    zh: { name: nameZh, kicker: "开发", description: "中文说明" },
    en: { name: `${id} service`, kicker: "Development", description: "English description" },
  },
  updatedAt: "2026-07-29T10:00:00.000Z",
  ...overrides,
});

const hero = (
  id: string,
  imageKey: string,
  titleZh: string,
  overrides: Partial<AdminHero> = {},
): AdminHero => ({
  id,
  key: id,
  imageKey,
  targetSlug: null,
  tone: "cyan",
  status: "ACTIVE",
  sortOrder: 1,
  version: 1,
  translations: {
    zh: { eyebrow: "云桥", title: titleZh, body: "中文正文", cta: "查看" },
    en: { eyebrow: "CloudBridge", title: `${id} hero`, body: "English body", cta: "View" },
  },
  createdAt: "2026-07-28T10:00:00.000Z",
  updatedAt: "2026-07-29T11:00:00.000Z",
  ...overrides,
});

test("media inventory collapses matching paths while preserving every real database reference", () => {
  const assets = buildReferencedMediaAssets(
    [
      product("codex", "/assets/shared.webp", "Codex 专业版"),
      product("claude", "/assets/product-claude.webp", "Claude 专业版"),
    ],
    [hero("main", "/assets/shared.webp", "主视觉")],
  );

  assert.deepEqual(assets.map((asset) => asset.imageKey), [
    "/assets/product-claude.webp",
    "/assets/shared.webp",
  ]);
  const shared = assets[1];
  assert.ok(shared);
  assert.deepEqual(shared.kinds, ["hero", "product"]);
  assert.deepEqual(
    shared.references.map((reference) => `${reference.kind}:${reference.recordKey}`),
    ["hero:main", "product:codex"],
  );
  assert.equal(shared.lastUpdatedAt, "2026-07-29T11:00:00.000Z");
});

test("media path safety accepts only normalized local raster assets", () => {
  assert.equal(isSafeReferencedMediaPath("/assets/product-codex.webp"), true);
  assert.equal(isSafeReferencedMediaPath("/assets/nested/hero-main.avif"), true);
  assert.equal(
    isSafeReferencedMediaPath(
      "/media/uploads/2026/07/123e4567-e89b-12d3-a456-426614174000-hero.webp",
    ),
    true,
  );
  assert.equal(isSafeReferencedMediaPath("/media/backups/production.webp"), false);
  assert.equal(isSafeReferencedMediaPath("/assets/../secret.png"), false);
  assert.equal(isSafeReferencedMediaPath("/assets//hero.png"), false);
  assert.equal(isSafeReferencedMediaPath("https://example.com/hero.webp"), false);
  assert.equal(isSafeReferencedMediaPath("/assets/script.svg"), false);
});

test("media filters combine source type with normalized path and bilingual usage search", () => {
  const assets = buildReferencedMediaAssets(
    [product("codex", "/assets/product-codex.webp", "编码助手")],
    [hero("main", "/assets/hero-main.webp", "跨境服务")],
  );

  assert.deepEqual(
    filterReferencedMediaAssets(assets, { kind: "product", query: "ＣＯＤＥＸ" })
      .map((asset) => asset.fileName),
    ["product-codex.webp"],
  );
  assert.deepEqual(
    filterReferencedMediaAssets(assets, { kind: "hero", query: "跨境" })
      .map((asset) => asset.fileName),
    ["hero-main.webp"],
  );
  assert.equal(filterReferencedMediaAssets(assets, { kind: "product", query: "跨境" }).length, 0);
});

test("media summary reports unique paths, references, source counts, and unsafe records", () => {
  const assets = buildReferencedMediaAssets(
    [
      product("codex", "/assets/shared.webp", "Codex"),
      product("unsafe", "/assets/../unsafe.webp", "Unsafe"),
    ],
    [hero("main", "/assets/shared.webp", "Main")],
  );

  assert.deepEqual(summarizeReferencedMediaAssets(assets), {
    uniqueAssets: 2,
    totalReferences: 3,
    heroReferences: 1,
    productReferences: 2,
    supportReferences: 0,
    invalidPaths: 1,
    managedObjects: 0,
    unreferencedManagedObjects: 0,
    missingManagedObjects: 0,
  });
});

test("media inventory merges R2 metadata with references and preserves unreferenced objects", () => {
  const path = "/media/uploads/2026/07/123e4567-e89b-12d3-a456-426614174000-shared.webp";
  const referenced = buildReferencedMediaAssets(
    [product("codex", path, "Codex")],
    [],
  );
  const assets = mergeMediaInventory(referenced, [
    {
      key: "uploads/2026/07/123e4567-e89b-12d3-a456-426614174000-shared.webp",
      path,
      fileName: "shared.webp",
      contentType: "image/webp",
      byteSize: 2048,
      uploadedByEmail: "owner@example.test",
      createdAt: "2026-07-29T12:00:00.000Z",
      storageStatus: "AVAILABLE",
      productReferences: 1,
      heroReferences: 0,
      supportReferences: 0,
    },
    {
      key: "uploads/2026/07/223e4567-e89b-12d3-a456-426614174000-unused.png",
      path: "/media/uploads/2026/07/223e4567-e89b-12d3-a456-426614174000-unused.png",
      fileName: "unused.png",
      contentType: "image/png",
      byteSize: 1024,
      uploadedByEmail: "owner@example.test",
      createdAt: "2026-07-29T13:00:00.000Z",
      storageStatus: "AVAILABLE",
      productReferences: 0,
      heroReferences: 0,
      supportReferences: 0,
    },
  ]);

  assert.equal(assets.length, 2);
  assert.equal(assets.find((asset) => asset.imageKey === path)?.references.length, 1);
  assert.equal(
    filterReferencedMediaAssets(assets, { kind: "unreferenced", query: "" })[0]?.fileName,
    "unused.png",
  );
  assert.deepEqual(summarizeReferencedMediaAssets(assets), {
    uniqueAssets: 2,
    totalReferences: 1,
    heroReferences: 0,
    productReferences: 1,
    supportReferences: 0,
    invalidPaths: 0,
    managedObjects: 2,
    unreferencedManagedObjects: 1,
    missingManagedObjects: 0,
  });
});
