import assert from "node:assert/strict";
import test from "node:test";
import {
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { AccessService } from "../src/access/access.service.js";

const recentActor = (userId = "actor") => ({
  userId,
  requestId: "request-access",
  ip: "127.0.0.1",
  reauthenticatedAt: Date.now(),
});

const role = (id: string, key: string) => ({
  id,
  key,
  nameZh: key === "SUPER_ADMIN" ? "超级管理员" : "订单客服",
  nameEn: key === "SUPER_ADMIN" ? "Super admin" : "Order support",
  description: null,
});

const member = (
  id: string,
  roleRows: Array<ReturnType<typeof role>>,
  updatedAt = new Date("2026-07-29T10:00:00.000Z"),
) => ({
  id,
  email: `${id}@cloudbridge.test`,
  displayName: id,
  status: "ACTIVE" as const,
  totpEnabled: true,
  lastLoginAt: new Date("2026-07-29T09:00:00.000Z"),
  createdAt: new Date("2026-07-28T00:00:00.000Z"),
  updatedAt,
  roles: roleRows.map((item) => ({ role: item })),
});

test("member role changes require recent authentication before a transaction starts", async () => {
  const auditEvents: Array<Record<string, unknown>> = [];
  const service = new AccessService({
    $transaction: async () => {
      throw new Error("transaction must not start");
    },
  } as never, {
    record: async (event: Record<string, unknown>) => {
      auditEvents.push(event);
    },
  } as never);

  await assert.rejects(
    service.updateMemberRoles("member", {
      roleIds: ["role-order"],
      expectedUpdatedAt: "2026-07-29T10:00:00.000Z",
      reason: "职责范围发生调整",
    }, {
      ...recentActor(),
      reauthenticatedAt: Date.now() - (6 * 60_000),
    }),
    ForbiddenException,
  );
  assert.equal(auditEvents[0]?.result, "DENIED");
  assert.equal(auditEvents[0]?.action, "team.member.roles.update");
});

test("administrators cannot change their own role assignment", async () => {
  const auditEvents: Array<Record<string, unknown>> = [];
  const service = new AccessService({} as never, {
    record: async (event: Record<string, unknown>) => {
      auditEvents.push(event);
    },
  } as never);

  await assert.rejects(
    service.updateMemberRoles("actor", {
      roleIds: ["role-order"],
      expectedUpdatedAt: "2026-07-29T10:00:00.000Z",
      reason: "职责范围发生调整",
    }, recentActor()),
    ForbiddenException,
  );
  assert.equal(auditEvents[0]?.result, "DENIED");
});

test("the last active super administrator keeps the protected role", async () => {
  let updateCalled = false;
  const current = member("member", [role("role-super", "SUPER_ADMIN")]);
  const transaction = {
    adminUser: {
      findUnique: async () => current,
      count: async () => 1,
      updateMany: async () => {
        updateCalled = true;
        return { count: 1 };
      },
    },
    role: {
      findMany: async () => [role("role-order", "ORDER_SUPPORT")],
    },
  };
  const service = new AccessService({
    $transaction: async (callback: (client: typeof transaction) => unknown) =>
      callback(transaction),
  } as never, { record: async () => undefined } as never);

  await assert.rejects(
    service.updateMemberRoles("member", {
      roleIds: ["role-order"],
      expectedUpdatedAt: current.updatedAt.toISOString(),
      reason: "职责范围发生调整",
    }, recentActor()),
    ConflictException,
  );
  assert.equal(updateCalled, false);
});

test("member role changes are concurrent-safe and audited inside one transaction", async () => {
  const current = member("member", [role("role-old", "CONTENT_EDITOR")]);
  const nextRole = role("role-order", "ORDER_SUPPORT");
  const committed = member(
    "member",
    [nextRole],
    new Date("2026-07-29T11:00:00.000Z"),
  );
  const auditEvents: Array<{ event: Record<string, unknown>; client: unknown }> = [];
  let deleteCalled = false;
  let createdRoles: unknown;
  let transactionOptions: Record<string, unknown> | undefined;
  const transaction = {
    adminUser: {
      findUnique: async () => current,
      updateMany: async () => ({ count: 1 }),
      findUniqueOrThrow: async () => committed,
    },
    role: {
      findMany: async () => [nextRole],
    },
    adminUserRole: {
      deleteMany: async () => {
        deleteCalled = true;
      },
      createMany: async ({ data }: { data: unknown }) => {
        createdRoles = data;
      },
    },
  };
  const prisma = {
    $transaction: async (
      callback: (client: typeof transaction) => unknown,
      options: Record<string, unknown>,
    ) => {
      transactionOptions = options;
      return callback(transaction);
    },
  };
  const service = new AccessService(prisma as never, {
    record: async (event: Record<string, unknown>, client: unknown) => {
      auditEvents.push({ event, client });
    },
  } as never);

  const updated = await service.updateMemberRoles("member", {
    roleIds: [nextRole.id],
    expectedUpdatedAt: current.updatedAt.toISOString(),
    reason: "职责范围发生调整",
  }, recentActor());

  assert.equal(updated.roles[0]?.key, "ORDER_SUPPORT");
  assert.equal(deleteCalled, true);
  assert.deepEqual(createdRoles, [{ adminUserId: "member", roleId: nextRole.id }]);
  assert.equal(transactionOptions?.isolationLevel, "Serializable");
  assert.equal(auditEvents[0]?.client, transaction);
  assert.deepEqual(auditEvents[0]?.event.beforeData, { roles: ["CONTENT_EDITOR"] });
  assert.deepEqual(auditEvents[0]?.event.afterData, { roles: ["ORDER_SUPPORT"] });
});

test("role permission changes protect SUPER_ADMIN and audit committed permission keys", async () => {
  const deniedEvents: Array<Record<string, unknown>> = [];
  const protectedService = new AccessService({
    role: {
      findUnique: async () => ({ key: "SUPER_ADMIN" }),
    },
  } as never, {
    record: async (event: Record<string, unknown>) => {
      deniedEvents.push(event);
    },
  } as never);
  await assert.rejects(
    protectedService.updateRolePermissions("role-super", {
      permissionKeys: ["orders.read"],
      expectedUpdatedAt: "2026-07-29T10:00:00.000Z",
      reason: "权限职责范围调整",
    }, recentActor()),
    ForbiddenException,
  );
  assert.equal(deniedEvents[0]?.result, "DENIED");

  const currentRole = {
    ...role("role-order", "ORDER_SUPPORT"),
    updatedAt: new Date("2026-07-29T10:00:00.000Z"),
    permissions: [{ permission: { id: "permission-read", key: "orders.read" } }],
    _count: { users: 2 },
  };
  const committedRole = {
    ...currentRole,
    updatedAt: new Date("2026-07-29T11:00:00.000Z"),
    permissions: [
      { permission: { id: "permission-read", key: "orders.read" } },
      { permission: { id: "permission-write", key: "orders.write" } },
    ],
  };
  const auditEvents: Array<{ event: Record<string, unknown>; client: unknown }> = [];
  let createdPermissions: unknown;
  let transactionOptions: Record<string, unknown> | undefined;
  const transaction = {
    role: {
      findUnique: async () => currentRole,
      updateMany: async () => ({ count: 1 }),
      findUniqueOrThrow: async () => committedRole,
    },
    permission: {
      findMany: async () => [
        { id: "permission-read", key: "orders.read" },
        { id: "permission-write", key: "orders.write" },
      ],
    },
    rolePermission: {
      deleteMany: async () => undefined,
      createMany: async ({ data }: { data: unknown }) => {
        createdPermissions = data;
      },
    },
  };
  const service = new AccessService({
    role: {
      findUnique: async () => ({ key: "ORDER_SUPPORT" }),
    },
    $transaction: async (
      callback: (client: typeof transaction) => unknown,
      options: Record<string, unknown>,
    ) => {
      transactionOptions = options;
      return callback(transaction);
    },
  } as never, {
    record: async (event: Record<string, unknown>, client: unknown) => {
      auditEvents.push({ event, client });
    },
  } as never);

  const updated = await service.updateRolePermissions("role-order", {
    permissionKeys: ["orders.read", "orders.write"],
    expectedUpdatedAt: currentRole.updatedAt.toISOString(),
    reason: "权限职责范围调整",
  }, recentActor());

  assert.deepEqual(updated.permissions, ["orders.read", "orders.write"]);
  assert.deepEqual(createdPermissions, [
    { roleId: "role-order", permissionId: "permission-read" },
    { roleId: "role-order", permissionId: "permission-write" },
  ]);
  assert.equal(transactionOptions?.isolationLevel, "Serializable");
  assert.equal(auditEvents[0]?.client, transaction);
  assert.deepEqual(auditEvents[0]?.event.beforeData, { permissions: ["orders.read"] });
  assert.deepEqual(auditEvents[0]?.event.afterData, {
    permissions: ["orders.read", "orders.write"],
  });
});
