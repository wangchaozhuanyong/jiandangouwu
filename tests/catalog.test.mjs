import assert from "node:assert/strict";
import test from "node:test";
import {
  filterCatalogProducts,
  moveProductCategory,
  normalizeProductQuery,
  readProductCategories,
  readProductCategoryAssignments,
  saveProductCategories,
  saveProductCategoryAssignments,
} from "../src/catalog.js";
import { productCategories, products } from "../src/data.js";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
};

test("normalizes multilingual search text and fuzzy-matches product names", () => {
  assert.equal(normalizeProductQuery("  CODEX  专业版 "), "codex 专业版");
  assert.deepEqual(
    filterCatalogProducts(products, { query: "dex 专业" }).map((product) => product.id),
    ["codex"],
  );
  assert.deepEqual(
    filterCatalogProducts(products, { query: "github copi" }).map((product) => product.id),
    ["copilot"],
  );
});

test("combines category and keyword filters", () => {
  assert.deepEqual(
    filterCatalogProducts(products, { categoryId: "development", query: "pro" }).map((product) => product.id),
    ["codex", "cursor"],
  );
  assert.deepEqual(filterCatalogProducts(products, { categoryId: "creative" }).map((product) => product.id), ["midjourney"]);
});

test("moves categories without losing stable ids", () => {
  const moved = moveProductCategory(productCategories, "development", 1);
  assert.deepEqual(moved.map((category) => category.id), ["assistant", "development", "research", "creative"]);
  assert.deepEqual(moved.map((category) => category.order), [1, 2, 3, 4]);
});

test("persists category configuration and product assignments safely", () => {
  const storage = createStorage();
  const categories = productCategories.map((category) => ({ ...category }));
  const assignments = Object.fromEntries(products.map((product) => [product.id, product.categoryId]));

  assert.equal(saveProductCategories(storage, categories), true);
  assert.equal(saveProductCategoryAssignments(storage, assignments), true);
  assert.deepEqual(readProductCategories(storage, []), categories);
  assert.deepEqual(readProductCategoryAssignments(storage, products), assignments);
});

test("falls back when stored category data is malformed", () => {
  const storage = createStorage();
  storage.setItem("cloudbridge-product-categories", "{\"bad\":true}");
  storage.setItem("cloudbridge-product-category-assignments", "[]");

  assert.equal(readProductCategories(storage, productCategories), productCategories);
  assert.deepEqual(
    readProductCategoryAssignments(storage, products),
    Object.fromEntries(products.map((product) => [product.id, product.categoryId])),
  );
});
