import type {
  AdminOrderListItem,
  AdminRoleDetail,
  AdminRolesOverview,
  AdminTeamMember,
  AdminTeamOverview,
  SystemHealthStatus,
} from "@cloudbridge/contracts";

export type {
  AdminAccessRoleSummary,
  AdminPermissionSummary,
  AdminRoleDetail,
  AdminRolesOverview,
  AdminTeamMember,
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
  totpEnabled: boolean;
  authProvider?: "PASSWORD" | "SITES";
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
  };
  checkedAt: string;
};
export type TotpEnrollment = { flowId: string; secret: string; uri: string };
export type PasswordLoginResult =
  | { requiresTotp: true; flowId: string }
  | { requiresTotp: false; csrfToken: string };
export type Overview = {
  metrics: { productCount: number; activeProducts: number; openOrders: number; categoryCount: number };
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
export type AuditEventPage = {
  data: AuditEvent[];
  meta: PageMeta;
};

const baseUrl = import.meta.env.VITE_ADMIN_API_BASE_URL ?? "http://localhost:3001/v1";
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
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
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
    || health.database !== "connected"
    || (
      health.runtime === "sites"
        ? health.valkey !== "not_required"
        : health.valkey !== "connected"
    )
    || !isNonNegativeSafeInteger(health.latencyMs?.database)
    || !isNonNegativeSafeInteger(health.latencyMs?.valkey)
    || !Number.isFinite(Date.parse(health.timestamp))
  ) {
    throw new Error("Health response failed the runtime contract.");
  }
  return health;
};
export const getSitesReadiness = async (signal?: AbortSignal): Promise<SitesReadiness> =>
  (await request<SitesReadiness>("/admin/sites-readiness", { signal })).data;

export async function getFirstAdminSetupStatus(): Promise<{ available: boolean }> {
  return (await request<{ available: boolean }>("/admin/auth/setup/status")).data;
}

export async function setupFirstAdmin(input: {
  email: string;
  displayName: string;
  password: string;
}): Promise<void> {
  const { data } = await request<{ csrfToken: string }>("/admin/auth/setup", {
    method: "POST",
    body: JSON.stringify(input),
  });
  setCsrfToken(data.csrfToken);
}

export async function loginWithPassword(email: string, password: string): Promise<PasswordLoginResult> {
  const { data } = await request<PasswordLoginResult>("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!data.requiresTotp) setCsrfToken(data.csrfToken);
  return data;
}

export async function completeTotpLogin(flowId: string, token: string): Promise<void> {
  const { data } = await request<{ csrfToken: string }>("/admin/auth/login/totp", {
    method: "POST",
    body: JSON.stringify({ flowId, token }),
  });
  setCsrfToken(data.csrfToken);
}

export const logout = () => {
  if (baseUrl.startsWith("/") && typeof window !== "undefined") {
    window.location.assign("/signout-with-chatgpt?return_to=%2Fadmin");
    return Promise.resolve({ data: undefined });
  }
  return request<void>("/admin/auth/logout", { method: "POST" });
};
export const getOverview = async (signal?: AbortSignal) => (await request<Overview>("/admin/overview", { signal })).data;
export const getCategories = async (signal?: AbortSignal) => (await request<AdminCategory[]>("/admin/categories", { signal })).data;
export const getCurrencyRateHistory = async (code: string, signal?: AbortSignal) =>
  (await request<AdminCurrencyRate[]>(`/admin/currencies/${encodeURIComponent(code)}/rates`, { signal })).data;
export const createCategory = (body: unknown) => request<AdminCategory>("/admin/categories", { method: "POST", body: JSON.stringify(body) });
export const updateCategory = (id: string, body: unknown) => request<AdminCategory>(`/admin/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const getProducts = async (search = "", signal?: AbortSignal) => (await request<AdminProduct[]>(`/admin/products?page=1&pageSize=100&search=${encodeURIComponent(search)}`, { signal })).data;
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
export const getAuditPage = async (signal?: AbortSignal): Promise<AuditEventPage> => {
  const response = await request<AuditEvent[]>("/admin/audit?page=1&pageSize=100", { signal });
  const { meta } = response;
  if (
    !meta
    || !Number.isSafeInteger(meta.page)
    || meta.page < 1
    || !Number.isSafeInteger(meta.pageSize)
    || meta.pageSize < 1
    || !isNonNegativeSafeInteger(meta.total)
    || !isNonNegativeSafeInteger(meta.pageCount)
  ) {
    throw new Error("Audit pagination metadata failed the runtime contract.");
  }
  return { data: response.data, meta };
};
export const getAudit = async (signal?: AbortSignal) => (await getAuditPage(signal)).data;
export const getTeamOverview = async (signal?: AbortSignal) => (
  await request<AdminTeamOverview>("/admin/access/members", { signal })
).data;
export const updateMemberRoles = async (
  memberId: string,
  input: { roleIds: string[]; expectedUpdatedAt: string; reason: string },
) => (
  await request<AdminTeamMember>(`/admin/access/members/${memberId}/roles`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
).data;
export const getRolesOverview = async (signal?: AbortSignal) => (
  await request<AdminRolesOverview>("/admin/access/roles", { signal })
).data;
export const updateRolePermissions = async (
  roleId: string,
  input: { permissionKeys: string[]; expectedUpdatedAt: string; reason: string },
) => (
  await request<AdminRoleDetail>(`/admin/access/roles/${roleId}/permissions`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
).data;
export const beginTotpEnrollment = async () => (await request<{ flowId: string; secret: string; uri: string }>("/admin/auth/totp/enrollment", { method: "POST" })).data;
export const verifyTotpEnrollment = async (flowId: string, token: string) => (await request<{ enabled: true }>("/admin/auth/totp/verify", { method: "POST", body: JSON.stringify({ flowId, token }) })).data;
export const disableTotp = async (password: string) => (await request<{ enabled: false }>("/admin/auth/totp/disable", { method: "POST", body: JSON.stringify({ password }) })).data;
