import type {
  AdminTelegramNewOrderSettings,
  TelegramNewOrderFieldCode,
  TelegramNewOrderSimulation,
} from "@cloudbridge/contracts";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service.js";
import type { AdminActor } from "../common/admin-actor.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type {
  UpdateAdminTelegramNewOrderSettingsDto,
} from "./telegram-new-order-settings.dto.js";
import {
  parseStoredTelegramNewOrderSettings,
  TELEGRAM_NEW_ORDER_SETTINGS_KEY,
  toAdminTelegramNewOrderSettings,
} from "./telegram-new-order-settings.model.js";

const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const simulationValues: Readonly<Record<TelegramNewOrderFieldCode, string>> = {
  ORDER_NUMBER: "CB-DEMO-000001",
  PRODUCT: "CloudBridge Demo Service",
  AMOUNT: "119.00",
  CURRENCY: "CNY",
  STATUS: "MANUAL_PENDING",
  CREATED_AT: "2026-01-01T00:00:00.000Z",
  CONTACT_CHANNEL: "EMAIL",
  MASKED_CONTACT: "de***@invalid.example",
};

@Injectable()
export class TelegramNewOrderSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<AdminTelegramNewOrderSettings> {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: TELEGRAM_NEW_ORDER_SETTINGS_KEY },
    });
    return toAdminTelegramNewOrderSettings(
      row?.value,
      row?.version ?? 0,
      row?.updatedAt ?? new Date(0),
    );
  }

  async update(
    input: UpdateAdminTelegramNewOrderSettingsDto,
    actor: AdminActor,
  ): Promise<AdminTelegramNewOrderSettings> {
    const now = Date.now();
    if (
      !Number.isFinite(actor.reauthenticatedAt)
      || !actor.reauthenticatedAt
      || actor.reauthenticatedAt > now
      || now - actor.reauthenticatedAt > 5 * 60_000
    ) {
      await this.audit.record({
        actorId: actor.userId,
        action: "telegram.new_order.settings.update",
        targetType: "SiteSetting",
        targetId: TELEGRAM_NEW_ORDER_SETTINGS_KEY,
        result: "DENIED",
        requestId: actor.requestId,
        reason: input.reason,
        ip: actor.ip,
      });
      throw new ForbiddenException("Recent reauthentication is required.");
    }

    const next = parseStoredTelegramNewOrderSettings({
      requestedEnabled: input.requestedEnabled,
      recipientGroupLabel: input.recipientGroupLabel,
      eventType: "ORDER_CREATED",
      includedFields: input.includedFields,
    });
    try {
      const saved = await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.siteSetting.findUnique({
          where: { key: TELEGRAM_NEW_ORDER_SETTINGS_KEY },
        });
        const before = parseStoredTelegramNewOrderSettings(current?.value);
        if (!current) {
          if (input.version !== 0) {
            throw new ConflictException(
              "Telegram notification settings changed. Reload before saving.",
            );
          }
          await transaction.siteSetting.create({
            data: {
              key: TELEGRAM_NEW_ORDER_SETTINGS_KEY,
              value: toInputJson(next),
            },
          });
        } else {
          const updated = await transaction.siteSetting.updateMany({
            where: {
              key: TELEGRAM_NEW_ORDER_SETTINGS_KEY,
              version: input.version,
            },
            data: {
              value: toInputJson(next),
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1) {
            throw new ConflictException(
              "Telegram notification settings changed. Reload before saving.",
            );
          }
        }
        const committed = await transaction.siteSetting.findUniqueOrThrow({
          where: { key: TELEGRAM_NEW_ORDER_SETTINGS_KEY },
        });
        await this.audit.record({
          actorId: actor.userId,
          action: "telegram.new_order.settings.update",
          targetType: "SiteSetting",
          targetId: TELEGRAM_NEW_ORDER_SETTINGS_KEY,
          result: "SUCCEEDED",
          requestId: actor.requestId,
          reason: input.reason,
          beforeData: before,
          afterData: next,
          ip: actor.ip,
        }, transaction);
        return committed;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      return toAdminTelegramNewOrderSettings(
        saved.value,
        saved.version,
        saved.updatedAt,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === "P2002"
      ) {
        throw new ConflictException(
          "Telegram notification settings changed. Reload before saving.",
        );
      }
      throw error;
    }
  }

  async simulate(): Promise<TelegramNewOrderSimulation> {
    const settings = await this.get();
    return {
      mode: "SIMULATED",
      recipientGroupLabel: settings.recipientGroupLabel,
      fields: settings.includedFields.map((code) => ({
        code,
        value: simulationValues[code],
      })),
      generatedAt: new Date().toISOString(),
      deliveryAttempted: false,
      externalDeliveryVerified: false,
    };
  }
}
