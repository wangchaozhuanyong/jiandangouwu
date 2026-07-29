import type { D1Database } from "./types";

export const adminPermissions = [
  "catalog.read",
  "catalog.write",
  "orders.read",
  "orders.write",
  "contacts.reveal",
  "currencies.write",
  "team.manage",
  "roles.manage",
  "audit.read",
  "content.read",
  "content.write",
  "support.read",
  "support.write",
  "settings.read",
  "settings.write",
] as const;

export type HeaderUser = {
  email: string;
  displayName: string;
};

export type AdminIdentity = HeaderUser & {
  id: string;
  permissions: string[];
};

export function success<T>(
  data: T,
  options?: {
    status?: number;
    meta?: { page: number; pageSize: number; total: number; pageCount: number };
    requestId?: string;
  },
): Response {
  const requestId = options?.requestId ?? crypto.randomUUID();
  return Response.json(
    {
      data,
      ...(options?.meta ? { meta: options.meta } : {}),
      requestId,
    },
    {
      status: options?.status ?? 200,
      headers: responseHeaders(requestId),
    },
  );
}

export function failure(
  status: number,
  code: string,
  message: string,
  requestId = crypto.randomUUID(),
  details?: ReadonlyArray<{ field?: string; code: string; message: string }>,
): Response {
  return Response.json(
    {
      error: {
        code,
        message,
        ...(details?.length ? { details } : {}),
      },
      requestId,
    },
    {
      status,
      headers: responseHeaders(requestId),
    },
  );
}

export async function readJson<T>(request: Request): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 1_000_000) {
    throw new ApiInputError("PAYLOAD_TOO_LARGE", "Request payload is too large.", 413);
  }
  try {
    return await request.json() as T;
  } catch {
    throw new ApiInputError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }
}

export class ApiInputError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly details?: ReadonlyArray<{ field?: string; code: string; message: string }>,
  ) {
    super(message);
  }
}

export function headerUser(request: Request): HeaderUser | null {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLocaleLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email)) return null;
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  const decodedName = encodedName && encoding === "percent-encoded-utf-8"
    ? safeDecode(encodedName)
    : null;
  return {
    email,
    displayName: decodedName?.trim() || email,
  };
}

export async function bootstrapOrReadAdmin(
  db: D1Database,
  request: Request,
): Promise<AdminIdentity | null> {
  const user = headerUser(request);
  if (!user) return null;

  let member = await db.prepare(
    "SELECT id, email, display_name AS displayName, status, permissions_json AS permissionsJson FROM admin_members WHERE email = ? LIMIT 1",
  ).bind(user.email).first<{
    id: string;
    email: string;
    displayName: string;
    status: string;
    permissionsJson: string;
  }>();

  if (!member) {
    const count = await db.prepare("SELECT COUNT(*) AS count FROM admin_members")
      .first<{ count: number }>();
    if (Number(count?.count ?? 0) !== 0) return null;

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await db.prepare(
      "INSERT INTO admin_members (id, email, display_name, status, permissions_json, last_login_at, created_at, updated_at) VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?)",
    ).bind(
      id,
      user.email,
      user.displayName,
      JSON.stringify(adminPermissions),
      now,
      now,
      now,
    ).run();
    member = {
      id,
      email: user.email,
      displayName: user.displayName,
      status: "ACTIVE",
      permissionsJson: JSON.stringify(adminPermissions),
    };
    await writeAudit(db, {
      action: "auth.sites.bootstrap",
      result: "SUCCEEDED",
      actor: user,
      targetType: "ADMIN_USER",
      targetId: id,
      reason: "First owner-only Sites administrator bootstrap",
    });
  } else {
    await db.prepare(
      "UPDATE admin_members SET display_name = ?, last_login_at = ?, updated_at = ? WHERE id = ?",
    ).bind(user.displayName, new Date().toISOString(), new Date().toISOString(), member.id).run();
  }

  if (member.status !== "ACTIVE") return null;
  return {
    id: member.id,
    email: member.email,
    displayName: member.displayName,
    permissions: safeStringArray(member.permissionsJson),
  };
}

export async function requireAdmin(
  db: D1Database,
  request: Request,
  permission?: string,
): Promise<AdminIdentity> {
  const user = headerUser(request);
  if (!user) throw new ApiInputError("ADMIN_AUTH_REQUIRED", "ChatGPT sign-in is required.", 401);
  const member = await db.prepare(
    "SELECT id, email, display_name AS displayName, status, permissions_json AS permissionsJson FROM admin_members WHERE email = ? LIMIT 1",
  ).bind(user.email).first<{
    id: string;
    email: string;
    displayName: string;
    status: string;
    permissionsJson: string;
  }>();
  if (!member || member.status !== "ACTIVE") {
    throw new ApiInputError("ADMIN_ACCESS_DENIED", "This account is not an active CloudBridge administrator.", 403);
  }
  const identity = {
    id: member.id,
    email: member.email,
    displayName: member.displayName,
    permissions: safeStringArray(member.permissionsJson),
  };
  if (permission && !identity.permissions.includes(permission)) {
    throw new ApiInputError("PERMISSION_DENIED", `Permission ${permission} is required.`, 403);
  }
  return identity;
}

export function requireCsrf(request: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  if (request.headers.get("x-csrf-token") !== "sites-siwc") {
    throw new ApiInputError("CSRF_VALIDATION_FAILED", "The write request could not be verified.", 403);
  }
}

export async function writeAudit(
  db: D1Database,
  input: {
    action: string;
    result: "SUCCEEDED" | "FAILED" | "DENIED";
    actor?: HeaderUser | null;
    targetType?: string | null;
    targetId?: string | null;
    reason?: string | null;
  },
): Promise<void> {
  const id = crypto.randomUUID();
  await db.prepare(
    "INSERT INTO audit_events (id, trace_id, action, result, actor_email, actor_display_name, target_type, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    id,
    crypto.randomUUID(),
    input.action,
    input.result,
    input.actor?.email ?? null,
    input.actor?.displayName ?? null,
    input.targetType ?? null,
    input.targetId ?? null,
    input.reason ?? null,
    new Date().toISOString(),
  ).run();
}

export function parsePage(url: URL, defaults = { page: 1, pageSize: 30 }): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const parsedPage = Number(url.searchParams.get("page") ?? defaults.page);
  const parsedPageSize = Number(url.searchParams.get("pageSize") ?? defaults.pageSize);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : defaults.page;
  const pageSize = Number.isSafeInteger(parsedPageSize)
    ? Math.min(Math.max(parsedPageSize, 1), 100)
    : defaults.pageSize;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function pageMeta(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

function safeStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function responseHeaders(requestId: string): HeadersInit {
  return {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
    "x-request-id": requestId,
  };
}
