import assert from "node:assert/strict";
import test from "node:test";
import {
  ForbiddenException,
  NotFoundException,
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
