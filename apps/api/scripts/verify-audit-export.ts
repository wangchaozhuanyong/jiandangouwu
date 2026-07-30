import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { AdminService } from "../src/admin/admin.service.js";
import { AuditService } from "../src/audit/audit.service.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

const qaId = randomBytes(8).toString("hex");
const actorId = `qa-audit-actor-${qaId}`;
const actorEmail = `${actorId}@invalid.example`;
const sourceRequestId = `qa-audit-source-${qaId}`;
const successRequestId = `qa-audit-export-${qaId}`;
const deniedRequestId = `qa-audit-expired-${qaId}`;
const targetType = `QA_AUDIT_EXPORT_${qaId.toUpperCase()}`;
const hiddenMarker = `qa-sensitive-payload-${qaId}`;
const prisma = new PrismaService(new ConfigService());
const audit = new AuditService(prisma);
const admin = new AdminService(
  prisma,
  audit,
  { reconcileExpired: async () => ({ candidates: 0, cancelled: 0, stockRestored: 0 }) } as never,
);

try {
  const superRole = await prisma.role.findUniqueOrThrow({
    where: { key: "SUPER_ADMIN" },
  });
  await prisma.adminUser.create({
    data: {
      id: actorId,
      email: actorEmail,
      displayName: "+QA audit exporter",
      passwordHash: "qa-not-a-login-password-hash",
      status: "ACTIVE",
      roles: {
        create: { roleId: superRole.id },
      },
    },
  });
  await audit.record({
    actorId,
    action: `=QA_EXPORT_${qaId}`,
    targetType,
    targetId: `-${qaId}`,
    result: "DENIED",
    requestId: sourceRequestId,
    reason: `@qa-${qaId}`,
    beforeData: { hiddenMarker },
    afterData: { hiddenMarker },
    ip: "127.0.0.1",
  });

  const exported = await admin.exportAuditEvents({
    targetType,
    timeRange: "all",
    reason: "QA verifies secure audit export",
    confirmation: "EXPORT_AUDIT_CSV",
  }, {
    userId: actorId,
    requestId: successRequestId,
    ip: "127.0.0.1",
    reauthenticatedAt: Date.now(),
  });
  assert.equal(exported.recordCount, 1);
  assert.equal(exported.csv.includes(`"'=QA_EXPORT_${qaId}"`), true);
  assert.equal(exported.csv.includes(`"'-${qaId}"`), true);
  assert.equal(exported.csv.includes(`"'@qa-${qaId}"`), true);
  assert.equal(exported.csv.includes(hiddenMarker), false);

  await assert.rejects(admin.exportAuditEvents({
    targetType,
    timeRange: "all",
    reason: "QA verifies expired authentication denial",
    confirmation: "EXPORT_AUDIT_CSV",
  }, {
    userId: actorId,
    requestId: deniedRequestId,
    ip: "127.0.0.1",
    reauthenticatedAt: Date.now() - 6 * 60_000,
  }), /Recent reauthentication is required/u);

  const exportAudits = await prisma.auditEvent.findMany({
    where: {
      actorId,
      action: "audit.export.csv",
      targetId: { in: [successRequestId, deniedRequestId] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      targetId: true,
      result: true,
      reason: true,
      beforeData: true,
      afterData: true,
    },
  });
  assert.deepEqual(
    Object.fromEntries(exportAudits.map(({ targetId, result }) => [targetId, result])),
    {
      [successRequestId]: "SUCCEEDED",
      [deniedRequestId]: "DENIED",
    },
  );
  const successfulAudit = exportAudits.find((event) => event.targetId === successRequestId);
  assert.equal(successfulAudit?.beforeData, null);
  assert.equal(JSON.stringify(successfulAudit?.afterData).includes(hiddenMarker), false);

  console.log(JSON.stringify({
    verified: true,
    source: "MYSQL",
    exportedRecords: exported.recordCount,
    formulaInjectionNeutralized: true,
    hiddenPayloadExcluded: true,
    auditResults: exportAudits.map(({ result }) => result),
  }));
} finally {
  await prisma.auditEvent.deleteMany({
    where: { actorId },
  });
  await prisma.adminUser.deleteMany({
    where: { id: actorId },
  });
  const [remainingUsers, remainingAudit] = await Promise.all([
    prisma.adminUser.count({ where: { id: actorId } }),
    prisma.auditEvent.count({ where: { actorId } }),
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
