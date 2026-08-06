import type {
  BannerPlacement,
  CategorySummary,
  Locale,
  ProductDetail,
  ProductSurface,
  ProductSummary,
  SkillCategorySummary,
  SkillDetail,
  SkillSummary,
  StorefrontBanner,
  StorefrontConfig,
} from "@cloudbridge/contracts";

export const STOREFRONT_BOOTSTRAP_HEADER = "x-cloudbridge-storefront-bootstrap";

export type StorefrontHomeBootstrap = {
  kind: "catalog";
  locale: Locale;
  surface: ProductSurface;
  placement: BannerPlacement;
  primary: string;
  secondary: string;
  search: string;
  data: {
    config: StorefrontConfig;
    categories: CategorySummary[];
    products: ProductSummary[];
    banners: StorefrontBanner[];
  };
};

export type StorefrontProductBootstrap = {
  kind: "product";
  locale: Locale;
  slug: string;
  data: {
    config: StorefrontConfig;
    product: ProductDetail | null;
  };
};

export type StorefrontSkillListBootstrap = {
  kind: "skills";
  locale: Locale;
  category: string;
  search: string;
  data: {
    config: StorefrontConfig;
    categories: SkillCategorySummary[];
    skills: SkillSummary[];
  };
};

export type StorefrontSkillDetailBootstrap = {
  kind: "skill";
  locale: Locale;
  slug: string;
  data: {
    config: StorefrontConfig;
    skill: SkillDetail | null;
  };
};

export type StorefrontCartBootstrap = {
  kind: "cart";
  locale: Locale;
  data: {
    config: StorefrontConfig;
    products: ProductSummary[];
  };
};

export type StorefrontUtilityBootstrap = {
  kind: "utility";
  locale: Locale;
  data: { config: StorefrontConfig };
};

export type StorefrontBootstrap =
  | StorefrontHomeBootstrap
  | StorefrontProductBootstrap
  | StorefrontSkillListBootstrap
  | StorefrontSkillDetailBootstrap
  | StorefrontCartBootstrap
  | StorefrontUtilityBootstrap;

export function encodeStorefrontBootstrap(value: StorefrontBootstrap): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8_192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8_192));
  }
  return btoa(binary);
}

export function decodeStorefrontBootstrap(
  value: string | null,
): StorefrontBootstrap | null {
  if (!value || value.length > 48_000) return null;
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    const decoded = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!isBootstrapShape(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function isBootstrapShape(value: unknown): value is StorefrontBootstrap {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StorefrontBootstrap>;
  if (candidate.locale !== "zh" && candidate.locale !== "en") return false;
  if (!candidate.data || typeof candidate.data !== "object") return false;
  if (candidate.kind === "catalog") {
    return (
      typeof candidate.surface === "string" &&
      typeof candidate.placement === "string" &&
      typeof candidate.primary === "string" &&
      typeof candidate.secondary === "string" &&
      typeof candidate.search === "string" &&
      Array.isArray(candidate.data.categories) &&
      Array.isArray(candidate.data.products) &&
      Array.isArray(candidate.data.banners) &&
      Boolean(candidate.data.config)
    );
  }
  if (candidate.kind === "product" || candidate.kind === "skill") {
    return (
      typeof candidate.slug === "string" &&
      Boolean(candidate.data.config) &&
      (candidate.kind === "product"
        ? "product" in candidate.data
        : "skill" in candidate.data)
    );
  }
  if (candidate.kind === "skills") {
    return (
      typeof candidate.category === "string" &&
      typeof candidate.search === "string" &&
      Array.isArray(candidate.data.categories) &&
      Array.isArray(candidate.data.skills) &&
      Boolean(candidate.data.config)
    );
  }
  if (candidate.kind === "cart") {
    return (
      Array.isArray(candidate.data.products) && Boolean(candidate.data.config)
    );
  }
  return candidate.kind === "utility" && Boolean(candidate.data.config);
}
