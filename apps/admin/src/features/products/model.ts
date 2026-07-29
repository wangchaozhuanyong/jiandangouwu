import type {
  AdminCategory,
  AdminProduct,
} from "../../api";

export const STOREFRONT_LOW_STOCK_MAX = 3;

export type ProductImpactSignal =
  | "MISSING_TRANSLATION"
  | "STOCK_DATA_CONFLICT"
  | "CATEGORY_NOT_LOADED"
  | "CATEGORY_NOT_ACTIVE"
  | "ACTIVE_SOLD_OUT"
  | "ACTIVE_LOW_STOCK"
  | "ORDER_REPEATED"
  | "CLEAR";

export type ProductCategoryState =
  | AdminCategory["status"]
  | "NOT_LOADED"
  | "NOT_CHECKED";

export type ProductImpactRow = AdminProduct & {
  categoryState: ProductCategoryState;
  signal: ProductImpactSignal;
};

export type ProductImpactSummary = {
  loadedProductCount: number;
  activeProductCount: number;
  nonActiveProductCount: number;
  finiteStockCount: number;
  unlimitedStockCount: number;
  activeSoldOutCount: number;
  activeLowStockCount: number;
  missingTranslationCount: number;
  stockDataConflictCount: number;
  categoryNavigationMismatchCount: number;
  repeatedOrderProductCount: number;
  needsReviewCount: number;
  categoryCrossCheckAvailable: boolean;
  rows: ProductImpactRow[];
};

const missingLocalizedContent = (product: AdminProduct): boolean => {
  const zh = product.translations.zh;
  const en = product.translations.en;
  return (
    !zh?.name?.trim()
    || !zh?.kicker?.trim()
    || !zh?.description?.trim()
    || !en?.name?.trim()
    || !en?.kicker?.trim()
    || !en?.description?.trim()
  );
};

const hasStockDataConflict = (product: AdminProduct): boolean => (
  product.stockMode === "FINITE"
    ? (
      product.stockQuantity === null
      || !Number.isSafeInteger(product.stockQuantity)
      || product.stockQuantity < 0
    )
    : product.stockQuantity !== null
);

export function buildProductImpact(
  products: readonly AdminProduct[],
  categories: readonly AdminCategory[] | null,
): ProductImpactSummary {
  const activeOrderCounts = new Map<number, number>();
  for (const product of products) {
    if (product.status !== "ACTIVE") continue;
    activeOrderCounts.set(
      product.sortOrder,
      (activeOrderCounts.get(product.sortOrder) ?? 0) + 1,
    );
  }

  const categoriesById = categories === null
    ? null
    : new Map(categories.map((category) => [category.id, category]));

  const rows = [...products]
    .sort((left, right) => (
      left.sortOrder - right.sortOrder
      || left.slug.localeCompare(right.slug)
      || left.id.localeCompare(right.id)
    ))
    .map((product): ProductImpactRow => {
      const category = categoriesById?.get(product.category.id);
      const categoryState: ProductCategoryState = categoriesById === null
        ? "NOT_CHECKED"
        : category?.status ?? "NOT_LOADED";
      const missingTranslation = missingLocalizedContent(product);
      const stockConflict = hasStockDataConflict(product);
      const active = product.status === "ACTIVE";
      const finiteQuantity = product.stockMode === "FINITE"
        ? product.stockQuantity
        : null;
      const categoryNotLoaded = active && categoryState === "NOT_LOADED";
      const categoryNotActive = active
        && !["NOT_CHECKED", "NOT_LOADED", "ACTIVE"].includes(categoryState);
      const soldOut = active && finiteQuantity === 0;
      const lowStock = active
        && finiteQuantity !== null
        && finiteQuantity > 0
        && finiteQuantity <= STOREFRONT_LOW_STOCK_MAX;
      const repeatedOrder = active
        && (activeOrderCounts.get(product.sortOrder) ?? 0) > 1;

      let signal: ProductImpactSignal = "CLEAR";
      if (missingTranslation) signal = "MISSING_TRANSLATION";
      else if (stockConflict) signal = "STOCK_DATA_CONFLICT";
      else if (categoryNotLoaded) signal = "CATEGORY_NOT_LOADED";
      else if (categoryNotActive) signal = "CATEGORY_NOT_ACTIVE";
      else if (soldOut) signal = "ACTIVE_SOLD_OUT";
      else if (lowStock) signal = "ACTIVE_LOW_STOCK";
      else if (repeatedOrder) signal = "ORDER_REPEATED";

      return { ...product, categoryState, signal };
    });

  const activeProducts = rows.filter((product) => product.status === "ACTIVE");
  const isActiveFiniteQuantity = (
    product: AdminProduct,
    predicate: (quantity: number) => boolean,
  ): boolean => (
    product.status === "ACTIVE"
    && product.stockMode === "FINITE"
    && product.stockQuantity !== null
    && Number.isSafeInteger(product.stockQuantity)
    && predicate(product.stockQuantity)
  );

  return {
    loadedProductCount: rows.length,
    activeProductCount: activeProducts.length,
    nonActiveProductCount: rows.length - activeProducts.length,
    finiteStockCount: rows.filter((product) => product.stockMode === "FINITE").length,
    unlimitedStockCount: rows.filter((product) => product.stockMode === "UNLIMITED").length,
    activeSoldOutCount: rows.filter(
      (product) => isActiveFiniteQuantity(product, (quantity) => quantity === 0),
    ).length,
    activeLowStockCount: rows.filter(
      (product) => isActiveFiniteQuantity(
        product,
        (quantity) => quantity > 0 && quantity <= STOREFRONT_LOW_STOCK_MAX,
      ),
    ).length,
    missingTranslationCount: rows.filter(missingLocalizedContent).length,
    stockDataConflictCount: rows.filter(hasStockDataConflict).length,
    categoryNavigationMismatchCount: rows.filter((product) => (
      product.status === "ACTIVE"
      && ["NOT_LOADED", "DRAFT", "INACTIVE", "ARCHIVED"].includes(product.categoryState)
    )).length,
    repeatedOrderProductCount: activeProducts.filter(
      (product) => (activeOrderCounts.get(product.sortOrder) ?? 0) > 1,
    ).length,
    needsReviewCount: rows.filter((product) => product.signal !== "CLEAR").length,
    categoryCrossCheckAvailable: categoriesById !== null,
    rows,
  };
}
