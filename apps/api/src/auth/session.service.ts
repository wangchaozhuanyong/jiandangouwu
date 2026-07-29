import type {
  AdminSessionOverview,
  AdminSessionSummary,
} from "@cloudbridge/contracts";
import { Injectable, InternalServerErrorException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes } from "node:crypto";
import { Redis } from "ioredis";

export type SessionRecord = {
  sessionId: string;
  userId: string;
  email: string;
  displayName: string;
  permissions: string[];
  csrfToken: string;
  reauthenticatedAt: number | null;
  createdAt: number;
  lastSeenAt: number;
};

type ChallengeRecord = {
  kind: "totp-login" | "totp-enrollment";
  userId: string;
  encryptedSecret?: string;
};

@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly sessionTtlSeconds = 8 * 60 * 60;
  private readonly challengeTtlSeconds = 5 * 60;

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>("REDIS_URL");
    this.redis = redisUrl
      ? new Redis(redisUrl, {
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        })
      : new Redis({
          host: this.config.getOrThrow<string>("REDIS_HOST"),
          port: Number(this.config.get<string>("REDIS_PORT") ?? "6379"),
          password: this.config.get<string>("REDIS_PASSWORD"),
          ...(this.config.get<string>("REDIS_TLS") === "true" ? { tls: {} } : {}),
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        });
  }

  async onModuleInit(): Promise<void> {
    await this.redis.connect();
    await this.assertAvailable();
  }

  async assertAvailable(): Promise<void> {
    const pong = await this.redis.ping();
    if (pong !== "PONG") throw new InternalServerErrorException("Session store is unavailable.");
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async create(input: Omit<
    SessionRecord,
    "sessionId" | "csrfToken" | "createdAt" | "lastSeenAt"
  >): Promise<{
    token: string;
    record: SessionRecord;
  }> {
    const token = randomBytes(32).toString("base64url");
    const record: SessionRecord = {
      ...input,
      sessionId: randomBytes(16).toString("hex"),
      csrfToken: randomBytes(24).toString("base64url"),
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    };
    await this.redis.set(this.sessionKey(token), JSON.stringify(record), "EX", this.sessionTtlSeconds);
    return { token, record };
  }

  async get(token: string): Promise<SessionRecord | null> {
    if (!/^[A-Za-z0-9_-]{40,80}$/u.test(token)) return null;
    const key = this.sessionKey(token);
    const serialized = await this.redis.get(key);
    if (!serialized) return null;
    const record = this.parseSession(serialized);
    if (!record) {
      await this.redis.del(key);
      return null;
    }
    const refreshed = { ...record, lastSeenAt: Date.now() };
    await this.redis.set(key, JSON.stringify(refreshed), "EX", this.sessionTtlSeconds);
    return refreshed;
  }

  async destroy(token: string): Promise<void> {
    if (/^[A-Za-z0-9_-]{40,80}$/u.test(token)) await this.redis.del(this.sessionKey(token));
  }

  async synchronizePermissions(token: string, permissions: string[]): Promise<void> {
    if (!/^[A-Za-z0-9_-]{40,80}$/u.test(token)) return;
    const key = this.sessionKey(token);
    const serialized = await this.redis.get(key);
    if (!serialized) return;
    const ttl = await this.redis.ttl(key);
    if (ttl <= 0) return;
    const record = this.parseSession(serialized);
    if (!record) {
      await this.redis.del(key);
      return;
    }
    await this.redis.set(key, JSON.stringify({
      ...record,
      permissions: [...new Set(permissions)].sort(),
    }), "EX", ttl);
  }

  async userSessions(userId: string, currentSessionId: string): Promise<AdminSessionOverview> {
    const entries = await this.findUserSessionEntries(userId);
    const sessions = entries.map(({ record, ttlMs }): AdminSessionSummary => ({
      id: record.sessionId,
      current: record.sessionId === currentSessionId,
      createdAt: new Date(record.createdAt).toISOString(),
      lastSeenAt: new Date(record.lastSeenAt).toISOString(),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    })).sort((left, right) => (
      Number(right.current) - Number(left.current)
      || Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt)
      || left.id.localeCompare(right.id)
    ));
    return { source: "VALKEY", sessions };
  }

  async destroyUserSession(userId: string, sessionId: string): Promise<boolean> {
    if (!/^[a-f0-9]{32}$/u.test(sessionId)) return false;
    const entry = (await this.findUserSessionEntries(userId))
      .find(({ record }) => record.sessionId === sessionId);
    if (!entry) return false;
    return await this.redis.del(entry.key) === 1;
  }

  async destroyOtherUserSessions(userId: string, currentSessionId: string): Promise<number> {
    const keys = (await this.findUserSessionEntries(userId))
      .filter(({ record }) => record.sessionId !== currentSessionId)
      .map(({ key }) => key);
    if (keys.length === 0) return 0;
    return this.redis.del(...keys);
  }

  async destroyUserAuthenticationState(userId: string): Promise<{
    revokedSessionCount: number;
    revokedChallengeCount: number;
  }> {
    const [sessionEntries, challengeKeys] = await Promise.all([
      this.findUserSessionEntries(userId),
      this.findUserChallengeKeys(userId),
    ]);
    const [revokedSessionCount, revokedChallengeCount] = await Promise.all([
      sessionEntries.length > 0
        ? this.redis.del(...sessionEntries.map(({ key }) => key))
        : 0,
      challengeKeys.length > 0 ? this.redis.del(...challengeKeys) : 0,
    ]);
    return { revokedSessionCount, revokedChallengeCount };
  }

  async createChallenge(record: ChallengeRecord): Promise<string> {
    const flowId = randomBytes(24).toString("base64url");
    await this.redis.set(`auth-flow:${flowId}`, JSON.stringify(record), "EX", this.challengeTtlSeconds);
    return flowId;
  }

  async getChallenge(flowId: string): Promise<ChallengeRecord | null> {
    const key = `auth-flow:${flowId}`;
    const serialized = await this.redis.get(key);
    if (!serialized) return null;
    const record = this.parseChallenge(serialized);
    if (!record) await this.redis.del(key);
    return record;
  }

  async consumeChallenge(flowId: string): Promise<ChallengeRecord | null> {
    const key = `auth-flow:${flowId}`;
    const serialized = await this.redis.getdel(key);
    return serialized ? this.parseChallenge(serialized) : null;
  }

  private async findUserSessionEntries(userId: string): Promise<Array<{
    key: string;
    record: SessionRecord;
    ttlMs: number;
  }>> {
    const entries: Array<{ key: string; record: SessionRecord; ttlMs: number }> = [];
    const keys = await this.scanKeys("admin-session:*");
    if (keys.length === 0) return entries;
    const [values, ttls] = await Promise.all([
      this.redis.mget(...keys),
      Promise.all(keys.map((key) => this.redis.pttl(key))),
    ]);
    for (const [index, serialized] of values.entries()) {
      const key = keys[index]!;
      if (!serialized || (ttls[index] ?? -1) <= 0) continue;
      const record = this.parseSession(serialized);
      if (!record) {
        await this.redis.del(key);
        continue;
      }
      if (record.userId !== userId) continue;
      entries.push({
        key,
        record,
        ttlMs: ttls[index]!,
      });
    }
    return entries;
  }

  private async findUserChallengeKeys(userId: string): Promise<string[]> {
    const keys = await this.scanKeys("auth-flow:*");
    if (keys.length === 0) return [];
    const values = await this.redis.mget(...keys);
    const matches: string[] = [];
    for (const [index, serialized] of values.entries()) {
      const key = keys[index]!;
      if (!serialized) continue;
      const record = this.parseChallenge(serialized);
      if (!record) {
        await this.redis.del(key);
        continue;
      }
      if (record.userId === userId) matches.push(key);
    }
    return matches;
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const matches: string[] = [];
    const seenCursors = new Set<string>();
    const seenKeys = new Set<string>();
    let cursor = "0";
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      if (nextCursor !== "0" && seenCursors.has(nextCursor)) {
        throw new InternalServerErrorException("Session store scan did not advance.");
      }
      seenCursors.add(nextCursor);
      cursor = nextCursor;
      for (const key of keys) {
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        matches.push(key);
      }
    } while (cursor !== "0");
    return matches;
  }

  private parseSession(serialized: string): SessionRecord | null {
    try {
      const candidate = JSON.parse(serialized) as Partial<SessionRecord>;
      if (
        !candidate
        || typeof candidate.userId !== "string"
        || typeof candidate.email !== "string"
        || typeof candidate.displayName !== "string"
        || !Array.isArray(candidate.permissions)
        || candidate.permissions.some((permission) => typeof permission !== "string")
        || typeof candidate.sessionId !== "string"
        || !/^[a-f0-9]{32}$/u.test(candidate.sessionId)
        || typeof candidate.csrfToken !== "string"
        || typeof candidate.createdAt !== "number"
        || !Number.isFinite(candidate.createdAt)
      ) {
        return null;
      }
      return {
        ...candidate,
        permissions: [...new Set(candidate.permissions)].sort(),
        reauthenticatedAt: typeof candidate.reauthenticatedAt === "number"
          ? candidate.reauthenticatedAt
          : null,
        lastSeenAt: typeof candidate.lastSeenAt === "number" && Number.isFinite(candidate.lastSeenAt)
          ? candidate.lastSeenAt
          : candidate.createdAt,
      } as SessionRecord;
    } catch {
      return null;
    }
  }

  private parseChallenge(serialized: string): ChallengeRecord | null {
    try {
      const candidate = JSON.parse(serialized) as Partial<ChallengeRecord>;
      if (
        !candidate
        || (candidate.kind !== "totp-login" && candidate.kind !== "totp-enrollment")
        || typeof candidate.userId !== "string"
        || candidate.userId.length === 0
        || (
          candidate.encryptedSecret !== undefined
          && typeof candidate.encryptedSecret !== "string"
        )
      ) {
        return null;
      }
      return {
        kind: candidate.kind,
        userId: candidate.userId,
        ...(candidate.encryptedSecret
          ? { encryptedSecret: candidate.encryptedSecret }
          : {}),
      };
    } catch {
      return null;
    }
  }

  private sessionKey(token: string): string {
    const secret = this.config.get<string>("SESSION_SECRET") ?? "";
    if (Buffer.byteLength(secret) < 32) {
      throw new InternalServerErrorException("SESSION_SECRET must contain at least 32 bytes.");
    }
    return `admin-session:${createHmac("sha256", secret).update(token).digest("hex")}`;
  }
}
