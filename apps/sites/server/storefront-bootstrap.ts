import type { Locale } from "@cloudbridge/contracts";
import type { StorefrontBootstrap } from "../lib/storefront-bootstrap";
import {
  storefrontCategories,
  storefrontConfig,
  storefrontListingInput,
  storefrontProduct,
  storefrontProducts,
} from "./public-api";
import type { D1Database } from "./types";

export async function buildStorefrontBootstrap(
  db: D1Database,
  url: URL,
): Promise<StorefrontBootstrap | null> {
  const homeMatch = url.pathname.match(/^\/(zh|en)\/?$/u);
  if (homeMatch) {
    const locale = homeMatch[1] as Locale;
    const category = url.searchParams.get("category")?.slice(0, 80) ?? "";
    const search = url.searchParams.get("q")?.slice(0, 120) ?? "";
    const listingUrl = new URL("/v1/products", url);
    listingUrl.searchParams.set("locale", locale);
    listingUrl.searchParams.set("currency", "CNY");
    if (category) listingUrl.searchParams.set("category", category);
    if (search) listingUrl.searchParams.set("search", search);
    const input = storefrontListingInput(listingUrl);
    const config = await storefrontConfig(db, locale);
    const [categories, products] = await Promise.all([
      storefrontCategories(db, locale),
      storefrontProducts(db, input),
    ]);
    return {
      kind: "home",
      locale,
      category,
      search,
      data: {
        config,
        categories,
        products: products.items,
      },
    };
  }

  const productMatch = url.pathname.match(
    /^\/(zh|en)\/products\/([^/]+)\/?$/u,
  );
  if (!productMatch) return null;
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
