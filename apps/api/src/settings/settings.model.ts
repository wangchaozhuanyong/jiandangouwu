import {
  DEFAULT_INVENTORY_RISK_THRESHOLD,
  INVENTORY_RISK_THRESHOLD_MAX,
  INVENTORY_RISK_THRESHOLD_MIN,
  type StorefrontSettings,
} from "@cloudbridge/contracts";

export const STOREFRONT_SETTINGS_KEY = "storefront.settings";
export const POLICY_VERSION_KEY = "policy.currentVersion";

export const DEFAULT_STOREFRONT_SETTINGS: StorefrontSettings = {
  siteName: {
    zh: "云桥",
    en: "CloudBridge",
  },
  defaultLocale: "zh",
  seoDescription: {
    zh: "精选全球 AI 工具，以清楚的价格、库存与人工服务连接需求。",
    en: "Global AI services with clear pricing, availability, and human support.",
  },
  policyVersion: "2026-07-27",
  acceptOrders: true,
  supportEnabled: true,
  inventoryRiskThreshold: DEFAULT_INVENTORY_RISK_THRESHOLD,
  transitServiceEnabled: true,
  transitServiceUrl: null,
};

const objectValue = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const nonEmptyString = (value: unknown, fallback: string, maxLength: number): string =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim().slice(0, maxLength)
    : fallback;

const booleanValue = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const inventoryRiskThresholdValue = (value: unknown): number =>
  Number.isSafeInteger(value)
    && Number(value) >= INVENTORY_RISK_THRESHOLD_MIN
    && Number(value) <= INVENTORY_RISK_THRESHOLD_MAX
    ? Number(value)
    : DEFAULT_INVENTORY_RISK_THRESHOLD;

const policyVersionOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(normalized)
    ? normalized
    : null;
};

const httpsUrlOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export function parseStorefrontSettings(
  value: unknown,
  fallbackPolicyVersion = DEFAULT_STOREFRONT_SETTINGS.policyVersion,
): StorefrontSettings {
  const source = objectValue(value);
  const siteName = objectValue(source.siteName);
  const seoDescription = objectValue(source.seoDescription);
  return {
    siteName: {
      zh: nonEmptyString(siteName.zh, DEFAULT_STOREFRONT_SETTINGS.siteName.zh, 120),
      en: nonEmptyString(siteName.en, DEFAULT_STOREFRONT_SETTINGS.siteName.en, 120),
    },
    defaultLocale: source.defaultLocale === "en" ? "en" : "zh",
    seoDescription: {
      zh: nonEmptyString(
        seoDescription.zh,
        DEFAULT_STOREFRONT_SETTINGS.seoDescription.zh,
        500,
      ),
      en: nonEmptyString(
        seoDescription.en,
        DEFAULT_STOREFRONT_SETTINGS.seoDescription.en,
        500,
      ),
    },
    policyVersion: nonEmptyString(source.policyVersion, fallbackPolicyVersion, 80),
    acceptOrders: booleanValue(source.acceptOrders, DEFAULT_STOREFRONT_SETTINGS.acceptOrders),
    supportEnabled: booleanValue(source.supportEnabled, DEFAULT_STOREFRONT_SETTINGS.supportEnabled),
    inventoryRiskThreshold: inventoryRiskThresholdValue(source.inventoryRiskThreshold),
    transitServiceEnabled: booleanValue(
      source.transitServiceEnabled,
      DEFAULT_STOREFRONT_SETTINGS.transitServiceEnabled,
    ),
    transitServiceUrl: httpsUrlOrNull(source.transitServiceUrl),
  };
}

export function parseOrderGateSettings(
  value: unknown,
  fallbackPolicyVersion = DEFAULT_STOREFRONT_SETTINGS.policyVersion,
): Pick<StorefrontSettings, "acceptOrders" | "policyVersion"> {
  const source = objectValue(value);
  const storedPolicyVersion = policyVersionOrNull(source.policyVersion);
  const safeFallbackPolicyVersion = policyVersionOrNull(fallbackPolicyVersion)
    ?? DEFAULT_STOREFRONT_SETTINGS.policyVersion;
  return {
    acceptOrders: source.acceptOrders === true && storedPolicyVersion !== null,
    policyVersion: storedPolicyVersion ?? safeFallbackPolicyVersion,
  };
}
