import {
  isApprovedContactChannelTarget,
  isConfiguredContactChannel,
  type AdminContactChannel,
  type ContactChannelMode,
  type ContactChannelType,
} from "@cloudbridge/contracts";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service.js";
import type { AdminActor } from "../common/admin-actor.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  DEFAULT_STOREFRONT_SETTINGS,
  parseStorefrontSettings,
  STOREFRONT_SETTINGS_KEY,
} from "../settings/settings.model.js";
import type {
  ReorderContactChannelsDto,
  UpdateContactChannelDto,
} from "./support.dto.js";

type ChannelRecord = {
  id: string;
  type: ContactChannelType;
  mode: ContactChannelMode;
  labelZh: string;
  labelEn: string;
  publicAccount: string;
  directTarget: string | null;
  serviceHoursZh: string;
  serviceHoursEn: string;
  active: boolean;
  sortOrder: number;
  version: number;
  updatedAt: Date;
};

const mapChannel = (channel: ChannelRecord): AdminContactChannel => ({
  id: channel.id,
  type: channel.type,
  mode: channel.mode,
  label: {
    zh: channel.labelZh,
    en: channel.labelEn,
  },
  publicAccount: channel.publicAccount,
  directTarget: channel.directTarget,
  serviceHours: {
    zh: channel.serviceHoursZh,
    en: channel.serviceHoursEn,
  },
  active: channel.active,
  sortOrder: channel.sortOrder,
  version: channel.version,
  updatedAt: channel.updatedAt.toISOString(),
});

export function validateContactChannelTarget(
  type: ContactChannelType,
  mode: ContactChannelMode,
  directTarget: string | null,
): void {
  if (!isApprovedContactChannelTarget(type, mode, directTarget)) {
    throw new BadRequestException("The contact channel target does not match its channel mode.");
  }
}

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async channels(): Promise<AdminContactChannel[]> {
    const channels = await this.prisma.merchantChannel.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return channels.map(mapChannel);
  }

  async updateChannel(
    id: string,
    input: UpdateContactChannelDto,
    actor: AdminActor,
  ): Promise<AdminContactChannel> {
    const updated = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.merchantChannel.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("Contact channel not found.");
      const directTarget = input.directTarget?.trim() || null;
      validateContactChannelTarget(current.type, current.mode, directTarget);
      if (input.active && !isConfiguredContactChannel({
        type: current.type,
        mode: current.mode,
        publicAccount: input.publicAccount,
        directTarget,
      })) {
        throw new BadRequestException({
          code: "CONTACT_CHANNEL_NOT_CONFIGURED",
          message: "A real public account and approved channel target are required before activation.",
        });
      }
      if (current.active && !input.active) {
        const [otherActiveChannels, settingsRow] = await Promise.all([
          transaction.merchantChannel.findMany({
            where: {
              active: true,
              id: { not: id },
            },
          }),
          transaction.siteSetting.findUnique({ where: { key: STOREFRONT_SETTINGS_KEY } }),
        ]);
        const settings = parseStorefrontSettings(
          settingsRow?.value,
          DEFAULT_STOREFRONT_SETTINGS.policyVersion,
        );
        const otherConfiguredChannels = otherActiveChannels.filter(isConfiguredContactChannel);
        if (
          otherConfiguredChannels.length === 0
          && (settings.acceptOrders || settings.supportEnabled)
        ) {
          throw new ConflictException({
            code: "CONTACT_CHANNEL_REQUIRED",
            message: "Disable new orders and support access before removing the final configured contact channel.",
          });
        }
      }

      const result = await transaction.merchantChannel.updateMany({
        where: { id, version: input.version },
        data: {
          labelZh: input.label.zh.trim(),
          labelEn: input.label.en.trim(),
          publicAccount: input.publicAccount.trim(),
          directTarget,
          serviceHoursZh: input.serviceHours.zh.trim(),
          serviceHoursEn: input.serviceHours.en.trim(),
          active: input.active,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw new ConflictException("Contact channel changed. Reload before saving.");
      }
      const saved = await transaction.merchantChannel.findUniqueOrThrow({ where: { id } });
      await this.audit.record({
        actorId: actor.userId,
        action: "merchant_channel.update",
        targetType: "MerchantChannel",
        targetId: id,
        result: "SUCCEEDED",
        requestId: actor.requestId,
        beforeData: mapChannel(current),
        afterData: mapChannel(saved),
        ip: actor.ip,
      }, transaction);
      return saved;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    return mapChannel(updated);
  }

  async reorderChannels(
    input: ReorderContactChannelsDto,
    actor: AdminActor,
  ): Promise<AdminContactChannel[]> {
    const updated = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.merchantChannel.findMany({
        select: { id: true, version: true, sortOrder: true },
      });
      const itemIds = input.items.map((item) => item.id);
      if (
        itemIds.length !== current.length
        || new Set(itemIds).size !== itemIds.length
        || current.some((channel) => !itemIds.includes(channel.id))
      ) {
        throw new BadRequestException("The complete unique contact channel order is required.");
      }
      for (const [index, item] of input.items.entries()) {
        const result = await transaction.merchantChannel.updateMany({
          where: { id: item.id, version: item.version },
          data: {
            sortOrder: index + 1,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw new ConflictException("Contact channel order changed. Reload before saving.");
        }
      }
      const saved = await transaction.merchantChannel.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      await this.audit.record({
        actorId: actor.userId,
        action: "merchant_channel.order.update",
        targetType: "MerchantChannel",
        result: "SUCCEEDED",
        requestId: actor.requestId,
        beforeData: current,
        afterData: saved.map((item) => ({
          id: item.id,
          sortOrder: item.sortOrder,
          version: item.version,
        })),
        ip: actor.ip,
      }, transaction);
      return saved;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    return updated.map(mapChannel);
  }
}
