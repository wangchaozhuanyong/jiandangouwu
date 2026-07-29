import type { Money } from "./common.js";

export const productStatuses = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type ProductStatus = (typeof productStatuses)[number];

export const stockModes = ["FINITE", "UNLIMITED"] as const;
export type StockMode = (typeof stockModes)[number];

export type CategorySummary = {
  id: string;
  slug: string;
  name: string;
  order: number;
};

export type ProductSummary = {
  id: string;
  slug: string;
  categoryId: string;
  name: string;
  kicker: string;
  imageUrl: string;
  price: Money;
  compareAtPrice: Money | null;
  referencePrice: Money | null;
  stockMode: StockMode;
  stockQuantity: number | null;
  status: ProductStatus;
};

export type ProductDetail = ProductSummary & {
  description: string;
  category: CategorySummary;
};
