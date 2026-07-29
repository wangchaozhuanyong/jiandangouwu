import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { SessionService } from "../src/auth/session.service.js";

const qaId = randomBytes(8).toString("hex");
const userId = `qa-session-user-${qaId}`;
const sessions = new SessionService(new ConfigService());
const tokens: string[] = [];
let connected = false;

try {
  await sessions.onModuleInit();
  connected = true;
  for (let index = 0; index < 3; index += 1) {
    const issued = await sessions.create({
      userId,
      email: `${userId}@invalid.example`,
      displayName: "QA session verifier",
      permissions: ["orders.read"],
      reauthenticatedAt: null,
    });
    tokens.push(issued.token);
  }

  const current = await sessions.get(tokens[0]!);
  assert.ok(current);
  const initial = await sessions.userSessions(userId, current.sessionId);
  assert.equal(initial.source, "VALKEY");
  assert.equal(initial.sessions.length, 3);
  assert.equal(initial.sessions[0]?.id, current.sessionId);
  assert.equal(initial.sessions[0]?.current, true);

  const singleTarget = initial.sessions.find((session) => !session.current);
  assert.ok(singleTarget);
  assert.equal(
    await sessions.destroyUserSession(userId, singleTarget.id),
    true,
  );
  const afterSingle = await sessions.userSessions(userId, current.sessionId);
  assert.equal(afterSingle.sessions.length, 2);

  assert.equal(
    await sessions.destroyOtherUserSessions(userId, current.sessionId),
    1,
  );
  const final = await sessions.userSessions(userId, current.sessionId);
  assert.deepEqual(final.sessions.map(({ id }) => id), [current.sessionId]);

  console.log(JSON.stringify({
    verified: true,
    source: final.source,
    initialSessionCount: initial.sessions.length,
    individuallyRevokedCount: 1,
    bulkRevokedCount: 1,
    currentSessionPreserved: true,
  }));
} finally {
  if (connected) {
    for (const token of tokens) await sessions.destroy(token);
    const remaining = await sessions.userSessions(userId, "");
    assert.equal(remaining.sessions.length, 0);
    console.log(JSON.stringify({
      cleanupVerified: true,
      remainingQaSessions: remaining.sessions.length,
    }));
    await sessions.onModuleDestroy();
  }
}
