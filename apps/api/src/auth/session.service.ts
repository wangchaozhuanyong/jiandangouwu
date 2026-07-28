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
    const pong = await this.redis.ping();
    if (pong !== "PONG") throw new InternalServerErrorException("Session store is unavailable.");
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async create(input: Omit<SessionRecord, "sessionId" | "csrfToken" | "createdAt">): Promise<{
    token: string;
    record: SessionRecord;
  }> {
    const token = randomBytes(32).toString("base64url");
    const record: SessionRecord = {
      ...input,
      sessionId: randomBytes(16).toString("hex"),
      csrfToken: randomBytes(24).toString("base64url"),
      createdAt: Date.now(),
    };
    await this.redis.set(this.sessionKey(token), JSON.stringify(record), "EX", this.sessionTtlSeconds);
    return { token, record };
  }

  async get(token: string): Promise<SessionRecord | null> {
    if (!/^[A-Za-z0-9_-]{40,80}$/u.test(token)) return null;
    const key = this.sessionKey(token);
    const serialized = await this.redis.get(key);
    if (!serialized) return null;
    await this.redis.expire(key, this.sessionTtlSeconds);
    return JSON.parse(serialized) as SessionRecord;
  }

  async destroy(token: string): Promise<void> {
    if (/^[A-Za-z0-9_-]{40,80}$/u.test(token)) await this.redis.del(this.sessionKey(token));
  }

  async createChallenge(record: ChallengeRecord): Promise<string> {
    const flowId = randomBytes(24).toString("base64url");
    await this.redis.set(`auth-flow:${flowId}`, JSON.stringify(record), "EX", this.challengeTtlSeconds);
    return flowId;
  }

  async getChallenge(flowId: string): Promise<ChallengeRecord | null> {
    const serialized = await this.redis.get(`auth-flow:${flowId}`);
    return serialized ? JSON.parse(serialized) as ChallengeRecord : null;
  }

  async consumeChallenge(flowId: string): Promise<ChallengeRecord | null> {
    const key = `auth-flow:${flowId}`;
    const serialized = await this.redis.getdel(key);
    return serialized ? JSON.parse(serialized) as ChallengeRecord : null;
  }

  private sessionKey(token: string): string {
    const secret = this.config.get<string>("SESSION_SECRET") ?? "";
    if (Buffer.byteLength(secret) < 32) {
      throw new InternalServerErrorException("SESSION_SECRET must contain at least 32 bytes.");
    }
    return `admin-session:${createHmac("sha256", secret).update(token).digest("hex")}`;
  }
}
