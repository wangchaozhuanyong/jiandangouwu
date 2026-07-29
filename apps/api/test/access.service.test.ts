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

const sessionStore = {
  destroyUserAuthenticationState: async () => ({
    revokedSessionCount: 0,
    revokedChallengeCount: 0,
  }),
};

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
  passwordHash: "scrypt-test-password-hash",
  totpSecretEncrypted: "encrypted-test-totp-secret",
  totpEnabled: true,
  failedLoginCount: 0,
  lockedUntil: null,
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
  } as never, sessionStore as never);

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
  } as never, sessionStore as never);

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

test("administrators cannot change their own lifecycle or reset their own TOTP from team management", async () => {
  const auditEvents: Array<Record<string, unknown>> = [];
  const service = new AccessService({} as never, {
    record: async (event: Record<string, unknown>) => {
      auditEvents.push(event);
    },
  } as never, sessionStore as never);

  await assert.rejects(
    service.updateMemberLifecycle("actor", {
      action: "RESET_TOTP",
      expectedUpdatedAt: "2026-07-29T10:00:00.000Z",
      reason: "成员遗失了原双重验证设备",
    }, recentActor()),
    ForbiddenException,
  );
  assert.equal(auditEvents[0]?.action, "team.member.totp_reset");
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
  } as never, { record: async () => undefined } as never, sessionStore as never);

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
  } as never, sessionStore as never);

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
  } as never, sessionStore as never);
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
  } as never, sessionStore as never);

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

test("member disabling revokes authentication state and audits the committed status", async () => {
  const current = member("member", [role("role-order", "ORDER_SUPPORT")]);
  const committed = {
    ...current,
    status: "DISABLED" as const,
    failedLoginCount: 0,
    lockedUntil: null,
    updatedAt: new Date("2026-07-29T11:00:00.000Z"),
  };
  const auditEvents: Array<{ event: Record<string, unknown>; client: unknown }> = [];
  let updateData: Record<string, unknown> | undefined;
  const transaction = {
    adminUser: {
      findUnique: async () => current,
      count: async () => 2,
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return { count: 1 };
      },
      findUniqueOrThrow: async () => committed,
    },
  };
  const sessions = {
    destroyUserAuthenticationState: async (userId: string) => {
      assert.equal(userId, "member");
      return { revokedSessionCount: 2, revokedChallengeCount: 1 };
    },
  };
  const service = new AccessService({
    $transaction: async (
      callback: (client: typeof transaction) => unknown,
    ) => callback(transaction),
  } as never, {
    record: async (event: Record<string, unknown>, client: unknown) => {
      auditEvents.push({ event, client });
    },
  } as never, sessions as never);

  const result = await service.updateMemberLifecycle("member", {
    action: "DISABLE",
    expectedUpdatedAt: current.updatedAt.toISOString(),
    reason: "成员已离开当前运营岗位",
  }, recentActor());

  assert.equal(result.action, "DISABLE");
  assert.equal(result.member.status, "DISABLED");
  assert.equal(result.revokedSessionCount, 2);
  assert.equal(result.revokedChallengeCount, 1);
  assert.equal(updateData?.status, "DISABLED");
  assert.equal(auditEvents[0]?.client, transaction);
  assert.equal(auditEvents[0]?.event.action, "team.member.disabled");
  assert.deepEqual(auditEvents[0]?.event.beforeData, {
    status: "ACTIVE",
    totpEnabled: true,
    failedLoginCount: 0,
    lockedUntil: null,
  });
  assert.deepEqual(auditEvents[0]?.event.afterData, {
    status: "DISABLED",
    totpEnabled: true,
    failedLoginCount: 0,
    lockedUntil: null,
    revokedSessionCount: 2,
    revokedChallengeCount: 1,
  });
});

test("the last active super administrator cannot be disabled", async () => {
  const current = member("member", [role("role-super", "SUPER_ADMIN")]);
  let revocationCalled = false;
  const transaction = {
    adminUser: {
      findUnique: async () => current,
      count: async () => 1,
    },
  };
  const service = new AccessService({
    $transaction: async (
      callback: (client: typeof transaction) => unknown,
    ) => callback(transaction),
  } as never, { record: async () => undefined } as never, {
    destroyUserAuthenticationState: async () => {
      revocationCalled = true;
      return { revokedSessionCount: 0, revokedChallengeCount: 0 };
    },
  } as never);

  await assert.rejects(
    service.updateMemberLifecycle("member", {
      action: "DISABLE",
      expectedUpdatedAt: current.updatedAt.toISOString(),
      reason: "成员已离开当前运营岗位",
    }, recentActor()),
    ConflictException,
  );
  assert.equal(revocationCalled, false);
});

test("a disabled administrator without a password cannot be enabled", async () => {
  const current = {
    ...member("member", [role("role-order", "ORDER_SUPPORT")]),
    status: "DISABLED" as const,
    passwordHash: null,
  };
  let revocationCalled = false;
  const transaction = {
    adminUser: {
      findUnique: async () => current,
    },
  };
  const service = new AccessService({
    $transaction: async (
      callback: (client: typeof transaction) => unknown,
    ) => callback(transaction),
  } as never, { record: async () => undefined } as never, {
    destroyUserAuthenticationState: async () => {
      revocationCalled = true;
      return { revokedSessionCount: 0, revokedChallengeCount: 0 };
    },
  } as never);

  await assert.rejects(
    service.updateMemberLifecycle("member", {
      action: "ENABLE",
      expectedUpdatedAt: current.updatedAt.toISOString(),
      reason: "成员重新加入当前运营岗位",
    }, recentActor()),
    ConflictException,
  );
  assert.equal(revocationCalled, false);
});

test("TOTP reset clears only the secret state, revokes authentication, and never audits the secret", async () => {
  const current = member("member", [role("role-order", "ORDER_SUPPORT")]);
  const committed = {
    ...current,
    totpEnabled: false,
    totpSecretEncrypted: null,
    updatedAt: new Date("2026-07-29T11:00:00.000Z"),
  };
  const auditEvents: Array<Record<string, unknown>> = [];
  let updateData: Record<string, unknown> | undefined;
  const transaction = {
    adminUser: {
      findUnique: async () => current,
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return { count: 1 };
      },
      findUniqueOrThrow: async () => committed,
    },
  };
  const service = new AccessService({
    $transaction: async (
      callback: (client: typeof transaction) => unknown,
    ) => callback(transaction),
  } as never, {
    record: async (event: Record<string, unknown>) => {
      auditEvents.push(event);
    },
  } as never, {
    destroyUserAuthenticationState: async () => ({
      revokedSessionCount: 1,
      revokedChallengeCount: 2,
    }),
  } as never);

  const result = await service.updateMemberLifecycle("member", {
    action: "RESET_TOTP",
    expectedUpdatedAt: current.updatedAt.toISOString(),
    reason: "成员遗失了原双重验证设备",
  }, recentActor());

  assert.equal(result.member.totpEnabled, false);
  assert.equal(updateData?.totpEnabled, false);
  assert.equal(updateData?.totpSecretEncrypted, null);
  assert.equal(auditEvents[0]?.action, "team.member.totp_reset");
  assert.equal(JSON.stringify(auditEvents[0]).includes("encrypted-test-totp-secret"), false);
});
