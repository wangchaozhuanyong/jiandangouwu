import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { generateSecret, generateURI, verify as verifyOtp } from "otplib";
import { AuditService } from "../audit/audit.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { SecretProtectionService } from "../security/secret-protection.service.js";
import type { FirstAdminSetupDto } from "./auth.dto.js";
import { SessionService } from "./session.service.js";

type AuditContext = {
  requestId: string;
  ip?: string;
};

const passwordKeyLength = 64;
const passwordCost = 16_384;
const passwordBlockSize = 8;
const passwordParallelism = 1;
const passwordMaxMemory = 64 * 1024 * 1024;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sessions: SessionService,
    private readonly secrets: SecretProtectionService,
    private readonly audit: AuditService,
  ) {}

  async setupStatus(context: AuditContext) {
    return {
      available: this.localSetupAllowed(context)
        && await this.prisma.adminUser.count({ where: { status: "ACTIVE" } }) === 0,
    };
  }

  async setupFirstAdmin(input: FirstAdminSetupDto, context: AuditContext) {
    if (!this.localSetupAllowed(context)) {
      throw new ForbiddenException("First-admin setup is available only from this local development machine.");
    }
    if (await this.prisma.adminUser.count({ where: { status: "ACTIVE" } }) > 0) {
      throw new ConflictException("First-admin setup is no longer available.");
    }

    const role = await this.prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
    const passwordHash = await this.hashPassword(input.password);
    const user = await this.prisma.$transaction(async (transaction) => {
      if (await transaction.adminUser.count({ where: { status: "ACTIVE" } }) > 0) {
        throw new ConflictException("First-admin setup is no longer available.");
      }
      const saved = await transaction.adminUser.upsert({
        where: { email: input.email },
        update: {
          displayName: input.displayName,
          passwordHash,
          status: "ACTIVE",
          failedLoginCount: 0,
          lockedUntil: null,
        },
        create: {
          email: input.email,
          displayName: input.displayName,
          passwordHash,
          status: "ACTIVE",
        },
      });
      await transaction.adminUserRole.upsert({
        where: { adminUserId_roleId: { adminUserId: saved.id, roleId: role.id } },
        update: {},
        create: { adminUserId: saved.id, roleId: role.id },
      });
      await transaction.siteSetting.upsert({
        where: { key: "auth.passwordSetupCompleted" },
        update: { value: true, version: { increment: 1 } },
        create: { key: "auth.passwordSetupCompleted", value: true },
      });
      return saved;
    });

    await this.audit.record({
      actorId: user.id,
      action: "auth.setup.complete",
      targetType: "AdminUser",
      targetId: user.id,
      result: "SUCCEEDED",
      ...context,
    });
    await this.successfulLogin(user.id, "auth.login.password", context);
    return this.issueSession(user.id);
  }

  async loginWithPassword(email: string, password: string, context: AuditContext) {
    const user = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!user || !(await this.unlockIfExpired(user)) || !user.passwordHash) {
      await this.derivePassword(password, Buffer.alloc(16));
      await this.audit.record({
        action: "auth.login.failed",
        targetType: "AdminUser",
        result: "DENIED",
        reason: "Unknown or unavailable account",
        ...context,
      });
      throw new UnauthorizedException("Email or password is incorrect.");
    }

    if (!(await this.verifyPassword(password, user.passwordHash))) {
      await this.failedLogin(user.id, context, "Password verification failed");
      throw new UnauthorizedException("Email or password is incorrect.");
    }

    if (user.totpEnabled) {
      if (!user.totpSecretEncrypted) {
        throw new UnauthorizedException("Two-factor authentication is unavailable for this account.");
      }
      const flowId = await this.sessions.createChallenge({
        kind: "totp-login",
        userId: user.id,
      });
      return { requiresTotp: true as const, flowId };
    }

    await this.successfulLogin(user.id, "auth.login.password", context);
    return { requiresTotp: false as const, issued: await this.issueSession(user.id) };
  }

  async loginWithTotp(flowId: string, token: string, context: AuditContext) {
    const flow = await this.sessions.getChallenge(flowId);
    if (!flow || flow.kind !== "totp-login") {
      throw new UnauthorizedException("Two-factor login has expired.");
    }
    const user = await this.prisma.adminUser.findUnique({ where: { id: flow.userId } });
    if (
      !user
      || !(await this.unlockIfExpired(user))
      || !user.totpEnabled
      || !user.totpSecretEncrypted
    ) {
      throw new UnauthorizedException("Two-factor authentication is unavailable.");
    }
    const result = await verifyOtp({
      secret: this.secrets.decrypt(user.totpSecretEncrypted),
      token,
      epochTolerance: 30,
    });
    if (!result.valid) {
      await this.failedLogin(user.id, context, "TOTP verification failed");
      throw new UnauthorizedException("The authentication code is invalid.");
    }
    await this.sessions.consumeChallenge(flowId);
    await this.successfulLogin(user.id, "auth.login.totp", context);
    return this.issueSession(user.id);
  }

  async beginTotpEnrollment(userId: string) {
    const user = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: userId } });
    if (user.totpEnabled) throw new ConflictException("Two-factor authentication is already enabled.");
    const secret = generateSecret({ length: 20 });
    const uri = generateURI({
      issuer: "CloudBridge Admin",
      label: user.email,
      secret,
    });
    const flowId = await this.sessions.createChallenge({
      kind: "totp-enrollment",
      userId,
      encryptedSecret: this.secrets.encrypt(secret),
    });
    return { flowId, secret, uri };
  }

  async verifyTotpEnrollment(userId: string, flowId: string, token: string, context: AuditContext) {
    const flow = await this.sessions.getChallenge(flowId);
    if (!flow || flow.kind !== "totp-enrollment" || flow.userId !== userId || !flow.encryptedSecret) {
      throw new UnauthorizedException("Two-factor setup has expired.");
    }
    const secret = this.secrets.decrypt(flow.encryptedSecret);
    const result = await verifyOtp({ secret, token, epochTolerance: 30 });
    if (!result.valid) throw new UnauthorizedException("The authentication code is invalid.");
    await this.sessions.consumeChallenge(flowId);
    await this.prisma.adminUser.update({
      where: { id: userId },
      data: {
        totpSecretEncrypted: this.secrets.encrypt(secret),
        totpEnabled: true,
      },
    });
    await this.audit.record({
      actorId: userId,
      action: "auth.totp.enabled",
      targetType: "AdminUser",
      targetId: userId,
      result: "SUCCEEDED",
      ...context,
    });
    return { enabled: true };
  }

  async disableTotp(userId: string, password: string, context: AuditContext) {
    const user = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await this.verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException("Password is incorrect.");
    }
    await this.prisma.adminUser.update({
      where: { id: userId },
      data: {
        totpEnabled: false,
        totpSecretEncrypted: null,
      },
    });
    await this.audit.record({
      actorId: userId,
      action: "auth.totp.disabled",
      targetType: "AdminUser",
      targetId: userId,
      result: "SUCCEEDED",
      ...context,
    });
    return { enabled: false };
  }

  async sessionProfile(userId: string) {
    const user = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    const permissions = [...new Set(user.roles.flatMap(({ role }) =>
      role.permissions.map(({ permission }) => permission.key)))].sort();
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles.map(({ role }) => ({
        key: role.key,
        name: { zh: role.nameZh, en: role.nameEn },
      })),
      permissions,
      totpEnabled: user.totpEnabled,
    };
  }

  private async issueSession(userId: string) {
    const user = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    const permissions = [...new Set(user.roles.flatMap(({ role }) =>
      role.permissions.map(({ permission }) => permission.key)))];
    return this.sessions.create({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      permissions,
      reauthenticatedAt: Date.now(),
    });
  }

  private async successfulLogin(userId: string, action: string, context: AuditContext): Promise<void> {
    await this.prisma.adminUser.update({
      where: { id: userId },
      data: {
        status: "ACTIVE",
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });
    await this.audit.record({
      actorId: userId,
      action,
      targetType: "AdminUser",
      targetId: userId,
      result: "SUCCEEDED",
      ...context,
    });
  }

  private async failedLogin(userId: string, context: AuditContext, reason: string): Promise<void> {
    const user = await this.prisma.adminUser.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
    });
    if (user.failedLoginCount >= 4) {
      await this.prisma.adminUser.update({
        where: { id: userId },
        data: {
          status: "LOCKED",
          lockedUntil: new Date(Date.now() + 15 * 60_000),
        },
      });
    }
    await this.audit.record({
      actorId: userId,
      action: "auth.login.failed",
      targetType: "AdminUser",
      targetId: userId,
      result: "FAILED",
      reason,
      ...context,
    });
  }

  private async unlockIfExpired(user: {
    id: string;
    status: string;
    lockedUntil: Date | null;
  }): Promise<boolean> {
    if (user.status === "ACTIVE") return true;
    if (user.status !== "LOCKED" || !user.lockedUntil || user.lockedUntil > new Date()) return false;
    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: { status: "ACTIVE", failedLoginCount: 0, lockedUntil: null },
    });
    return true;
  }

  private localSetupAllowed(context: AuditContext): boolean {
    if (this.config.get<string>("NODE_ENV") === "production") return false;
    const ip = context.ip ?? "";
    return ip === "127.0.0.1"
      || ip === "::1"
      || ip === "::ffff:127.0.0.1";
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await this.derivePassword(password, salt);
    return [
      "scrypt",
      "v1",
      passwordCost,
      passwordBlockSize,
      passwordParallelism,
      salt.toString("base64url"),
      derived.toString("base64url"),
    ].join("$");
  }

  private async verifyPassword(password: string, encoded: string): Promise<boolean> {
    const [algorithm, version, cost, blockSize, parallelism, saltValue, expectedValue] = encoded.split("$");
    if (
      algorithm !== "scrypt"
      || version !== "v1"
      || Number(cost) !== passwordCost
      || Number(blockSize) !== passwordBlockSize
      || Number(parallelism) !== passwordParallelism
      || !saltValue
      || !expectedValue
    ) {
      return false;
    }
    const expected = Buffer.from(expectedValue, "base64url");
    if (expected.byteLength !== passwordKeyLength) return false;
    const actual = await this.derivePassword(password, Buffer.from(saltValue, "base64url"));
    return timingSafeEqual(actual, expected);
  }

  private derivePassword(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(password, salt, passwordKeyLength, {
        N: passwordCost,
        r: passwordBlockSize,
        p: passwordParallelism,
        maxmem: passwordMaxMemory,
      }, (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      });
    });
  }
}
