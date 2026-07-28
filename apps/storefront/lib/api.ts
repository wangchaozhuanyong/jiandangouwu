import type {
  ApiError,
  ApiSuccess,
  CategorySummary,
  Locale,
  PageMeta,
  ProductDetail,
  ProductSummary,
} from "@cloudbridge/contracts";

export type HeroStory = {
  key: string;
  imageUrl: string;
  targetSlug: string | null;
  tone: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
};

export type StorefrontCurrency = {
  code: string;
  token: string;
  name: string;
  digits: number;
};

export type StorefrontChannel = {
  type: "WHATSAPP" | "EMAIL" | "TELEGRAM" | "WECHAT" | "QQ";
  mode: string;
  label: string;
  account: string;
  directTarget: string | null;
  serviceHours: string;
};

export type StorefrontConfig = {
  heroes: HeroStory[];
  currencies: StorefrontCurrency[];
  channels: StorefrontChannel[];
};

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/v1";

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
  const payload = await response.json() as ApiSuccess<T> | ApiError;
  if (!response.ok || "error" in payload) {
    const error = "error" in payload ? payload.error : { code: "REQUEST_FAILED", message: "Request failed." };
    throw new ApiRequestError(error.message, response.status, error.code);
  }
  return payload.data;
}

export const getConfig = (locale: Locale, signal?: AbortSignal) =>
  request<StorefrontConfig>(`/storefront/config?locale=${locale}`, { signal });

export const getCategories = (locale: Locale, signal?: AbortSignal) =>
  request<CategorySummary[]>(`/categories?locale=${locale}`, { signal });

export async function getProducts(input: {
  locale: Locale;
  currency: string;
  category?: string;
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
  if (input.search) query.set("search", input.search);
  const response = await fetch(`${baseUrl}/products?${query}`, { cache: "no-store", signal: input.signal });
  const payload = await response.json() as ApiSuccess<ProductSummary[]> | ApiError;
  if (!response.ok || "error" in payload) {
    const error = "error" in payload ? payload.error : { code: "REQUEST_FAILED", message: "Request failed." };
    throw new ApiRequestError(error.message, response.status, error.code);
  }
  return {
    data: payload.data,
    meta: payload.meta ?? { page: 1, pageSize: 48, total: payload.data.length, pageCount: 1 },
  };
}

export const getProduct = (slug: string, locale: Locale, currency: string, signal?: AbortSignal) =>
  request<ProductDetail>(`/products/${encodeURIComponent(slug)}?locale=${locale}&currency=${currency}`, { signal });

export const createOrder = <T>(body: unknown, idempotencyKey: string) =>
  request<T>("/orders", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify(body),
  });

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
