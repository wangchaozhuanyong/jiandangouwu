import assert from "node:assert/strict";
import test from "node:test";
import type {
  AdminCategory,
  AdminProduct,
} from "../src/api";
import {
  adminProductQuerySearch,
  buildProductImpact,
  productFilterFromQuery,
  productQueryFromFilter,
  readAdminProductQuery,
  STOREFRONT_LOW_STOCK_MAX,
} from "../src/features/products/model";

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
  productCount: 1,
  updatedAt: "2026-07-29T12:00:00.000Z",
  ...overrides,
});

const product = (
  id: string,
  overrides: Partial<AdminProduct> = {},
): AdminProduct => ({
  id,
  slug: id,
  imageKey: `/assets/${id}.webp`,
  basePrice: "19.90",
  compareAtPrice: null,
  stockMode: "FINITE",
  stockQuantity: 8,
  status: "ACTIVE",
  sortOrder: 1,
  version: 1,
  category: {
    id: "category-active",
    slug: "category-active",
    name: { zh: "启用分类", en: "Active category" },
  },
  translations: {
    zh: { name: `商品 ${id}`, kicker: "短标题", description: "中文说明" },
    en: { name: `Product ${id}`, kicker: "Kicker", description: "English description" },
  },
  updatedAt: "2026-07-29T12:00:00.000Z",
  ...overrides,
});

test("product URL query restores supported server filters and serializes canonically", () => {
  const query = readAdminProductQuery(
    "?page=3&pageSize=100&search=%20Codex%20&status=INACTIVE",
  );
  assert.deepEqual(query, {
    page: 3,
    pageSize: 30,
    search: "Codex",
    status: "INACTIVE",
  });
  assert.equal(
    adminProductQuerySearch(query),
    "page=3&search=Codex&status=INACTIVE",
  );
  assert.deepEqual(productFilterFromQuery(query), {
    search: "Codex",
    status: "INACTIVE",
  });
  assert.deepEqual(productQueryFromFilter({ search: "  Gemini  ", status: "ACTIVE" }), {
    page: 1,
    pageSize: 30,
    search: "Gemini",
    status: "ACTIVE",
  });
});

test("product URL query rejects unsupported state without propagating it to the API", () => {
  const query = readAdminProductQuery(
    "?page=1001&pageSize=1&search=%20%20&status=DELETED",
  );
  assert.deepEqual(query, {
    page: 1,
    pageSize: 30,
  });
  assert.equal(adminProductQuerySearch(query), "");
  assert.deepEqual(productQueryFromFilter({ search: " ", status: "all" }), query);
});

test("product impact summarizes only the loaded slice", () => {
  const result = buildProductImpact([
    product("active-finite", { stockQuantity: 8, sortOrder: 1 }),
    product("active-unlimited", {
      stockMode: "UNLIMITED",
      stockQuantity: null,
      sortOrder: 2,
    }),
    product("inactive", {
      status: "INACTIVE",
      stockQuantity: 2,
      sortOrder: 3,
    }),
  ], [category("category-active")]);

  assert.equal(result.loadedProductCount, 3);
  assert.equal(result.activeProductCount, 2);
  assert.equal(result.nonActiveProductCount, 1);
  assert.equal(result.finiteStockCount, 2);
  assert.equal(result.unlimitedStockCount, 1);
  assert.equal(result.activeLowStockCount, 0);
  assert.equal(result.activeSoldOutCount, 0);
});

test("storefront stock labels are projected at the existing zero and one-to-three boundaries", () => {
  const result = buildProductImpact([
    product("sold-out", { stockQuantity: 0, sortOrder: 1 }),
    product("low-one", { stockQuantity: 1, sortOrder: 2 }),
    product("low-max", {
      stockQuantity: STOREFRONT_LOW_STOCK_MAX,
      sortOrder: 3,
    }),
    product("available", {
      stockQuantity: STOREFRONT_LOW_STOCK_MAX + 1,
      sortOrder: 4,
    }),
    product("inactive-low", {
      status: "INACTIVE",
      stockQuantity: 2,
      sortOrder: 5,
    }),
  ], [category("category-active")]);

  assert.equal(result.activeSoldOutCount, 1);
  assert.equal(result.activeLowStockCount, 2);
  assert.equal(result.rows.find((row) => row.id === "sold-out")?.signal, "ACTIVE_SOLD_OUT");
  assert.equal(result.rows.find((row) => row.id === "low-one")?.signal, "ACTIVE_LOW_STOCK");
  assert.equal(result.rows.find((row) => row.id === "low-max")?.signal, "ACTIVE_LOW_STOCK");
  assert.equal(result.rows.find((row) => row.id === "available")?.signal, "CLEAR");
  assert.equal(result.rows.find((row) => row.id === "inactive-low")?.signal, "CLEAR");
});

