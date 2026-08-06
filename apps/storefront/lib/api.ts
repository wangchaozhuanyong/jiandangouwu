import type {
  ApiError,
  ApiSuccess,
  BannerPlacement,
  CategorySummary,
  Locale,
  OrderLookupInput,
  OrderLookupResult,
  PageMeta,
  PlatformKey,
  ProductDetail,
  ProductSurface,
  ProductSummary,
  SkillCategorySummary,
  SkillDetail,
  SkillSummary,
  StorefrontConfig,
  StorefrontBanner,
  TransitPlanType,
} from "@cloudbridge/contracts";
export type {
  StorefrontChannel,
  StorefrontConfig,
  StorefrontCurrency,
} from "@cloudbridge/contracts";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/v1";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as ApiSuccess<T> | ApiError;
  if (!response.ok || "error" in payload) {
    const error =
      "error" in payload
        ? payload.error
        : { code: "REQUEST_FAILED", message: "Request failed." };
    throw new ApiRequestError(error.message, response.status, error.code);
  }
  return payload.data;
}

export const getConfig = (locale: Locale, signal?: AbortSignal) =>
  request<StorefrontConfig>(`/storefront/config?locale=${locale}`, { signal });

export const getCategories = (locale: Locale, signal?: AbortSignal) =>
  request<CategorySummary[]>(`/categories?locale=${locale}`, { signal });

export const getCategoryTree = (
  locale: Locale,
  surface?: ProductSurface,
  signal?: AbortSignal,
) => {
  const query = new URLSearchParams({ locale, hierarchy: "tree" });
  if (surface) query.set("surface", surface);
  return request<CategorySummary[]>(`/categories?${query}`, { signal });
};

export const getBanners = (
  locale: Locale,
  placement: BannerPlacement,
  signal?: AbortSignal,
) =>
  request<StorefrontBanner[]>(
    `/banners?locale=${locale}&placement=${placement}`,
    { signal },
  );

export async function getProducts(input: {
  locale: Locale;
  currency: string;
  category?: string;
  surface?: ProductSurface;
  platform?: PlatformKey;
  transitPlanType?: TransitPlanType;
  search?: string;
  signal?: AbortSignal;
}): Promise<{ data: ProductSummary[]; meta: PageMeta }> {
  const query = new URLSearchParams({
    locale: input.locale,
    currency: input.currency,
    page: "1",
    pageSize: "48",
  });
  if (input.category) query.set("category", input.category);
  if (input.surface) query.set("surface", input.surface);
  if (input.platform) query.set("platform", input.platform);
  if (input.transitPlanType)
    query.set("transitPlanType", input.transitPlanType);
  if (input.search) query.set("search", input.search);
  const response = await fetch(`${baseUrl}/products?${query}`, {
    cache: "no-store",
    signal: input.signal,
  });
  const payload = (await response.json()) as
    ApiSuccess<ProductSummary[]> | ApiError;
  if (!response.ok || "error" in payload) {
    const error =
      "error" in payload
        ? payload.error
        : { code: "REQUEST_FAILED", message: "Request failed." };
    throw new ApiRequestError(error.message, response.status, error.code);
  }
  return {
    data: payload.data,
    meta: payload.meta ?? {
      page: 1,
      pageSize: 48,
      total: payload.data.length,
      pageCount: 1,
    },
  };
}

export const getProduct = (
  slug: string,
  locale: Locale,
  currency: string,
  signal?: AbortSignal,
) =>
  request<ProductDetail>(
    `/products/${encodeURIComponent(slug)}?locale=${locale}&currency=${currency}`,
    { signal },
  );

export const createOrder = <T>(body: unknown, idempotencyKey: string) =>
  request<T>("/orders", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify(body),
  });

export const lookupOrder = (body: OrderLookupInput) =>
  request<OrderLookupResult>("/orders/lookup", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const getSkillCategories = (locale: Locale, signal?: AbortSignal) =>
  request<SkillCategorySummary[]>(`/skills/categories?locale=${locale}`, {
    signal,
  });

export async function getSkills(input: {
  locale: Locale;
  category?: string;
  search?: string;
  signal?: AbortSignal;
}): Promise<{ data: SkillSummary[]; meta: PageMeta }> {
  const query = new URLSearchParams({
    locale: input.locale,
    page: "1",
    pageSize: "48",
  });
  if (input.category) query.set("category", input.category);
  if (input.search) query.set("search", input.search);
  const response = await fetch(`${baseUrl}/skills?${query}`, {
    cache: "no-store",
    signal: input.signal,
  });
  const payload = (await response.json()) as
    ApiSuccess<SkillSummary[]> | ApiError;
  if (!response.ok || "error" in payload) {
    const error =
      "error" in payload
        ? payload.error
        : { code: "REQUEST_FAILED", message: "Request failed." };
    throw new ApiRequestError(error.message, response.status, error.code);
  }
  return {
    data: payload.data,
    meta: payload.meta ?? {
      page: 1,
      pageSize: 48,
      total: payload.data.length,
      pageCount: 1,
    },
  };
}

export const getSkill = (slug: string, locale: Locale, signal?: AbortSignal) =>
  request<SkillDetail>(`/skills/${encodeURIComponent(slug)}?locale=${locale}`, {
    signal,
  });

export async function getV2CatalogData(input: {
  locale: Locale;
  currency: string;
  surface: ProductSurface;
}) {
  const [config, categories, banners, products] = await Promise.all([
    getConfig(input.locale),
    getCategoryTree(input.locale, input.surface),
    getBanners(input.locale, input.surface),
    getProducts(input),
  ]);
  return { config, categories, banners, products: products.data };
}

export async function getStorefrontHomeData(input: {
  locale: Locale;
  currency: string;
  category?: string;
  search?: string;
}) {
  const [config, categories, products] = await Promise.all([
    getConfig(input.locale),
    getCategories(input.locale),
    getProducts(input),
  ]);
  return { config, categories, products: products.data };
}
