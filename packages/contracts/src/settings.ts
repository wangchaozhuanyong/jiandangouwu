import type { Locale, LocalizedText } from "./common.js";
import type { ProductSurface } from "./catalog.js";

export const DEFAULT_SHARE_TEMPLATE: LocalizedText = {
  zh: "推荐你看看 {productName}，当前价格 {price}。",
  en: "Take a look at {productName}, currently {price}.",
};

export type StorefrontSettings = {
  siteName: LocalizedText;
  defaultLocale: Locale;
  seoDescription: LocalizedText;
  policyVersion: string;
  acceptOrders: boolean;
  supportEnabled: boolean;
  inventoryRiskThreshold: number;
  transitServiceEnabled: boolean;
  transitServiceUrl: string | null;
  bannerVisibility: Record<ProductSurface, boolean>;
  shareTemplate: LocalizedText;
};

export type AdminStorefrontSettings = StorefrontSettings & {
  version: number;
  updatedAt: string;
  orderReadiness: {
    activeContactChannels: number;
    configuredActiveContactChannels: number;
  };
};

export type UpdateStorefrontSettingsInput = StorefrontSettings & {
  version: number;
  reason: string;
};
