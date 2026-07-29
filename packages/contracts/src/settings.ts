import type { Locale, LocalizedText } from "./common.js";

export type StorefrontSettings = {
  siteName: LocalizedText;
  defaultLocale: Locale;
  seoDescription: LocalizedText;
  policyVersion: string;
  acceptOrders: boolean;
  supportEnabled: boolean;
  transitServiceEnabled: boolean;
  transitServiceUrl: string | null;
};

export type AdminStorefrontSettings = StorefrontSettings & {
  version: number;
  updatedAt: string;
};

export type UpdateStorefrontSettingsInput = StorefrontSettings & {
  version: number;
  reason: string;
};
