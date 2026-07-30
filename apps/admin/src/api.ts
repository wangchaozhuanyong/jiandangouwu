import type {
  AdminManagedMediaObject,
  AdminMediaReplacement,
  AdminInventoryRiskSummary,
  AdminOrderListItem,
  AdminRolesOverview,
  AdminTeamOverview,
  SecurityAuditSummary,
  SecurityEventCategory,
  SecurityEventSeverity,
  SystemHealthStatus,
} from "@cloudbridge/contracts";
import {
  AUDIT_CSV_EXPORT_CONFIRMATION,
  auditCsvFilename,
} from "@cloudbridge/contracts";

export type {
  AdminAccessRoleSummary,
  AdminPermissionSummary,
  AdminRolesOverview,
  AdminTeamOverview,
} from "@cloudbridge/contracts";

type ApiSuccess<T> = { data: T; requestId: string; meta?: PageMeta };
type ApiFailure = {
  error: {
    code: string;
    message: string;
    details?: ReadonlyArray<{ field?: string; code: string; message: string }>;
  };
  requestId: string;
};

export type PageMeta = { page: number; pageSize: number; total: number; pageCount: number };
export type Locale = "zh" | "en";
export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  roles: Array<{ key: string; name: Record<Locale, string> }>;
  permissions: string[];
  authProvider?: "SITES";
};
export type SessionPayload = { user: AdminUser; csrfToken: string };
export type HealthStatus = SystemHealthStatus;
export type SitesReadiness = {
  runtime: "sites";
  database: "connected";
  objectStorage: "bound" | "missing";
  chatgptAuthentication: "connected" | "missing";
  dataEncryptionKey: "configured" | "not_configured";
  administrator: { email: string; displayName: string };
  storefront: {
    acceptOrders: boolean;
    supportEnabled: boolean;
    activeContactChannels: number;
    configuredActiveContactChannels: number;
  };
  checkedAt: string;
};
export type Overview = {
  metrics: { productCount: number; activeProducts: number; openOrders: number; categoryCount: number };
  inventoryRisk: AdminInventoryRiskSummary;
  latestOrders: AdminOrderListItem[];
};
export type AdminCategory = {
  id: string;
  slug: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
  sortOrder: number;
  version: number;
  name: Record<Locale, string>;
  productCount: number;
  updatedAt: string;
};
export type AdminProduct = {
  id: string;
  slug: string;
  imageKey: string;
  basePrice: string;
  compareAtPrice: string | null;
  stockMode: "FINITE" | "UNLIMITED";
  stockQuantity: number | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
  sortOrder: number;
  version: number;
  category: { id: string; slug: string; name: Record<Locale, string> };
  translations: Record<Locale, { name: string; kicker: string; description: string }>;
  updatedAt: string;
};
export type AdminProductQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: AdminProduct["status"];
};
export type AdminProductPage = {
  data: AdminProduct[];
  meta: PageMeta;
};
export type AdminCurrency = {
  code: string;
  token: string;
  name: Record<Locale, string>;
  digits: number;
  active: boolean;
  rate: string | null;
  effectiveAt: string | null;
};
export type AdminCurrencyRate = {
  id: string;
  fromCode: string;
  toCode: string;
  rate: string;
  source: string;
  effectiveAt: string;
  expiresAt: string | null;
  createdAt: string;
};
export type AuditEvent = {
  id: string;
  requestId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  result: "SUCCEEDED" | "FAILED" | "DENIED";
  reason: string | null;
  actor: { displayName: string; email: string } | null;
  createdAt: string;
};
export type AuditEventQuery = {
  page: number;
  pageSize: number;
  search?: string;
  result?: AuditEvent["result"];
  actor?: "administrator" | "system";
  targetType?: string;
  timeRange?: "24h" | "7d" | "30d" | "all";
  scope?: "security";
  category?: SecurityEventCategory;
  severity?: SecurityEventSeverity;
};
export type AuditEventPage = {
  data: AuditEvent[];
  meta: PageMeta;
  facets: {
    targetTypes: string[];
    securitySummary?: SecurityAuditSummary;
  };
};
export type AuditEventExportInput = Omit<
  AuditEventQuery,
  "page" | "pageSize" | "scope" | "category" | "severity"
> & {
  reason: string;
  confirmation: typeof AUDIT_CSV_EXPORT_CONFIRMATION;
};
export type AuditEventExport = {
  blob: Blob;
  filename: string;
  recordCount: number | null;
};

const baseUrl = import.meta.env?.VITE_ADMIN_API_BASE_URL ?? "/v1";
let csrfToken = "";
let unauthorizedHandler: (() => void) | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId = "",
    readonly details: ApiFailure["error"]["details"] = [],
  ) {
    super(message);
  }
}

export const setCsrfToken = (value: string): void => {
  csrfToken = value;
};

export const setUnauthorizedHandler = (handler: (() => void) | null): void => {
  unauthorizedHandler = handler;
};

