import assert from "node:assert/strict";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import { SessionService, type SessionRecord } from "../src/auth/session.service.js";

type StoredValue = {
  expiresAt: number;
  value: string;
};

class FakeRedis {
  readonly values = new Map<string, StoredValue>();
  scanCalls = 0;

  async set(key: string, value: string, mode: string, ttlSeconds: number): Promise<"OK"> {
    assert.equal(mode, "EX");
    this.values.set(key, {
      expiresAt: Date.now() + ttlSeconds * 1_000,
      value,
    });
    return "OK";
  }

  async get(key: string): Promise<string | null> {
    const value = this.activeValue(key);
    return value?.value ?? null;
  }

  async getdel(key: string): Promise<string | null> {
    const value = await this.get(key);
    this.values.delete(key);
    return value;
  }

  async mget(...keys: string[]): Promise<Array<string | null>> {
    return Promise.all(keys.map((key) => this.get(key)));
  }

  async ttl(key: string): Promise<number> {
    const ttlMs = await this.pttl(key);
    return ttlMs > 0 ? Math.ceil(ttlMs / 1_000) : ttlMs;
  }

  async pttl(key: string): Promise<number> {
    const value = this.activeValue(key);
    return value ? Math.max(1, value.expiresAt - Date.now()) : -2;
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.values.delete(key)) deleted += 1;
    }
    return deleted;
  }

  async scan(
    cursor: string,
    matchKeyword: string,
    pattern: string,
    countKeyword: string,
    count: number,
  ): Promise<[string, string[]]> {
    assert.equal(cursor, "0");
    assert.equal(matchKeyword, "MATCH");
    assert.ok(
      pattern === "admin-session:*" || pattern === "auth-flow:*",
      `Unexpected scan pattern ${pattern}`,
    );
    assert.equal(countKeyword, "COUNT");
    assert.equal(count, 100);
    this.scanCalls += 1;
    const prefix = pattern.slice(0, -1);
    return ["0", [...this.values.keys()].filter((key) => key.startsWith(prefix))];
  }

  keyForSession(sessionId: string): string {
    const entry = [...this.values.entries()].find(([, stored]) => {
      try {
        return (JSON.parse(stored.value) as Partial<SessionRecord>).sessionId === sessionId;
      } catch {
        return false;
      }
    });
    assert.ok(entry, `Missing fake Redis key for ${sessionId}`);
    return entry[0];
  }

  private activeValue(key: string): StoredValue | null {
    const value = this.values.get(key);
    if (!value) return null;
    if (value.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }
    return value;
  }
}

const sessionInput = (userId: string) => ({
  userId,
  email: `${userId}@invalid.example`,
  displayName: userId,
  permissions: ["orders.read"],
  reauthenticatedAt: null,
});

function sessionHarness() {
  const service = new SessionService(new ConfigService({
    REDIS_URL: "redis://127.0.0.1:6379",
    SESSION_SECRET: "session-test-secret-with-more-than-thirty-two-bytes",
  }));
  const redis = new FakeRedis();
  Object.defineProperty(service, "redis", { value: redis });
  return { redis, service };
}

test("session overview lists only the current account and safely supports legacy records", async () => {
  const { redis, service } = sessionHarness();
  const current = await service.create(sessionInput("admin-one"));
  const other = await service.create(sessionInput("admin-one"));
  await service.create(sessionInput("admin-two"));

  const legacyKey = redis.keyForSession(other.record.sessionId);
  const legacyStored = redis.values.get(legacyKey)!;
  const legacyRecord = JSON.parse(legacyStored.value) as Partial<SessionRecord>;
  delete legacyRecord.lastSeenAt;
  redis.values.set(legacyKey, {
    ...legacyStored,
    value: JSON.stringify(legacyRecord),
  });

  const overview = await service.userSessions("admin-one", current.record.sessionId);

  assert.equal(overview.source, "VALKEY");
  assert.equal(overview.sessions.length, 2);
  assert.equal(overview.sessions[0]?.id, current.record.sessionId);
  assert.equal(overview.sessions[0]?.current, true);
  assert.equal(overview.sessions[1]?.current, false);
  assert.equal(overview.sessions[1]?.lastSeenAt, overview.sessions[1]?.createdAt);
  assert.ok(overview.sessions.every((session) => Date.parse(session.expiresAt) > Date.now()));
  assert.deepEqual(
    Object.keys(overview.sessions[0] ?? {}).sort(),
    ["createdAt", "current", "expiresAt", "id", "lastSeenAt"],
  );
  assert.equal(redis.scanCalls, 1);
});

test("session revocation is scoped to one account and preserves the current session", async () => {
  const { service } = sessionHarness();
  const current = await service.create(sessionInput("admin-one"));
  const firstOther = await service.create(sessionInput("admin-one"));
  const secondOther = await service.create(sessionInput("admin-one"));
  const foreign = await service.create(sessionInput("admin-two"));

  assert.equal(
    await service.destroyUserSession("admin-one", foreign.record.sessionId),
    false,
  );
  assert.equal(await service.destroyUserSession("admin-one", "not-a-session"), false);
  assert.equal(
    await service.destroyUserSession("admin-one", firstOther.record.sessionId),
    true,
  );
  assert.equal(await service.get(firstOther.token), null);

  assert.equal(
    await service.destroyOtherUserSessions("admin-one", current.record.sessionId),
    1,
  );
  const remaining = await service.userSessions("admin-one", current.record.sessionId);
  assert.deepEqual(remaining.sessions.map(({ id }) => id), [current.record.sessionId]);
  assert.ok(await service.get(current.token));
  assert.ok(await service.get(foreign.token));
  assert.equal(await service.get(secondOther.token), null);
});

test("invalid stored session data fails closed and is removed", async () => {
  const { redis, service } = sessionHarness();
  const issued = await service.create(sessionInput("admin-one"));
  const key = redis.keyForSession(issued.record.sessionId);
  const stored = redis.values.get(key)!;
  redis.values.set(key, { ...stored, value: "{invalid-json" });

  assert.equal(await service.get(issued.token), null);
  assert.equal(redis.values.has(key), false);
});

test("account lifecycle revocation removes only the target user's sessions and challenges", async () => {
  const { service } = sessionHarness();
  const first = await service.create(sessionInput("admin-one"));
  const second = await service.create(sessionInput("admin-one"));
  const foreign = await service.create(sessionInput("admin-two"));
  const firstFlow = await service.createChallenge({
    kind: "totp-login",
    userId: "admin-one",
  });
  const secondFlow = await service.createChallenge({
    kind: "totp-enrollment",
    userId: "admin-one",
    encryptedSecret: "encrypted-test-secret",
  });
  const foreignFlow = await service.createChallenge({
    kind: "totp-login",
    userId: "admin-two",
  });

  const result = await service.destroyUserAuthenticationState("admin-one");

  assert.deepEqual(result, {
    revokedSessionCount: 2,
    revokedChallengeCount: 2,
  });
  assert.equal(await service.get(first.token), null);
  assert.equal(await service.get(second.token), null);
  assert.ok(await service.get(foreign.token));
  assert.equal(await service.getChallenge(firstFlow), null);
  assert.equal(await service.getChallenge(secondFlow), null);
  assert.deepEqual(await service.getChallenge(foreignFlow), {
    kind: "totp-login",
    userId: "admin-two",
  });
});
