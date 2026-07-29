import type {
  AdminContactChannel,
  ContactChannelMode,
  ContactChannelType,
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
  const target = directTarget?.trim() || null;
  const valid = (() => {
    if (type === "WHATSAPP") {
      return mode === "DIRECT_LINK"
        && Boolean(target && /^https:\/\/wa\.me\/[1-9]\d{5,15}(?:\?.*)?$/u.test(target));
    }
    if (type === "EMAIL") {
      return mode === "DIRECT_LINK"
        && Boolean(target && /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(target));
    }
    if (type === "TELEGRAM") {
      return mode === "DIRECT_LINK"
        && Boolean(target && /^https:\/\/t\.me\/[A-Za-z0-9_]{5,}$/u.test(target));
    }
    if (type === "WECHAT") {
      return mode === "QR_COPY" && target === null;
    }
    return mode === "DIRECT_WITH_FALLBACK"
      && Boolean(target && /^mqqwpa:\/\/im\/chat\?chat_type=wpa&uin=\d{5,15}$/u.test(target));
  })();
  if (!valid) {
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
      if (current.active && !input.active) {
        const otherActiveChannels = await transaction.merchantChannel.count({
          where: {
            active: true,
            id: { not: id },
          },
        });
        if (otherActiveChannels === 0) {
          throw new ConflictException("At least one contact channel must remain active.");
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
