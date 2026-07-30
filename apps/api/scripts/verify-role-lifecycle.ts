import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { AccessService } from "../src/access/access.service.js";
import { AuditService } from "../src/audit/audit.service.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

const qaId = randomBytes(8).toString("hex");
const actorId = `qa-role-actor-${qaId}`;
const memberId = `qa-role-member-${qaId}`;
const actorEmail = `${actorId}@invalid.example`;
const memberEmail = `${memberId}@invalid.example`;
const roleKey = `QA_ROLE_${qaId.toUpperCase()}`;
const requestId = `qa-role-request-${qaId}`;
const config = new ConfigService();
const prisma = new PrismaService(config);
const audit = new AuditService(prisma);
const access = new AccessService(prisma, audit, {
  destroyUserAuthenticationState: async () => ({
    revokedSessionCount: 0,
    revokedChallengeCount: 0,
  }),
} as never);

const actor = {
  userId: actorId,
  requestId,
  ip: "127.0.0.1",
  reauthenticatedAt: Date.now(),
};

let roleId = "";

try {
  const superRole = await prisma.role.findUniqueOrThrow({
    where: { key: "SUPER_ADMIN" },
  });
  await prisma.adminUser.create({
    data: {
      id: actorId,
      email: actorEmail,
      displayName: "QA role lifecycle actor",
      passwordHash: "qa-not-a-login-password-hash",
      status: "ACTIVE",
      roles: {
        create: { roleId: superRole.id },
      },
    },
  });

  const created = await access.createRole({
    key: roleKey,
    nameZh: "QA 订单复核员",
    nameEn: "QA order reviewer",
    description: "QA verifies role creation",
    permissionKeys: ["orders.read"],
    reason: "QA verifies role creation",
  }, actor);
  roleId = created.id;
  assert.equal(created.key, roleKey);
  assert.deepEqual(created.permissions, ["orders.read"]);
  assert.equal(created.memberCount, 0);

  const metadata = await access.updateRoleMetadata(roleId, {
    nameZh: "QA 订单审核员",
    nameEn: "QA order auditor",
    description: "QA verifies role metadata update",
    expectedUpdatedAt: created.updatedAt,
    reason: "QA verifies metadata update",
  }, actor);
  assert.equal(metadata.key, roleKey);
  assert.equal(metadata.name.zh, "QA 订单审核员");

  const permissions = await access.updateRolePermissions(roleId, {
    permissionKeys: ["orders.read", "orders.write"],
    expectedUpdatedAt: metadata.updatedAt,
    reason: "QA verifies permission update",
  }, actor);
  assert.deepEqual(permissions.permissions, ["orders.read", "orders.write"]);

  await prisma.adminUser.create({
    data: {
      id: memberId,
      email: memberEmail,
      displayName: "QA role lifecycle member",
      passwordHash: "qa-not-a-login-password-hash",
      status: "ACTIVE",
      roles: {
        create: { roleId },
      },
    },
  });
  await assert.rejects(
    access.deleteRole(roleId, {
      expectedUpdatedAt: permissions.updatedAt,
      reason: "QA verifies assigned role protection",
    }, actor),
    /Remove every member from the role/u,
  );

  await prisma.adminUser.delete({ where: { id: memberId } });
  const beforeDelete = await prisma.role.findUniqueOrThrow({
    where: { id: roleId },
    select: { updatedAt: true },
  });
  const deleted = await access.deleteRole(roleId, {
    expectedUpdatedAt: beforeDelete.updatedAt.toISOString(),
    reason: "QA verifies empty role deletion",
  }, actor);
  assert.equal(deleted.id, roleId);
  assert.equal(deleted.key, roleKey);
  assert.equal(await prisma.role.count({ where: { id: roleId } }), 0);

  const auditEvents = await prisma.auditEvent.findMany({
    where: {
      actorId,
      targetId: roleId,
      action: {
        in: [
          "access.role.created",
          "access.role.metadata.update",
          "access.role.permissions.update",
          "access.role.deleted",
        ],
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      action: true,
      result: true,
      beforeData: true,
      afterData: true,
    },
  });
  assert.deepEqual(
    auditEvents.map(({ action, result }) => ({ action, result })),
    [
      { action: "access.role.created", result: "SUCCEEDED" },
      { action: "access.role.metadata.update", result: "SUCCEEDED" },
      { action: "access.role.permissions.update", result: "SUCCEEDED" },
      { action: "access.role.deleted", result: "SUCCEEDED" },
    ],
  );

  console.log(JSON.stringify({
    verified: true,
    source: "MYSQL",
    roleKey,
    actions: auditEvents.map(({ action }) => action),
    assignedRoleDeletionBlocked: true,
    finalRoleCount: 0,
  }));
} finally {
  await prisma.auditEvent.deleteMany({
    where: {
      OR: [
        { actorId },
        { targetId: { in: [actorId, memberId, ...(roleId ? [roleId] : [])] } },
      ],
    },
  });
  await prisma.adminUser.deleteMany({
    where: { id: { in: [actorId, memberId] } },
  });
  await prisma.role.deleteMany({
    where: {
      OR: [
        { key: roleKey },
        ...(roleId ? [{ id: roleId }] : []),
      ],
    },
  });
  const [remainingUsers, remainingRoles, remainingAudit] = await Promise.all([
    prisma.adminUser.count({ where: { id: { in: [actorId, memberId] } } }),
    prisma.role.count({
      where: {
        OR: [
          { key: roleKey },
          ...(roleId ? [{ id: roleId }] : []),
        ],
      },
    }),
    prisma.auditEvent.count({
      where: {
        OR: [
          { actorId },
          { targetId: { in: [actorId, memberId, ...(roleId ? [roleId] : [])] } },
        ],
      },
    }),
  ]);
  assert.equal(remainingUsers, 0);
  assert.equal(remainingRoles, 0);
  assert.equal(remainingAudit, 0);
  console.log(JSON.stringify({
    cleanupVerified: true,
    remainingQaUsers: remainingUsers,
    remainingQaRoles: remainingRoles,
    remainingQaAuditEvents: remainingAudit,
  }));
  await prisma.$disconnect();
}
