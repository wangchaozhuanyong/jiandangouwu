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

test("role creation validates permissions and audits the committed role", async () => {
  const permissions = [
    { id: "permission-read", key: "orders.read" },
    { id: "permission-write", key: "orders.write" },
  ];
  const committedRole = {
    ...role("role-review", "ORDER_REVIEWER"),
    nameZh: "订单复核员",
    nameEn: "Order reviewer",
    description: "复核人工订单",
    updatedAt: new Date("2026-07-29T11:00:00.000Z"),
    permissions: permissions.map((permission) => ({ permission })),
    _count: { users: 0 },
  };
  let createdRoleData: Record<string, unknown> | undefined;
  let createdPermissionData: unknown;
  const auditEvents: Array<{ event: Record<string, unknown>; client: unknown }> = [];
  const transaction = {
    role: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdRoleData = data;
        return { id: "role-review" };
      },
      findUniqueOrThrow: async () => committedRole,
    },
    permission: {
      findMany: async () => permissions,
    },
    rolePermission: {
      createMany: async ({ data }: { data: unknown }) => {
        createdPermissionData = data;
      },
    },
  };
  const service = new AccessService({
    $transaction: async (
      callback: (client: typeof transaction) => unknown,
      options: Record<string, unknown>,
    ) => {
      assert.equal(options.isolationLevel, "Serializable");
      return callback(transaction);
    },
  } as never, {
    record: async (event: Record<string, unknown>, client: unknown) => {
      auditEvents.push({ event, client });
    },
  } as never, sessionStore as never);

  const created = await service.createRole({
    key: "ORDER_REVIEWER",
    nameZh: "订单复核员",
    nameEn: "Order reviewer",
    description: "复核人工订单",
    permissionKeys: ["orders.read", "orders.write"],
    reason: "新增订单复核职责角色",
  }, recentActor());

  assert.equal(created.key, "ORDER_REVIEWER");
  assert.deepEqual(createdRoleData, {
    key: "ORDER_REVIEWER",
    nameZh: "订单复核员",
    nameEn: "Order reviewer",
    description: "复核人工订单",
  });
  assert.deepEqual(createdPermissionData, [
    { roleId: "role-review", permissionId: "permission-read" },
    { roleId: "role-review", permissionId: "permission-write" },
  ]);
  assert.equal(auditEvents[0]?.client, transaction);
  assert.equal(auditEvents[0]?.event.action, "access.role.created");
  assert.deepEqual(auditEvents[0]?.event.afterData, {
    key: "ORDER_REVIEWER",
    nameZh: "订单复核员",
    nameEn: "Order reviewer",
    description: "复核人工订单",
    permissions: ["orders.read", "orders.write"],
  });
});

test("role metadata changes keep the key stable and use CAS with transactional audit", async () => {
  const currentRole = {
    ...role("role-review", "ORDER_REVIEWER"),
    nameZh: "订单复核员",
    nameEn: "Order reviewer",
    description: null,
    updatedAt: new Date("2026-07-29T10:00:00.000Z"),
    permissions: [{ permission: { id: "permission-read", key: "orders.read" } }],
    _count: { users: 0 },
  };
  const committedRole = {
    ...currentRole,
    nameZh: "订单审核员",
    nameEn: "Order auditor",
    description: "复核人工订单",
    updatedAt: new Date("2026-07-29T11:00:00.000Z"),
  };
  let updateWhere: Record<string, unknown> | undefined;
  let updateData: Record<string, unknown> | undefined;
  const auditEvents: Array<{ event: Record<string, unknown>; client: unknown }> = [];
  const transaction = {
    role: {
      findUnique: async () => currentRole,
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        updateWhere = where;
        updateData = data;
        return { count: 1 };
      },
      findUniqueOrThrow: async () => committedRole,
    },
  };
  const service = new AccessService({
    role: {
      findUnique: async () => ({ key: "ORDER_REVIEWER" }),
    },
    $transaction: async (
      callback: (client: typeof transaction) => unknown,
    ) => callback(transaction),
  } as never, {
    record: async (event: Record<string, unknown>, client: unknown) => {
      auditEvents.push({ event, client });
    },
  } as never, sessionStore as never);

  const updated = await service.updateRoleMetadata("role-review", {
    nameZh: "订单审核员",
    nameEn: "Order auditor",
    description: "复核人工订单",
    expectedUpdatedAt: currentRole.updatedAt.toISOString(),
    reason: "角色职责名称需要调整",
  }, recentActor());

  assert.equal(updated.key, "ORDER_REVIEWER");
  assert.equal(updated.name.zh, "订单审核员");
  assert.deepEqual(updateWhere, {
    id: "role-review",
    updatedAt: currentRole.updatedAt,
  });
  assert.equal(updateData?.nameZh, "订单审核员");
  assert.equal(updateData?.nameEn, "Order auditor");
  assert.equal(updateData?.description, "复核人工订单");
  assert.equal(auditEvents[0]?.client, transaction);
  assert.deepEqual(auditEvents[0]?.event.beforeData, {
    nameZh: "订单复核员",
    nameEn: "Order reviewer",
    description: null,
  });
});

