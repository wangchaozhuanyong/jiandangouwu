import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { AccessService } from "../src/access/access.service.js";
import { AuditService } from "../src/audit/audit.service.js";
import { SessionService } from "../src/auth/session.service.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

const qaId = randomBytes(8).toString("hex");
const actorId = `qa-lifecycle-actor-${qaId}`;
const memberId = `qa-lifecycle-member-${qaId}`;
const actorEmail = `${actorId}@invalid.example`;
const memberEmail = `${memberId}@invalid.example`;
const requestId = `qa-lifecycle-request-${qaId}`;
const config = new ConfigService();
const prisma = new PrismaService(config);
const sessions = new SessionService(config);
const audit = new AuditService(prisma);
const access = new AccessService(prisma, audit, sessions);
let redisConnected = false;

const actor = {
  userId: actorId,
  requestId,
  ip: "127.0.0.1",
  reauthenticatedAt: Date.now(),
};

try {
  await sessions.onModuleInit();
  redisConnected = true;
  const [superRole, memberRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } }),
    prisma.role.findUniqueOrThrow({ where: { key: "ORDER_SUPPORT" } }),
  ]);
  await prisma.$transaction(async (transaction) => {
    await transaction.adminUser.create({
      data: {
        id: actorId,
        email: actorEmail,
        displayName: "QA lifecycle actor",
        passwordHash: "qa-not-a-login-password-hash",
        status: "ACTIVE",
        roles: {
          create: { roleId: superRole.id },
        },
      },
    });
    await transaction.adminUser.create({
      data: {
        id: memberId,
        email: memberEmail,
        displayName: "QA lifecycle member",
        passwordHash: "qa-not-a-login-password-hash",
        status: "ACTIVE",
        totpEnabled: true,
        totpSecretEncrypted: "qa-encrypted-placeholder",
        roles: {
          create: { roleId: memberRole.id },
        },
      },
    });
  });

  const issued = await Promise.all([
    sessions.create({
      userId: memberId,
      email: memberEmail,
      displayName: "QA lifecycle member",
      permissions: ["orders.read"],
      reauthenticatedAt: Date.now(),
    }),
    sessions.create({
      userId: memberId,
      email: memberEmail,
      displayName: "QA lifecycle member",
      permissions: ["orders.read"],
      reauthenticatedAt: Date.now(),
    }),
  ]);
  await sessions.createChallenge({ kind: "totp-login", userId: memberId });
  await sessions.createChallenge({
    kind: "totp-enrollment",
    userId: memberId,
    encryptedSecret: "qa-encrypted-placeholder",
  });

  const initial = await prisma.adminUser.findUniqueOrThrow({
    where: { id: memberId },
    select: { updatedAt: true },
  });
  const disabled = await access.updateMemberLifecycle(memberId, {
    action: "DISABLE",
    expectedUpdatedAt: initial.updatedAt.toISOString(),
    reason: "QA verifies account disabling",
  }, actor);
  assert.equal(disabled.member.status, "DISABLED");
  assert.equal(disabled.revokedSessionCount, 2);
  assert.equal(disabled.revokedChallengeCount, 2);
  assert.deepEqual(
    (await sessions.userSessions(memberId, "")).sessions,
    [],
  );
  for (const item of issued) assert.equal(await sessions.get(item.token), null);

  const enabled = await access.updateMemberLifecycle(memberId, {
    action: "ENABLE",
    expectedUpdatedAt: disabled.member.updatedAt,
    reason: "QA verifies account re-enabling",
  }, actor);
  assert.equal(enabled.member.status, "ACTIVE");

  const locked = await prisma.adminUser.update({
    where: { id: memberId },
    data: {
      status: "LOCKED",
      failedLoginCount: 5,
      lockedUntil: new Date(Date.now() + 15 * 60_000),
    },
    select: { updatedAt: true },
  });
  const unlocked = await access.updateMemberLifecycle(memberId, {
    action: "UNLOCK",
    expectedUpdatedAt: locked.updatedAt.toISOString(),
    reason: "QA verifies manual account unlock",
  }, actor);
  assert.equal(unlocked.member.status, "ACTIVE");
  assert.equal(unlocked.member.failedLoginCount, 0);
  assert.equal(unlocked.member.lockedUntil, null);

  await sessions.create({
    userId: memberId,
    email: memberEmail,
    displayName: "QA lifecycle member",
    permissions: ["orders.read"],
    reauthenticatedAt: Date.now(),
  });
  await sessions.createChallenge({ kind: "totp-login", userId: memberId });
  const reset = await access.updateMemberLifecycle(memberId, {
    action: "RESET_TOTP",
    expectedUpdatedAt: unlocked.member.updatedAt,
    reason: "QA verifies administrator TOTP reset",
  }, actor);
  assert.equal(reset.member.totpEnabled, false);
  assert.equal(reset.revokedSessionCount, 1);
  assert.equal(reset.revokedChallengeCount, 1);

  const stored = await prisma.adminUser.findUniqueOrThrow({
    where: { id: memberId },
    select: {
      status: true,
      totpEnabled: true,
      totpSecretEncrypted: true,
      failedLoginCount: true,
      lockedUntil: true,
    },
  });
  assert.deepEqual(stored, {
    status: "ACTIVE",
    totpEnabled: false,
    totpSecretEncrypted: null,
    failedLoginCount: 0,
    lockedUntil: null,
  });
  const auditEvents = await prisma.auditEvent.findMany({
    where: {
      actorId,
      targetId: memberId,
      action: {
        in: [
          "team.member.disabled",
          "team.member.enabled",
          "team.member.unlocked",
          "team.member.totp_reset",
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
      { action: "team.member.disabled", result: "SUCCEEDED" },
      { action: "team.member.enabled", result: "SUCCEEDED" },
      { action: "team.member.unlocked", result: "SUCCEEDED" },
      { action: "team.member.totp_reset", result: "SUCCEEDED" },
    ],
  );
  assert.equal(
    JSON.stringify(auditEvents).includes("qa-encrypted-placeholder"),
    false,
  );

  console.log(JSON.stringify({
    verified: true,
    source: "MYSQL_VALKEY",
    actions: auditEvents.map(({ action }) => action),
    disabledSessionCount: disabled.revokedSessionCount,
    disabledChallengeCount: disabled.revokedChallengeCount,
    totpResetSessionCount: reset.revokedSessionCount,
    totpResetChallengeCount: reset.revokedChallengeCount,
    finalStatus: stored.status,
    finalTotpEnabled: stored.totpEnabled,
  }));
} finally {
  if (redisConnected) {
    await sessions.destroyUserAuthenticationState(memberId);
    await sessions.destroyUserAuthenticationState(actorId);
    await sessions.onModuleDestroy();
  }
  await prisma.auditEvent.deleteMany({
    where: {
      OR: [
        { actorId },
        { targetId: { in: [actorId, memberId] } },
      ],
    },
  });
  await prisma.adminUser.deleteMany({
    where: { id: { in: [actorId, memberId] } },
  });
  const [remainingUsers, remainingAudit] = await Promise.all([
    prisma.adminUser.count({ where: { id: { in: [actorId, memberId] } } }),
    prisma.auditEvent.count({
      where: {
        OR: [
          { actorId },
          { targetId: { in: [actorId, memberId] } },
        ],
      },
    }),
  ]);
  assert.equal(remainingUsers, 0);
  assert.equal(remainingAudit, 0);
  console.log(JSON.stringify({
    cleanupVerified: true,
    remainingQaUsers: remainingUsers,
    remainingQaAuditEvents: remainingAudit,
  }));
  await prisma.$disconnect();
}
