import assert from "node:assert/strict";
import test from "node:test";
import type { AdminCategory } from "../src/api";
import { buildCategoryImpact } from "../src/features/categories/model";

const category = (
  id: string,
  overrides: Partial<AdminCategory> = {},
): AdminCategory => ({
  id,
  slug: id,
  status: "ACTIVE",
  sortOrder: 1,
  version: 1,
  name: { zh: `分类 ${id}`, en: `Category ${id}` },
  productCount: 2,
  updatedAt: "2026-07-29T12:00:00.000Z",
  ...overrides,
});

test("category impact uses only loaded categories and product assignments", () => {
  const result = buildCategoryImpact([
    category("active", { sortOrder: 2, productCount: 3 }),
    category("inactive", {
      status: "INACTIVE",
      sortOrder: 3,
      productCount: 2,
    }),
    category("empty", { sortOrder: 4, productCount: 0 }),
  ]);

  assert.equal(result.loadedCategoryCount, 3);
  assert.equal(result.activeCategoryCount, 2);
  assert.equal(result.nonActiveCategoryCount, 1);
  assert.equal(result.loadedProductAssignmentCount, 5);
  assert.equal(result.emptyCategoryCount, 1);
  assert.equal(result.rows.find((row) => row.id === "inactive")?.signal, "NON_ACTIVE_WITH_PRODUCTS");
  assert.equal(result.rows.find((row) => row.id === "empty")?.signal, "EMPTY");
});

test("category impact detects repeated orders without inventing a reorder result", () => {
  const result = buildCategoryImpact([
    category("z-last", { sortOrder: 7 }),
    category("a-first", { sortOrder: 7 }),
  ]);

  assert.equal(result.repeatedOrderCategoryCount, 2);
  assert.deepEqual(result.rows.map((row) => row.id), ["a-first", "z-last"]);
  assert.deepEqual(result.rows.map((row) => row.signal), ["ORDER_REPEATED", "ORDER_REPEATED"]);
});

test("missing bilingual content takes precedence over other impact signals", () => {
  const result = buildCategoryImpact([
    category("missing", {
      name: { zh: "只有中文", en: " " },
      productCount: 0,
    }),
  ]);

  assert.equal(result.missingTranslationCount, 1);
  assert.equal(result.rows[0]?.signal, "MISSING_TRANSLATION");
});

test("negative product counts never reduce the loaded assignment total", () => {
  const result = buildCategoryImpact([
    category("damaged", { productCount: -4 }),
    category("valid", { sortOrder: 2, productCount: 3 }),
  ]);

  assert.equal(result.loadedProductAssignmentCount, 3);
});