export async function request<T>(path: string, init: RequestInit = {}): Promise<{ data: T; meta?: PageMeta }> {
  const method = init.method ?? "GET";
  const usesFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(!usesFormData ? { "content-type": "application/json" } : {}),
      ...(!["GET", "HEAD"].includes(method) && csrfToken ? { "x-csrf-token": csrfToken } : {}),
      ...init.headers,
    },
  });
  if (response.status === 204) return { data: undefined as T };
  const payload = await response.json() as ApiSuccess<T> | ApiFailure;
  if (!response.ok || "error" in payload) {
    const error = "error" in payload ? payload.error : { code: "REQUEST_FAILED", message: "Request failed." };
    if (response.status === 401) {
      setCsrfToken("");
      unauthorizedHandler?.();
    }
    throw new ApiError(error.message, response.status, error.code, payload.requestId, error.details);
  }
  return { data: payload.data, meta: payload.meta };
}

export async function getSession(): Promise<SessionPayload> {
  const { data } = await request<SessionPayload>("/admin/auth/me");
  setCsrfToken(data.csrfToken);
  return data;
}

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;

export const getHealth = async (signal?: AbortSignal): Promise<HealthStatus> => {
  const health = (await request<HealthStatus>("/health", { signal })).data;
  if (
    health.status !== "healthy"
    || health.runtime !== "sites"
    || health.database !== "connected"
    || !["bound", "missing"].includes(health.objectStorage)
    || !isNonNegativeSafeInteger(health.latencyMs?.database)
    || !Number.isFinite(Date.parse(health.timestamp))
  ) {
    throw new Error("Health response failed the runtime contract.");
  }
  return health;
};
export const getSitesReadiness = async (signal?: AbortSignal): Promise<SitesReadiness> =>
  (await request<SitesReadiness>("/admin/sites-readiness", { signal })).data;

export const logout = () => {
  if (typeof window !== "undefined") {
    window.location.assign("/signout-with-chatgpt?return_to=%2Fadmin");
    return Promise.resolve({ data: undefined });
  }
  return Promise.resolve({ data: undefined });
};
export const getOverview = async (signal?: AbortSignal) => (await request<Overview>("/admin/overview", { signal })).data;
export const getCategories = async (signal?: AbortSignal) => (await request<AdminCategory[]>("/admin/categories", { signal })).data;
export const getCurrencyRateHistory = async (code: string, signal?: AbortSignal) =>
  (await request<AdminCurrencyRate[]>(`/admin/currencies/${encodeURIComponent(code)}/rates`, { signal })).data;
