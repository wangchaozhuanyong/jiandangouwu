type ApiSuccess<T> = { data: T; requestId: string; meta?: PageMeta };
type ApiFailure = { error: { code: string; message: string }; requestId: string };

export type PageMeta = { page: number; pageSize: number; total: number; pageCount: number };
export type Locale = "zh" | "en";
export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  roles: Array<{ key: string; name: Record<Locale, string> }>;
  totpEnabled: boolean;
};
export type SessionPayload = { user: AdminUser; csrfToken: string };
export type TotpEnrollment = { flowId: string; secret: string; uri: string };
export type PasswordLoginResult =
  | { requiresTotp: true; flowId: string }
  | { requiresTotp: false; csrfToken: string };
export type Overview = {
  metrics: { productCount: number; activeProducts: number; openOrders: number; categoryCount: number };
  latestOrders: AdminOrder[];
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
export type AdminOrder = {
  id: string;
  orderNumber: string;
  productNameSnapshot: string;
  currencyCode: string;
  amount: string;
  maskedContact: string;
  contactChannel: string;
  status: string;
  createdAt: string;
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
export type AuditEvent = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  result: "SUCCEEDED" | "FAILED" | "DENIED";
  reason: string | null;
  actor: { displayName: string; email: string } | null;
  createdAt: string;
};

const baseUrl = import.meta.env.VITE_ADMIN_API_BASE_URL ?? "http://localhost:3001/v1";
let csrfToken = "";

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

export const setCsrfToken = (value: string): void => {
  csrfToken = value;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<{ data: T; meta?: PageMeta }> {
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
    throw new ApiError(error.message, response.status, error.code);
  }
  return { data: payload.data, meta: payload.meta };
}

export async function getSession(): Promise<SessionPayload> {
  const { data } = await request<SessionPayload>("/admin/auth/me");
  setCsrfToken(data.csrfToken);
  return data;
}

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

export const logout = () => request<void>("/admin/auth/logout", { method: "POST" });
export const getOverview = async (signal?: AbortSignal) => (await request<Overview>("/admin/overview", { signal })).data;
export const getCategories = async (signal?: AbortSignal) => (await request<AdminCategory[]>("/admin/categories", { signal })).data;
export const createCategory = (body: unknown) => request<AdminCategory>("/admin/categories", { method: "POST", body: JSON.stringify(body) });
export const updateCategory = (id: string, body: unknown) => request<AdminCategory>(`/admin/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const getProducts = async (search = "", signal?: AbortSignal) => (await request<AdminProduct[]>(`/admin/products?page=1&pageSize=100&search=${encodeURIComponent(search)}`, { signal })).data;
export const createProduct = (body: unknown) => request<AdminProduct>("/admin/products", { method: "POST", body: JSON.stringify(body) });
export const updateProduct = (id: string, body: unknown) => request<AdminProduct>(`/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const getOrders = async (signal?: AbortSignal) => (await request<AdminOrder[]>("/admin/orders?page=1&pageSize=100", { signal })).data;
export const updateOrderStatus = (id: string, status: string, reason: string) => request(`/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, reason }) });
export const revealOrderContact = async (id: string) => (await request<{ contact: string; channel: string }>(`/admin/orders/${id}/reveal-contact`, { method: "POST" })).data;
export const getCurrencies = async (signal?: AbortSignal) => (await request<AdminCurrency[]>("/admin/currencies", { signal })).data;
export const updateRate = (code: string, rate: string, reason: string) => request(`/admin/currencies/${code}/rate`, { method: "PATCH", body: JSON.stringify({ rate, reason }) });
export const getAudit = async (signal?: AbortSignal) => (await request<AuditEvent[]>("/admin/audit?page=1&pageSize=100", { signal })).data;
export const beginTotpEnrollment = async () => (await request<{ flowId: string; secret: string; uri: string }>("/admin/auth/totp/enrollment", { method: "POST" })).data;
export const verifyTotpEnrollment = async (flowId: string, token: string) => (await request<{ enabled: true }>("/admin/auth/totp/verify", { method: "POST", body: JSON.stringify({ flowId, token }) })).data;
export const disableTotp = async (password: string) => (await request<{ enabled: false }>("/admin/auth/totp/disable", { method: "POST", body: JSON.stringify({ password }) })).data;
