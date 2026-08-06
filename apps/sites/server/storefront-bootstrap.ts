import type {
  BannerPlacement,
  Locale,
  ProductSurface,
} from "@cloudbridge/contracts";
import type { StorefrontBootstrap } from "../lib/storefront-bootstrap";
import {
  storefrontBanners,
  storefrontCategoryTree,
  storefrontConfig,
  storefrontListingInput,
  storefrontProduct,
  storefrontProducts,
  storefrontSkill,
  storefrontSkillCategories,
  storefrontSkillListingInput,
  storefrontSkills,
} from "./public-api";
import type { D1Database } from "./types";

export async function buildStorefrontBootstrap(
  db: D1Database,
  url: URL,
): Promise<StorefrontBootstrap | null> {
  const catalogMatch = url.pathname.match(
    /^\/(zh|en)(?:\/(transit-subscriptions|ai-recharge))?\/?$/u,
  );
  if (catalogMatch) {
    const locale = catalogMatch[1] as Locale;
    const route = catalogMatch[2] ?? "home";
    const surface: ProductSurface =
      route === "transit-subscriptions"
        ? "TRANSIT_SUBSCRIPTIONS"
        : route === "ai-recharge"
          ? "AI_RECHARGE"
          : "HOME";
    const placement = surface as BannerPlacement;
    const primary = url.searchParams.get("primary")?.slice(0, 80) ?? "";
    const secondary = url.searchParams.get("secondary")?.slice(0, 80) ?? "";
    const search = url.searchParams.get("q")?.slice(0, 120) ?? "";
    const listingUrl = new URL("/v1/products", url);
    listingUrl.searchParams.set("locale", locale);
    listingUrl.searchParams.set("currency", "CNY");
    listingUrl.searchParams.set("surface", surface);
    if (secondary || primary) {
      listingUrl.searchParams.set("category", secondary || primary);
    }
    if (search) listingUrl.searchParams.set("search", search);
    const input = storefrontListingInput(listingUrl);
    const config = await storefrontConfig(db, locale);
    const categories = await storefrontCategoryTree(db, locale, surface);
    const products = await storefrontProducts(db, input);
    const banners = await storefrontBanners(db, locale, placement);
    return {
      kind: "catalog",
      locale,
      surface,
      placement,
      primary,
      secondary,
      search,
      data: {
        config,
        categories,
        products: products.items,
        banners,
      },
    };
  }

  const skillsMatch = url.pathname.match(/^\/(zh|en)\/skills\/?$/u);
  if (skillsMatch) {
    const locale = skillsMatch[1] as Locale;
    const category = url.searchParams.get("filter")?.slice(0, 80) ?? "";
    const search = url.searchParams.get("q")?.slice(0, 120) ?? "";
    const listingUrl = new URL("/v1/skills", url);
    listingUrl.searchParams.set("locale", locale);
    if (category) listingUrl.searchParams.set("category", category);
    if (search) listingUrl.searchParams.set("search", search);
    const config = await storefrontConfig(db, locale);
    const categories = await storefrontSkillCategories(db, locale);
    const skills = await storefrontSkills(
      db,
      storefrontSkillListingInput(listingUrl),
    );
    return {
      kind: "skills",
      locale,
      category,
      search,
      data: { config, categories, skills: skills.items },
    };
  }

  const skillMatch = url.pathname.match(/^\/(zh|en)\/skills\/([^/]+)\/?$/u);
  if (skillMatch) {
    const locale = skillMatch[1] as Locale;
    const slug = decodeURIComponent(skillMatch[2]);
    const config = await storefrontConfig(db, locale);
    const skill = await storefrontSkill(db, slug, locale);
    return { kind: "skill", locale, slug, data: { config, skill } };
  }

  const cartMatch = url.pathname.match(/^\/(zh|en)\/cart\/?$/u);
  if (cartMatch) {
    const locale = cartMatch[1] as Locale;
    const listingUrl = new URL("/v1/products", url);
    listingUrl.searchParams.set("locale", locale);
    listingUrl.searchParams.set("currency", "CNY");
    listingUrl.searchParams.set("surface", "HOME");
    const config = await storefrontConfig(db, locale);
    const products = await storefrontProducts(
      db,
      storefrontListingInput(listingUrl),
    );
    return {
      kind: "cart",
      locale,
      data: { config, products: products.items },
    };
  }

  const productMatch = url.pathname.match(/^\/(zh|en)\/products\/([^/]+)\/?$/u);
  if (productMatch) {
    const locale = productMatch[1] as Locale;
    const slug = decodeURIComponent(productMatch[2]);
    const config = await storefrontConfig(db, locale);
    const product = await storefrontProduct(db, slug, locale, "CNY");
    return {
      kind: "product",
      locale,
      slug,
      data: { config, product },
    };
  }

  const utilityMatch = url.pathname.match(
    /^\/(zh|en)\/(?:orders\/lookup|policies\/(?:terms|privacy))\/?$/u,
  );
  if (utilityMatch) {
    const locale = utilityMatch[1] as Locale;
    return {
      kind: "utility",
      locale,
      data: { config: await storefrontConfig(db, locale) },
    };
  }
  return null;
}
