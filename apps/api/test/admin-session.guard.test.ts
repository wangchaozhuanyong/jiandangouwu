import assert from "node:assert/strict";
import test from "node:test";
import {
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  PERMISSIONS_KEY,
  PUBLIC_ADMIN_KEY,
} from "../src/auth/auth.decorators.js";
import { AdminSessionGuard } from "../src/auth/admin-session.guard.js";

const token = "a".repeat(48);
const session = {
  sessionId: "session",
  userId: "admin",
  email: "admin@cloudbridge.test",
  displayName: "Admin",
  permissions: ["roles.manage"],
  csrfToken: "csrf-token",
  reauthenticatedAt: Date.now(),
  createdAt: Date.now(),
};

const contextFor = (request: Record<string, unknown>) => ({
  switchToHttp: () => ({
    getRequest: () => request,
  }),
  getHandler: () => function handler() {},
  getClass: () => class Controller {},
});

const reflector = {
  getAllAndOverride: (key: string) =>
    key === PUBLIC_ADMIN_KEY
      ? false
      : key === PERMISSIONS_KEY
        ? ["roles.manage"]
        : undefined,
};

const config = {
  get: (key: string) => key === "SESSION_COOKIE_NAME"
    ? "cloudbridge_admin_session"
    : undefined,
};

test("the guard reloads current permissions and immediately rejects a revoked grant", async () => {
  const synchronized: string[][] = [];
  const sessions = {
    get: async () => session,
    synchronizePermissions: async (_token: string, permissions: string[]) => {
      synchronized.push(permissions);
    },
    destroy: async () => undefined,
  };
  const prisma = {
    adminUser: {
      findUnique: async () => ({
        status: "ACTIVE",
        roles: [{
          role: {
            permissions: [{
              permission: { key: "orders.read" },
            }],
          },
        }],
      }),
    },
  };
  const guard = new AdminSessionGuard(
    reflector as never,
    sessions as never,
    config as never,
    prisma as never,
  );
  const request = {
    path: "/v1/admin/access/roles",
    method: "GET",
    cookies: { cloudbridge_admin_session: token },
    header: () => undefined,
  };

  await assert.rejects(
    guard.canActivate(contextFor(request) as never),
    ForbiddenException,
  );
  assert.deepEqual(synchronized, [["orders.read"]]);
});

test("the guard destroys sessions for disabled administrator accounts", async () => {
  const destroyed: string[] = [];
  const guard = new AdminSessionGuard(
    reflector as never,
    {
      get: async () => session,
      synchronizePermissions: async () => undefined,
      destroy: async (value: string) => {
        destroyed.push(value);
      },
    } as never,
    config as never,
    {
      adminUser: {
        findUnique: async () => ({
          status: "DISABLED",
          roles: [],
        }),
      },
    } as never,
  );
  const request = {
    path: "/v1/admin/access/roles",
    method: "GET",
    cookies: { cloudbridge_admin_session: token },
    header: () => undefined,
  };

  await assert.rejects(
    guard.canActivate(contextFor(request) as never),
    UnauthorizedException,
  );
  assert.deepEqual(destroyed, [token]);
});
