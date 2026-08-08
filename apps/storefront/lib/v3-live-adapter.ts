import type {
  Locale,
  PlatformKey,
  ProductDetail,
  ProductSummary,
  ProductSurface,
  TransitPlanType,
} from "@cloudbridge/contracts";
import { STOREFRONT_LOW_STOCK_MAX } from "@cloudbridge/contracts";

export type V3Availability = "available" | "low-stock" | "sold-out" | "unavailable";

export type V3LiveProductCard = {
  id: string;
  slug: string;
  name: string;
  kicker: string;
  imageUrl: string;
  priceText: string;
  compareAtPriceText: string | null;
  referencePriceText: string | null;
  availability: V3Availability;
  availabilityLabel: string;
  canAddToCart: boolean;
  stockLabel: string | null;
  platformLabel: string | null;
  transitPlanLabel: string | null;
  surfaces: ProductSurface[];
  source: ProductSummary;
};

export type V3LiveProductDetail = V3LiveProductCard & {
  description: string;
  category: ProductDetail["category"];
  source: ProductDetail;
};

const platformLabels: Record<PlatformKey, string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
  GOOGLE: "Google",
  MIDJOURNEY: "Midjourney",
  PERPLEXITY: "Perplexity",
  CURSOR: "Cursor",
  OTHER: "Other",
};

const transitPlanLabels: Record<TransitPlanType, { zh: string; en: string }> = {
  SUBSCRIPTION: { zh: "订阅", en: "Subscription" },
  USAGE: { zh: "用量", en: "Usage" },
  TEAM: { zh: "团队", en: "Team" },
};

export function formatV3Money(
  amount: string,
  currency: string,
  locale: Locale,
): string {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return `${amount} ${currency}`;
  if (currency === "USDT") return `${amount} USDT`;
  try {
    return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: Number.isInteger(numeric) ? 0 : undefined,
      maximumFractionDigits: 8,
    }).format(numeric);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function getV3Availability(product: ProductSummary): V3Availability {
  if (product.status !== "ACTIVE") return "unavailable";
  if (product.stockMode === "UNLIMITED") return "available";
  const quantity = product.stockQuantity ?? 0;
  if (quantity <= 0) return "sold-out";
  if (quantity <= STOREFRONT_LOW_STOCK_MAX) return "low-stock";
  return "available";
}

function availabilityLabel(status: V3Availability, locale: Locale): string {
  const labels = {
    zh: {
      available: "可办理",
      "low-stock": "库存紧张",
      "sold-out": "暂时售罄",
      unavailable: "暂不可办理",
    },
    en: {
      available: "Available",
      "low-stock": "Low stock",
      "sold-out": "Sold out",
      unavailable: "Unavailable",
    },
  } as const;
  return labels[locale][status];
}

function stockLabel(product: ProductSummary, locale: Locale): string | null {
  if (product.stockMode !== "FINITE" || product.stockQuantity == null) return null;
  if (product.stockQuantity <= 0 || product.stockQuantity > STOREFRONT_LOW_STOCK_MAX) return null;
  return locale === "zh"
    ? `仅剩 ${product.stockQuantity}`
    : `Only ${product.stockQuantity} left`;
}

export function toV3LiveProductCard(
  product: ProductSummary,
  locale: Locale,
): V3LiveProductCard {
  const availability = getV3Availability(product);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    kicker: product.kicker,
    imageUrl: product.imageUrl,
    priceText: formatV3Money(product.price.amount, product.price.currency, locale),
    compareAtPriceText: product.compareAtPrice
      ? formatV3Money(
          product.compareAtPrice.amount,
          product.compareAtPrice.currency,
          locale,
        )
      : null,
    referencePriceText: product.referencePrice
      ? formatV3Money(
          product.referencePrice.amount,
          product.referencePrice.currency,
          locale,
        )
      : null,
    availability,
    availabilityLabel: availabilityLabel(availability, locale),
    canAddToCart: availability === "available" || availability === "low-stock",
    stockLabel: stockLabel(product, locale),
    platformLabel: product.platformKey
      ? platformLabels[product.platformKey]
      : null,
    transitPlanLabel: product.transitPlanType
      ? transitPlanLabels[product.transitPlanType][locale]
      : null,
    surfaces: product.surfaces ?? [],
    source: product,
  };
}

export function toV3LiveProductDetail(
  product: ProductDetail,
  locale: Locale,
): V3LiveProductDetail {
  return {
    ...toV3LiveProductCard(product, locale),
    description: product.description,
    category: product.category,
    source: product,
  };
}