test("missing bilingual content and invalid stock data take precedence", () => {
  const missing = product("missing", {
    stockQuantity: 0,
    translations: {
      zh: { name: "只有中文", kicker: "短标题", description: "中文说明" },
      en: { name: "", kicker: "", description: "" },
    },
  });
  const finiteWithoutQuantity = product("finite-without-quantity", {
    sortOrder: 2,
    stockQuantity: null,
  });
  const unlimitedWithQuantity = product("unlimited-with-quantity", {
    sortOrder: 3,
    stockMode: "UNLIMITED",
    stockQuantity: 4,
  });
  const result = buildProductImpact(
    [missing, finiteWithoutQuantity, unlimitedWithQuantity],
    [category("category-active")],
  );

  assert.equal(result.missingTranslationCount, 1);
  assert.equal(result.stockDataConflictCount, 2);
  assert.equal(result.rows.find((row) => row.id === "missing")?.signal, "MISSING_TRANSLATION");
  assert.equal(
    result.rows.find((row) => row.id === "finite-without-quantity")?.signal,
    "STOCK_DATA_CONFLICT",
  );
  assert.equal(
    result.rows.find((row) => row.id === "unlimited-with-quantity")?.signal,
    "STOCK_DATA_CONFLICT",
  );
});

test("category navigation mismatches are reported without claiming a category state when unchecked", () => {
  const inactiveCategoryProduct = product("inactive-category", {
    category: {
      id: "category-inactive",
      slug: "category-inactive",
      name: { zh: "停用分类", en: "Inactive category" },
    },
  });
  const missingCategoryProduct = product("missing-category", {
    sortOrder: 2,
    category: {
      id: "category-missing",
      slug: "category-missing",
      name: { zh: "未加载分类", en: "Unloaded category" },
    },
  });
  const checked = buildProductImpact(
    [inactiveCategoryProduct, missingCategoryProduct],
    [
      category("category-active"),
      category("category-inactive", { status: "INACTIVE" }),
    ],
  );
  const unchecked = buildProductImpact([inactiveCategoryProduct], null);

  assert.equal(checked.categoryNavigationMismatchCount, 2);
  assert.equal(
    checked.rows.find((row) => row.id === "inactive-category")?.signal,
    "CATEGORY_NOT_ACTIVE",
  );
  assert.equal(
    checked.rows.find((row) => row.id === "missing-category")?.signal,
    "CATEGORY_NOT_LOADED",
  );
  assert.equal(unchecked.categoryCrossCheckAvailable, false);
  assert.equal(unchecked.categoryNavigationMismatchCount, 0);
  assert.equal(unchecked.rows[0]?.categoryState, "NOT_CHECKED");
  assert.equal(unchecked.rows[0]?.signal, "CLEAR");
});

test("repeated active sort orders are deterministic and inactive duplicates are ignored", () => {
  const result = buildProductImpact([
    product("z-active", { sortOrder: 7 }),
    product("a-active", { sortOrder: 7 }),
    product("inactive", { status: "INACTIVE", sortOrder: 7 }),
  ], [category("category-active")]);

  assert.equal(result.repeatedOrderProductCount, 2);
  assert.deepEqual(
    result.rows.map((row) => row.id),
    ["a-active", "inactive", "z-active"],
  );
  assert.equal(result.rows.find((row) => row.id === "a-active")?.signal, "ORDER_REPEATED");
  assert.equal(result.rows.find((row) => row.id === "z-active")?.signal, "ORDER_REPEATED");
  assert.equal(result.rows.find((row) => row.id === "inactive")?.signal, "CLEAR");
});
