import type {
  AdminStorefrontSettings,
  StorefrontSettings,
} from "@cloudbridge/contracts";
import { isConfiguredContactChannel } from "@cloudbridge/contracts";
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service.js";
import type { AdminActor } from "../common/admin-actor.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { UpdateStorefrontSettingsDto } from "./settings.dto.js";
import {
  DEFAULT_STOREFRONT_SETTINGS,
  parseStorefrontSettings,
  POLICY_VERSION_KEY,
  STOREFRONT_SETTINGS_KEY,
} from "./settings.model.js";

const toInputJson = (value: StorefrontSettings): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async publicSettings(): Promise<StorefrontSettings> {
    const [settings, policy, activeChannels] = await Promise.all([
      this.prisma.siteSetting.findUnique({ where: { key: STOREFRONT_SETTINGS_KEY } }),
      this.prisma.siteSetting.findUnique({ where: { key: POLICY_VERSION_KEY } }),
      this.prisma.merchantChannel.findMany({ where: { active: true } }),
    ]);
    const legacyPolicy = typeof policy?.value === "string"
      ? policy.value
      : DEFAULT_STOREFRONT_SETTINGS.policyVersion;
    const parsed = parseStorefrontSettings(settings?.value, legacyPolicy);
    const hasConfiguredChannel = activeChannels.some(isConfiguredContactChannel);
    const supportEnabled = parsed.supportEnabled && hasConfiguredChannel;
    return {
      ...parsed,
      supportEnabled,
      acceptOrders: parsed.acceptOrders && supportEnabled,
    };
  }

  async adminSettings(): Promise<AdminStorefrontSettings> {
    const [row, policy, activeChannels] = await Promise.all([
      this.prisma.siteSetting.findUnique({ where: { key: STOREFRONT_SETTINGS_KEY } }),
      this.prisma.siteSetting.findUnique({ where: { key: POLICY_VERSION_KEY } }),
      this.prisma.merchantChannel.findMany({ where: { active: true } }),
    ]);
    const legacyPolicy = typeof policy?.value === "string"
      ? policy.value
      : DEFAULT_STOREFRONT_SETTINGS.policyVersion;
    const settings = parseStorefrontSettings(row?.value, legacyPolicy);
    return {
      ...settings,
      version: row?.version ?? 0,
      updatedAt: (row?.updatedAt ?? new Date(0)).toISOString(),
      orderReadiness: {
        activeContactChannels: activeChannels.length,
        configuredActiveContactChannels: activeChannels.filter(isConfiguredContactChannel).length,
      },
    };
  }

  async update(
    input: UpdateStorefrontSettingsDto,
    actor: AdminActor,
  ): Promise<AdminStorefrontSettings> {
    const transitServiceUrl = input.transitServiceUrl?.trim() || null;
    const parsedTransitServiceUrl = parseStorefrontSettings({
      transitServiceUrl,
    }).transitServiceUrl;
    if (transitServiceUrl && !parsedTransitServiceUrl) {
      throw new BadRequestException("Transit service URL must be a safe HTTPS URL without embedded credentials.");
    }
    const next = parseStorefrontSettings({
      siteName: input.siteName,
      defaultLocale: input.defaultLocale,
      seoDescription: input.seoDescription,
      policyVersion: input.policyVersion,
      acceptOrders: input.acceptOrders,
      supportEnabled: input.supportEnabled,
      transitServiceEnabled: input.transitServiceEnabled,
      transitServiceUrl: parsedTransitServiceUrl,
    });

    try {
      const saved = await this.prisma.$transaction(async (transaction) => {
        const [current, policy] = await Promise.all([
          transaction.siteSetting.findUnique({ where: { key: STOREFRONT_SETTINGS_KEY } }),
          transaction.siteSetting.findUnique({ where: { key: POLICY_VERSION_KEY } }),
        ]);
        const activeChannels = await transaction.merchantChannel.findMany({
          where: { active: true },
        });
        const configuredActiveChannels = activeChannels.filter(isConfiguredContactChannel);
        if (next.acceptOrders && !next.supportEnabled) {
          throw new BadRequestException({
            code: "ORDER_SUPPORT_REQUIRED",
            message: "Support access must be enabled before new orders can be accepted.",
          });
        }
        if (
          (next.acceptOrders || next.supportEnabled)
          && configuredActiveChannels.length === 0
        ) {
          throw new BadRequestException({
            code: "CONTACT_CHANNEL_REQUIRED",
            message: "At least one configured active contact channel is required before support or ordering can be enabled.",
          });
        }
        const legacyPolicy = typeof policy?.value === "string"
          ? policy.value
          : DEFAULT_STOREFRONT_SETTINGS.policyVersion;
        const before = parseStorefrontSettings(current?.value, legacyPolicy);
        if (!current) {
          if (input.version !== 0) {
            throw new ConflictException("Site settings changed. Reload before saving.");
          }
          await transaction.siteSetting.create({
            data: {
              key: STOREFRONT_SETTINGS_KEY,
              value: toInputJson(next),
            },
          });
        } else {
          const result = await transaction.siteSetting.updateMany({
            where: {
              key: STOREFRONT_SETTINGS_KEY,
              version: input.version,
            },
            data: {
              value: toInputJson(next),
              version: { increment: 1 },
            },
          });
          if (result.count !== 1) {
            throw new ConflictException("Site settings changed. Reload before saving.");
          }
        }
        await transaction.siteSetting.upsert({
          where: { key: POLICY_VERSION_KEY },
          update: {
            value: input.policyVersion,
            version: { increment: 1 },
          },
          create: {
            key: POLICY_VERSION_KEY,
            value: input.policyVersion,
          },
        });
        const committed = await transaction.siteSetting.findUniqueOrThrow({
          where: { key: STOREFRONT_SETTINGS_KEY },
        });
        await this.audit.record({
          actorId: actor.userId,
          action: "site_setting.update",
          targetType: "SiteSetting",
          targetId: STOREFRONT_SETTINGS_KEY,
          result: "SUCCEEDED",
          requestId: actor.requestId,
          reason: input.reason,
          beforeData: before,
          afterData: next,
          ip: actor.ip,
        }, transaction);
        return {
          committed,
          orderReadiness: {
            activeContactChannels: activeChannels.length,
            configuredActiveContactChannels: configuredActiveChannels.length,
          },
        };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      return {
        ...next,
        version: saved.committed.version,
        updatedAt: saved.committed.updatedAt.toISOString(),
        orderReadiness: saved.orderReadiness,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Site settings changed. Reload before saving.");
      }
      throw error;
    }
  }
}
