import assert from "node:assert/strict";
import test from "node:test";
import type {
  AdminUser,
  AuditEvent,
} from "../src/api";
import {
  buildDataSecurityReadiness,
  dataGovernanceGateCodes,
  dataSecurityBoundaryCodes,
  dataSecurityControlCodes,
} from "../src/features/data-security/model";

const user: AdminUser = {
  id: "admin-one",
  email: "admin@example.com",
  displayName: "Admin One",
  roles: [
    { key: "SUPPORT", name: { zh: "客服", en: "Support" } },
    { key: "SECURITY_REVIEWER", name: { zh: "安全复核", en: "Security reviewer" } },
  ],
  permissions: ["orders.read", "audit.read", "contacts.reveal"],
  totpEnabled: true,
};

const auditEvent = ({
  action = "auth.login.password",
  createdAt,
  id,
  result = "SUCCEEDED",
}: {
  action?: string;
  createdAt: string;
  id: string;
  result?: AuditEvent["result"];
}): AuditEvent => ({
  id,
  requestId: `request-${id}`,
  action,
  targetType: "AdminUser",
  targetId: "admin-one",
  result,
  reason: result === "SUCCEEDED" ? null : "Review required",
  actor: {
    displayName: "Admin One",
    email: "admin@example.com",
  },
  createdAt,
});

test("data security readiness reports the current session without expanding its safe projection", () => {
  const result = buildDataSecurityReadiness({
    auditEvents: [],
    canReadAudit: true,
    user,
  });

  assert.deepEqual(result.currentSession, {
    roleCount: 2,
    roleKeys: ["SECURITY_REVIEWER", "SUPPORT"],
    permissionCount: 3,
    totpEnabled: true,
    auditReadGranted: true,
  });
  assert.equal("email" in result.currentSession, false);
  assert.equal("password" in result.currentSession, false);
  assert.equal("totpSecret" in result.currentSession, false);
});

test("data security readiness sorts and caps authorized audit evidence", () => {
  const events = Array.from({ length: 8 }, (_, index) =>
    auditEvent({
      action: index === 5 ? "order.contact.reveal" : "auth.login.password",
      createdAt: `2026-07-29T${String(index).padStart(2, "0")}:00:00.000Z`,
      id: `audit-${String(index).padStart(2, "0")}`,
      result: index === 4 ? "DENIED" : "SUCCEEDED",
    }),
  );

  const result = buildDataSecurityReadiness({
    auditEvents: events,
    canReadAudit: true,
    user,
  });

  assert.equal(result.auditEvidence.state, "AVAILABLE");
  assert.equal(result.auditEvidence.loadedCount, 8);
  assert.equal(result.auditEvidence.deniedOrFailedCount, 1);
  assert.equal(result.auditEvidence.sensitiveAccessCount, 1);
  assert.equal(result.auditEvidence.latestRecordedAt, "2026-07-29T07:00:00.000Z");
  assert.equal(result.auditEvidence.recentEvents.length, 6);
  assert.equal(result.auditEvidence.recentEvents[0]?.id, "audit-07");
  assert.equal(result.auditEvidence.recentEvents[5]?.id, "audit-02");
});

test("data security readiness fails closed when audit permission is absent", () => {
  const result = buildDataSecurityReadiness({
    auditEvents: [
      auditEvent({
        createdAt: "2026-07-29T12:00:00.000Z",
        id: "audit-hidden",
      }),
    ],
    canReadAudit: false,
    user: {
      ...user,
      permissions: ["orders.read"],
    },
  });

  assert.equal(result.auditEvidence.state, "RESTRICTED");
  assert.equal(result.auditEvidence.loadedCount, null);
  assert.equal(result.auditEvidence.deniedOrFailedCount, null);
  assert.equal(result.auditEvidence.sensitiveAccessCount, null);
  assert.equal(result.auditEvidence.latestRecordedAt, null);
  assert.deepEqual(result.auditEvidence.recentEvents, []);
});

test("data security readiness keeps code controls separate from governance gates", () => {
  const result = buildDataSecurityReadiness({
    auditEvents: null,
    canReadAudit: true,
    user,
  });

  assert.deepEqual(result.controls.map((control) => control.code), dataSecurityControlCodes);
  assert.ok(result.controls.every((control) => control.state === "IMPLEMENTED_CODE"));
  assert.deepEqual(result.boundaries.map((boundary) => boundary.code), dataSecurityBoundaryCodes);
  assert.ok(result.boundaries.every((boundary) => boundary.retentionState === "NOT_DEFINED"));
  assert.deepEqual(result.gates.map((gate) => gate.code), dataGovernanceGateCodes);
  assert.deepEqual(result.gates.map((gate) => gate.state), [
    "NOT_DEFINED",
    "NOT_DEFINED",
    "NOT_IMPLEMENTED",
    "NOT_IMPLEMENTED",
    "NOT_CONNECTED",
  ]);
});