export const createCategory = (body: unknown) => request<AdminCategory>("/admin/categories", { method: "POST", body: JSON.stringify(body) });
export const updateCategory = (id: string, body: unknown) => request<AdminCategory>(`/admin/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const getProducts = async (
  query: AdminProductQuery = { page: 1, pageSize: 30 },
  signal?: AbortSignal,
): Promise<AdminProductPage> => {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.status) params.set("status", query.status);
  const response = await request<AdminProduct[]>(
    `/admin/products?${params.toString()}`,
    { signal },
  );
  const { meta } = response;
  if (
    !meta
    || !Number.isSafeInteger(meta.page)
    || meta.page < 1
    || meta.page !== query.page
    || !Number.isSafeInteger(meta.pageSize)
    || meta.pageSize < 1
    || meta.pageSize !== query.pageSize
    || !isNonNegativeSafeInteger(meta.total)
    || !isNonNegativeSafeInteger(meta.pageCount)
    || !Array.isArray(response.data)
    || response.data.length > meta.pageSize
    || meta.pageCount !== (meta.total === 0 ? 0 : Math.ceil(meta.total / meta.pageSize))
  ) {
    throw new Error("Product pagination metadata failed the runtime contract.");
  }
  return { data: response.data, meta };
};
export const getAllProducts = async (signal?: AbortSignal): Promise<AdminProduct[]> => {
  const products: AdminProduct[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const response = await request<AdminProduct[]>(
      `/admin/products?page=${page}&pageSize=100`,
      { signal },
    );
    products.push(...response.data);
    pageCount = response.meta?.pageCount ?? 1;
    if (!Number.isSafeInteger(pageCount) || pageCount < 0 || pageCount > 10_000) {
      throw new Error("Invalid product pagination metadata.");
    }
    page += 1;
  } while (page <= pageCount);
  return products;
};
export const createProduct = (body: unknown) => request<AdminProduct>("/admin/products", { method: "POST", body: JSON.stringify(body) });
export const updateProduct = (id: string, body: unknown) => request<AdminProduct>(`/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const getCurrencies = async (signal?: AbortSignal) => (await request<AdminCurrency[]>("/admin/currencies", { signal })).data;
export const updateRate = (code: string, rate: string, reason: string) => request(`/admin/currencies/${code}/rate`, { method: "PATCH", body: JSON.stringify({ rate, reason }) });
export const getAuditPage = async (
  query: AuditEventQuery = { page: 1, pageSize: 100 },
  signal?: AbortSignal,
): Promise<AuditEventPage> => {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.result) params.set("result", query.result);
  if (query.actor) params.set("actor", query.actor);
  if (query.targetType?.trim()) params.set("targetType", query.targetType.trim());
  if (query.timeRange) params.set("timeRange", query.timeRange);
  if (query.scope) params.set("scope", query.scope);
  if (query.category) params.set("category", query.category);
  if (query.severity) params.set("severity", query.severity);
  const response = await request<{
    items: AuditEvent[];
    facets: {
      targetTypes: string[];
      securitySummary?: SecurityAuditSummary;
    };
  }>(`/admin/audit?${params.toString()}`, { signal });
  const { meta } = response;
  const securitySummary = response.data?.facets?.securitySummary;
  const validSecuritySummary = securitySummary !== undefined
    && isNonNegativeSafeInteger(securitySummary.total)
    && isNonNegativeSafeInteger(securitySummary.last24Hours)
    && isNonNegativeSafeInteger(securitySummary.needsReview)
    && isNonNegativeSafeInteger(securitySummary.deniedOrFailed);
  if (
    !meta
    || !Number.isSafeInteger(meta.page)
    || meta.page < 1
    || !Number.isSafeInteger(meta.pageSize)
    || meta.pageSize < 1
    || !isNonNegativeSafeInteger(meta.total)
    || !isNonNegativeSafeInteger(meta.pageCount)
    || !Array.isArray(response.data?.items)
    || !Array.isArray(response.data?.facets?.targetTypes)
    || response.data.facets.targetTypes.some((value) => (
      typeof value !== "string" || value.length === 0 || value.length > 80
    ))
    || (query.scope === "security" && !validSecuritySummary)
    || (query.scope !== "security" && securitySummary !== undefined && !validSecuritySummary)
  ) {
    throw new Error("Audit pagination metadata failed the runtime contract.");
  }
  return {
    data: response.data.items,
    meta,
    facets: {
      targetTypes: [...new Set(response.data.facets.targetTypes)].sort(),
      ...(securitySummary ? { securitySummary } : {}),
    },
  };
};
export const getAudit = async (signal?: AbortSignal) => (
  await getAuditPage({ page: 1, pageSize: 100 }, signal)
).data;
export const exportAuditCsv = async (
  input: Omit<AuditEventExportInput, "confirmation">,
): Promise<AuditEventExport> => {
  const response = await fetch(`${baseUrl}/admin/audit/export`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
    },
    body: JSON.stringify({
      ...input,
      confirmation: AUDIT_CSV_EXPORT_CONFIRMATION,
    }),
  });
  if (!response.ok) {
    let payload: ApiFailure | null = null;
    try {
      payload = await response.json() as ApiFailure;
    } catch {
      payload = null;
    }
    if (response.status === 401) {
      setCsrfToken("");
      unauthorizedHandler?.();
    }
    const error = payload?.error ?? {
      code: "AUDIT_EXPORT_FAILED",
      message: "The audit export could not be completed.",
    };
    throw new ApiError(
      error.message,
      response.status,
      error.code,
      payload?.requestId,
      error.details,
    );
  }
  if (!response.headers.get("content-type")?.toLocaleLowerCase().includes("text/csv")) {
    throw new ApiError(
      "The server returned an invalid audit export.",
      502,
      "INVALID_AUDIT_EXPORT_RESPONSE",
    );
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const serverFilename = disposition.match(/filename="([A-Za-z0-9._-]+)"/u)?.[1];
  const countHeader = response.headers.get("x-export-record-count");
  const count = countHeader === null ? null : Number(countHeader);
  return {
    blob: await response.blob(),
    filename: serverFilename?.startsWith("cloudbridge-audit-")
      && serverFilename.endsWith(".csv")
      ? serverFilename
      : auditCsvFilename(),
    recordCount: Number.isSafeInteger(count) && Number(count) >= 0 ? count : null,
  };
};
export const getTeamOverview = async (signal?: AbortSignal) => (
  await request<AdminTeamOverview>("/admin/access/members", { signal })
).data;
export const getRolesOverview = async (signal?: AbortSignal) => (
  await request<AdminRolesOverview>("/admin/access/roles", { signal })
).data;

export const getManagedMedia = async (
  signal?: AbortSignal,
): Promise<AdminManagedMediaObject[]> => (
  await request<AdminManagedMediaObject[]>("/admin/media", { signal })
).data;

export const uploadManagedMedia = async (
  file: File,
  reason: string,
): Promise<AdminManagedMediaObject> => {
  const form = new FormData();
  form.set("file", file);
  form.set("reason", reason);
  return (await request<AdminManagedMediaObject>("/admin/media", {
    method: "POST",
    body: form,
  })).data;
};

export const replaceManagedMedia = async (
  sourcePath: string,
  file: File,
  reason: string,
): Promise<AdminMediaReplacement> => {
  const form = new FormData();
  form.set("sourcePath", sourcePath);
  form.set("file", file);
  form.set("reason", reason);
  return (await request<AdminMediaReplacement>("/admin/media/replace", {
    method: "POST",
    body: form,
  })).data;
};

export const deleteManagedMedia = async (
  key: string,
  reason: string,
): Promise<void> => {
  await request<void>(`/admin/media/${encodeURIComponent(key)}`, {
    method: "DELETE",
    body: JSON.stringify({ reason }),
  });
};
