import type { Money } from "./common.js";

export const productStatuses = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type ProductStatus = (typeof productStatuses)[number];

export const stockModes = ["FINITE", "UNLIMITED"] as const;
export type StockMode = (typeof stockModes)[number];

export const STOREFRONT_LOW_STOCK_MAX = 3;
export const INVENTORY_RISK_THRESHOLD_MIN = 1;
export const INVENTORY_RISK_THRESHOLD_MAX = 99;
export const DEFAULT_INVENTORY_RISK_THRESHOLD = STOREFRONT_LOW_STOCK_MAX;

export const adminInventoryRiskLevels = [
  "INVALID_STOCK",
  "SOLD_OUT",
  "LOW_STOCK",
] as const;
export type AdminInventoryRiskLevel = (typeof adminInventoryRiskLevels)[number];

export type AdminInventoryRiskItem = {
  id: string;
  slug: string;
  name: Record<"zh" | "en", string>;
  stockQuantity: number | null;
  risk: AdminInventoryRiskLevel;
  updatedAt: string;
};

export type AdminInventoryRiskSummary = {
  source: "LIVE_DATABASE_QUERY";
  threshold: number;
  evaluatedProductCount: number;
  affectedProductCount: number;
  soldOutCount: number;
  lowStockCount: number;
  invalidStockCount: number;
  sampleLimit: number;
  items: AdminInventoryRiskItem[];
};

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