test("role deletion protects SUPER_ADMIN and refuses roles that still have members", async () => {
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
    protectedService.deleteRole("role-super", {
      expectedUpdatedAt: "2026-07-29T10:00:00.000Z",
      reason: "系统角色删除请求必须拒绝",
    }, recentActor()),
    ForbiddenException,
  );
  assert.equal(deniedEvents[0]?.action, "access.role.deleted");
  assert.equal(deniedEvents[0]?.result, "DENIED");

  let deleteCalled = false;
  const assignedRole = {
    ...role("role-review", "ORDER_REVIEWER"),
    updatedAt: new Date("2026-07-29T10:00:00.000Z"),
    permissions: [{ permission: { id: "permission-read", key: "orders.read" } }],
    _count: { users: 1 },
  };
  const transaction = {
    role: {
      findUnique: async () => assignedRole,
      deleteMany: async () => {
        deleteCalled = true;
        return { count: 1 };
      },
    },
  };
  const assignedService = new AccessService({
    role: {
      findUnique: async () => ({ key: "ORDER_REVIEWER" }),
    },
    $transaction: async (
      callback: (client: typeof transaction) => unknown,
    ) => callback(transaction),
  } as never, { record: async () => undefined } as never, sessionStore as never);
  await assert.rejects(
    assignedService.deleteRole("role-review", {
      expectedUpdatedAt: assignedRole.updatedAt.toISOString(),
      reason: "该角色计划停止使用需要删除",
    }, recentActor()),
    ConflictException,
  );
  assert.equal(deleteCalled, false);
});

test("empty role deletion uses CAS and audits the final role projection", async () => {
  const currentRole = {
    ...role("role-review", "ORDER_REVIEWER"),
    nameZh: "订单复核员",
    nameEn: "Order reviewer",
    description: "复核人工订单",
    updatedAt: new Date("2026-07-29T10:00:00.000Z"),
    permissions: [
      { permission: { id: "permission-read", key: "orders.read" } },
      { permission: { id: "permission-write", key: "orders.write" } },
    ],
    _count: { users: 0 },
  };
  let deleteWhere: Record<string, unknown> | undefined;
  const auditEvents: Array<{ event: Record<string, unknown>; client: unknown }> = [];
  const transaction = {
    role: {
      findUnique: async () => currentRole,
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        deleteWhere = where;
        return { count: 1 };
      },
    },
  };
  const service = new AccessService({
    role: {
      findUnique: async () => ({ key: "ORDER_REVIEWER" }),
    },
    $transaction: async (
      callback: (client: typeof transaction) => unknown,
      options: Record<string, unknown>,
    ) => {
      assert.equal(options.isolationLevel, "Serializable");
      return callback(transaction);
    },
  } as never, {
    record: async (event: Record<string, unknown>, client: unknown) => {
      auditEvents.push({ event, client });
    },
  } as never, sessionStore as never);

  const deleted = await service.deleteRole("role-review", {
    expectedUpdatedAt: currentRole.updatedAt.toISOString(),
    reason: "该空角色已经停止使用需要删除",
  }, recentActor());

  assert.deepEqual(deleted, {
    id: "role-review",
    key: "ORDER_REVIEWER",
    name: { zh: "订单复核员", en: "Order reviewer" },
  });
  assert.deepEqual(deleteWhere, {
    id: "role-review",
    updatedAt: currentRole.updatedAt,
  });
  assert.equal(auditEvents[0]?.client, transaction);
  assert.equal(auditEvents[0]?.event.action, "access.role.deleted");
  assert.deepEqual(auditEvents[0]?.event.beforeData, {
    key: "ORDER_REVIEWER",
    nameZh: "订单复核员",
    nameEn: "Order reviewer",
    description: "复核人工订单",
    permissions: ["orders.read", "orders.write"],
    memberCount: 0,
  });
  assert.deepEqual(auditEvents[0]?.event.afterData, { deleted: true });
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
