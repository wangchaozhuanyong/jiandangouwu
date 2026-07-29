import type { AdminCategory } from "../../api";

export type CategoryImpactSignal =
  | "MISSING_TRANSLATION"
  | "NON_ACTIVE_WITH_PRODUCTS"
  | "ORDER_REPEATED"
  | "EMPTY"
  | "CLEAR";

export type CategoryImpactRow = AdminCategory & {
  signal: CategoryImpactSignal;
};

export type CategoryImpactSummary = {
  loadedCategoryCount: number;
  activeCategoryCount: number;
  nonActiveCategoryCount: number;
  loadedProductAssignmentCount: number;
  emptyCategoryCount: number;
  repeatedOrderCategoryCount: number;
  missingTranslationCount: number;
  rows: CategoryImpactRow[];
};

export function buildCategoryImpact(
  categories: readonly AdminCategory[],
): CategoryImpactSummary {
  const orderCounts = new Map<number, number>();
  for (const category of categories) {
    orderCounts.set(
      category.sortOrder,
      (orderCounts.get(category.sortOrder) ?? 0) + 1,
    );
  }

  const rows = [...categories]
    .sort((left, right) => (
      left.sortOrder - right.sortOrder
      || left.slug.localeCompare(right.slug)
      || left.id.localeCompare(right.id)
    ))
    .map((category): CategoryImpactRow => {
      const missingTranslation = !category.name.zh.trim() || !category.name.en.trim();
      const repeatedOrder = (orderCounts.get(category.sortOrder) ?? 0) > 1;

      let signal: CategoryImpactSignal = "CLEAR";
      if (missingTranslation) signal = "MISSING_TRANSLATION";
      else if (category.status !== "ACTIVE" && category.productCount > 0) {
        signal = "NON_ACTIVE_WITH_PRODUCTS";
      } else if (repeatedOrder) signal = "ORDER_REPEATED";
      else if (category.productCount === 0) signal = "EMPTY";

      return { ...category, signal };
    });

  return {
    loadedCategoryCount: rows.length,
    activeCategoryCount: rows.filter((category) => category.status === "ACTIVE").length,
    nonActiveCategoryCount: rows.filter((category) => category.status !== "ACTIVE").length,
    loadedProductAssignmentCount: rows.reduce(
      (total, category) => total + Math.max(0, category.productCount),
      0,
    ),
    emptyCategoryCount: rows.filter((category) => category.productCount === 0).length,
    repeatedOrderCategoryCount: rows.filter(
      (category) => (orderCounts.get(category.sortOrder) ?? 0) > 1,
    ).length,
    missingTranslationCount: rows.filter(
      (category) => !category.name.zh.trim() || !category.name.en.trim(),
    ).length,
    rows,
  };
}
