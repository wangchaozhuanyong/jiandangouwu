import assert from "node:assert/strict";
import test from "node:test";
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "../src/auth/auth.service.js";

const currentSessionId = "1".repeat(32);
const otherSessionId = "2".repeat(32);
const context = {
  requestId: "request-session-test",
  ip: "127.0.0.1",
};

function authHarness(options: {
  revokeResult?: boolean;
  revokedOtherCount?: number;
} = {}) {
  const auditEvents: Array<Record<string, unknown>> = [];
  const sessionCalls: Array<Record<string, unknown>> = [];
  const sessions = {
    userSessions: async (userId: string, sessionId: string) => {
      sessionCalls.push({ kind: "overview", userId, sessionId });
      return { source: "VALKEY", sessions: [] };
    },
    destroyUserSession: async (userId: string, sessionId: string) => {
      sessionCalls.push({ kind: "one", userId, sessionId });
      return options.revokeResult ?? true;
    },
    destroyOtherUserSessions: async (userId: string, sessionId: string) => {
      sessionCalls.push({ kind: "others", userId, sessionId });
      return options.revokedOtherCount ?? 2;
    },
    destroyUserAuthenticationState: async (userId: string) => {
      sessionCalls.push({ kind: "account", userId });
      return { revokedSessionCount: 0, revokedChallengeCount: 0 };
    },
  };
  const service = new AuthService(
    {} as never,
    {} as never,
    sessions as never,
    {} as never,
    {
      record: async (event: Record<string, unknown>) => {
        auditEvents.push(event);
      },
    } as never,
  );
  return { auditEvents, service, sessionCalls };
}

test("session overview delegates only the current account identity", async () => {
  const { service, sessionCalls } = authHarness();

  assert.deepEqual(await service.sessionOverview("admin-one", currentSessionId), {
    source: "VALKEY",
    sessions: [],
  });
  assert.deepEqual(sessionCalls, [{
    kind: "overview",
    userId: "admin-one",
    sessionId: currentSessionId,
  }]);
});

test("the current session cannot be revoked from the session table", async () => {
  const { auditEvents, service, sessionCalls } = authHarness();

  await assert.rejects(
    service.revokeSession(
      "admin-one",
      currentSessionId,
      currentSessionId,
      context,
    ),
    ForbiddenException,
  );
  assert.equal(sessionCalls.length, 0);
  assert.deepEqual(auditEvents, [{
    actorId: "admin-one",
    action: "auth.session.revoked",
    targetType: "AdminSession",
    targetId: currentSessionId,
    result: "DENIED",
    reason: "The current session must use sign out.",
    ...context,
  }]);
});

test("missing or foreign sessions fail closed and are audited", async () => {
  const { auditEvents, service } = authHarness({ revokeResult: false });

  await assert.rejects(
    service.revokeSession(
      "admin-one",
      otherSessionId,
      currentSessionId,
      context,
    ),
    NotFoundException,
  );
  assert.equal(auditEvents[0]?.result, "DENIED");
  assert.equal(auditEvents[0]?.targetId, otherSessionId);
  assert.equal(
    auditEvents[0]?.reason,
    "The session was not found for the current administrator.",
  );
});

test("automatic account lock revokes every existing session and authentication flow", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const sessionCalls: string[] = [];
  const auditEvents: Array<Record<string, unknown>> = [];
  const prisma = {
    adminUser: {
      findUnique: async () => ({
        id: "admin-one",
        status: "ACTIVE",
        lockedUntil: null,
        passwordHash: "invalid-test-hash",
        totpEnabled: false,
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return {
          id: "admin-one",
          failedLoginCount: updates.length === 1 ? 4 : 0,
        };
      },
    },
  };
  const service = new AuthService(
    prisma as never,
    {} as never,
    {
      destroyUserAuthenticationState: async (userId: string) => {
        sessionCalls.push(userId);
        return { revokedSessionCount: 2, revokedChallengeCount: 1 };
      },
    } as never,
    {} as never,
    {
      record: async (event: Record<string, unknown>) => {
        auditEvents.push(event);
      },
    } as never,
  );

  await assert.rejects(
    service.loginWithPassword("admin-one@invalid.example", "wrong-password", context),
    UnauthorizedException,
  );
  assert.deepEqual(updates[0], { failedLoginCount: { increment: 1 } });
  assert.equal(updates[1]?.status, "LOCKED");
  assert.ok(updates[1]?.lockedUntil instanceof Date);
  assert.deepEqual(sessionCalls, ["admin-one"]);
  assert.equal(auditEvents[0]?.action, "auth.login.failed");
});

test("individual and bulk revocation record committed outcomes", async () => {
  const { auditEvents, service, sessionCalls } = authHarness({ revokedOtherCount: 3 });

  assert.deepEqual(
    await service.revokeSession(
      "admin-one",
      otherSessionId,
      currentSessionId,
      context,
    ),
    { revoked: true },
  );
  assert.deepEqual(
    await service.revokeOtherSessions("admin-one", currentSessionId, context),
    { revokedCount: 3 },
  );
  assert.deepEqual(sessionCalls, [
    { kind: "one", userId: "admin-one", sessionId: otherSessionId },
    { kind: "others", userId: "admin-one", sessionId: currentSessionId },
  ]);
  assert.deepEqual(
    auditEvents.map(({ action, result, afterData }) => ({ action, result, afterData })),
    [
      {
        action: "auth.session.revoked",
        result: "SUCCEEDED",
        afterData: undefined,
      },
      {
        action: "auth.sessions.others_revoked",
        result: "SUCCEEDED",
        afterData: { revokedCount: 3 },
      },
    ],
  );
});
