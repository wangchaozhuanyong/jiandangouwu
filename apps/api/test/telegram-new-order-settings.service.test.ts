import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import {
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { PERMISSIONS_KEY } from "../src/auth/auth.decorators.js";
import { TelegramNewOrderSettingsController } from "../src/notifications/telegram-new-order-settings.controller.js";
import {
  TELEGRAM_NEW_ORDER_SETTINGS_KEY,
} from "../src/notifications/telegram-new-order-settings.model.js";
import { TelegramNewOrderSettingsService } from "../src/notifications/telegram-new-order-settings.service.js";

const actor = (reauthenticatedAt: number | null = Date.now()) => ({
  userId: "admin-one",
  requestId: "request-123",
  ip: "127.0.0.1",
  reauthenticatedAt,
});

const updateInput = () => ({
  version: 2,
  requestedEnabled: true,
  recipientGroupLabel: "订单运营组",
  includedFields: ["ORDER_NUMBER", "AMOUNT", "MASKED_CONTACT"] as const,
  reason: "配置新订单模拟消息字段",
});

test("telegram settings controller uses existing settings permissions", () => {
  assert.deepEqual(
    Reflect.getMetadata(
      PERMISSIONS_KEY,
      TelegramNewOrderSettingsController.prototype.get,
    ),
    ["settings.read"],
  );
  assert.deepEqual(
    Reflect.getMetadata(
      PERMISSIONS_KEY,
      TelegramNewOrderSettingsController.prototype.update,
    ),
    ["settings.write"],
  );
  assert.deepEqual(
    Reflect.getMetadata(
      PERMISSIONS_KEY,
      TelegramNewOrderSettingsController.prototype.simulate,
    ),
    ["settings.read"],
  );
});

test("missing telegram settings return safe unconnected defaults", async () => {
  const prisma = {
    siteSetting: {
      findUnique: async () => null,
    },
  };
  const service = new TelegramNewOrderSettingsService(
    prisma as never,
    { record: async () => undefined } as never,
  );

  const result = await service.get();

  assert.equal(result.version, 0);
  assert.equal(result.updatedAt, "1970-01-01T00:00:00.000Z");
  assert.equal(result.requestedEnabled, false);
  assert.equal(result.effectiveEnabled, false);
  assert.equal(result.connectionState, "NOT_CONNECTED");
  assert.equal(result.tokenConfigured, false);
  assert.equal(result.externalDeliveryVerified, false);
});

test("expired reauthentication is audited as denied before settings access", async () => {
  let settingsAccessed = false;
  const auditEvents: Array<Record<string, unknown>> = [];
  const prisma = {
    siteSetting: {
      findUnique: async () => {
        settingsAccessed = true;
        return null;
      },
    },
    $transaction: async () => {
      settingsAccessed = true;
    },
  };
  const audit = {
    record: async (event: Record<string, unknown>) => {
      auditEvents.push(event);
    },
  };
  const service = new TelegramNewOrderSettingsService(
    prisma as never,
    audit as never,
  );

  await assert.rejects(
    service.update(
      updateInput() as never,
      actor(Date.now() - 5 * 60_000 - 1),
    ),
    ForbiddenException,
  );

  assert.equal(settingsAccessed, false);
  assert.deepEqual(auditEvents, [{
    actorId: "admin-one",
    action: "telegram.new_order.settings.update",
    targetType: "SiteSetting",
    targetId: TELEGRAM_NEW_ORDER_SETTINGS_KEY,
    result: "DENIED",
    requestId: "request-123",
    reason: "配置新订单模拟消息字段",
    ip: "127.0.0.1",
  }]);
});

test("future reauthentication timestamps are rejected and audited", async () => {
  const auditEvents: Array<Record<string, unknown>> = [];
  const service = new TelegramNewOrderSettingsService(
    {
      $transaction: async () => {
        throw new Error("future authentication must be rejected first");
      },
    } as never,
    {
      record: async (event: Record<string, unknown>) => {
        auditEvents.push(event);
      },
    } as never,
  );

  await assert.rejects(
    service.update(
      updateInput() as never,
      actor(Date.now() + 60_000),
    ),
    ForbiddenException,
  );
  assert.equal(auditEvents[0]?.result, "DENIED");
});

test("telegram settings use CAS and audit only the committed whitelist in one transaction", async () => {
  const current = {
    key: TELEGRAM_NEW_ORDER_SETTINGS_KEY,
    value: {
      requestedEnabled: false,
      recipientGroupLabel: "旧订单组",
      eventType: "ORDER_CREATED",
      includedFields: ["ORDER_NUMBER"],
      botToken: "must-not-enter-audit",
      chatId: "-100-secret",
    },
    version: 2,
    updatedAt: new Date("2026-07-28T12:00:00.000Z"),
  };
  let updateInputValue: Record<string, unknown> | undefined;
  const auditCalls: Array<{
    event: Record<string, unknown>;
    client: unknown;
  }> = [];
  const transaction = {
    siteSetting: {
      findUnique: async () => current,
      updateMany: async (input: {
        data: { value: Record<string, unknown> };
      }) => {
        updateInputValue = input as unknown as Record<string, unknown>;
        current.value = input.data.value as typeof current.value;
        current.version = 3;
        current.updatedAt = new Date("2026-07-28T12:01:00.000Z");
        return { count: 1 };
      },
      findUniqueOrThrow: async () => current,
    },
  };
  let transactionOptions: Record<string, unknown> | undefined;
  const prisma = {
    $transaction: async (
      callback: (client: typeof transaction) => unknown,
      options: Record<string, unknown>,
    ) => {
      transactionOptions = options;
      return callback(transaction);
    },
  };
  const audit = {
    record: async (event: Record<string, unknown>, client: unknown) => {
      auditCalls.push({ event, client });
    },
  };
  const service = new TelegramNewOrderSettingsService(
    prisma as never,
    audit as never,
  );

  const result = await service.update(updateInput() as never, actor());

  assert.deepEqual(updateInputValue?.where, {
    key: TELEGRAM_NEW_ORDER_SETTINGS_KEY,
    version: 2,
  });
  assert.deepEqual(updateInputValue?.data, {
    value: {
      requestedEnabled: true,
      recipientGroupLabel: "订单运营组",
      eventType: "ORDER_CREATED",
      includedFields: ["ORDER_NUMBER", "AMOUNT", "MASKED_CONTACT"],
    },
    version: { increment: 1 },
  });
  assert.deepEqual(transactionOptions, {
    isolationLevel: "Serializable",
  });
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0]?.client, transaction);
  const serializedAudit = JSON.stringify(auditCalls[0]?.event);
  assert.equal(serializedAudit.includes("must-not-enter-audit"), false);
  assert.equal(serializedAudit.includes("-100-secret"), false);
  assert.deepEqual(auditCalls[0]?.event.afterData, {
    requestedEnabled: true,
    recipientGroupLabel: "订单运营组",
    eventType: "ORDER_CREATED",
    includedFields: ["ORDER_NUMBER", "AMOUNT", "MASKED_CONTACT"],
  });
  assert.equal(result.requestedEnabled, true);
  assert.equal(result.effectiveEnabled, false);
  assert.equal(result.connectionState, "NOT_CONNECTED");
  assert.equal(result.tokenConfigured, false);
  assert.equal(result.externalDeliveryVerified, false);
});

test("telegram settings reject a CAS conflict without a success audit", async () => {
  let auditCount = 0;
  const current = {
    key: TELEGRAM_NEW_ORDER_SETTINGS_KEY,
    value: {},
    version: 3,
    updatedAt: new Date(),
  };
  const transaction = {
    siteSetting: {
      findUnique: async () => current,
      updateMany: async () => ({ count: 0 }),
    },
  };
  const prisma = {
    $transaction: async (
      callback: (client: typeof transaction) => unknown,
    ) => callback(transaction),
  };
  const service = new TelegramNewOrderSettingsService(
    prisma as never,
    {
      record: async () => {
        auditCount += 1;
      },
    } as never,
  );

  await assert.rejects(
    service.update(updateInput() as never, actor()),
    ConflictException,
  );
  assert.equal(auditCount, 0);
});

test("simulation only reads settings and returns fixed masked fields without side effects", async () => {
  let reads = 0;
  const prisma = {
    siteSetting: {
      findUnique: async () => {
        reads += 1;
        return {
          value: {
            requestedEnabled: true,
            recipientGroupLabel: "订单运营组",
            eventType: "ORDER_CREATED",
            includedFields: [
              "ORDER_NUMBER",
              "CONTACT_CHANNEL",
              "MASKED_CONTACT",
            ],
          },
          version: 1,
          updatedAt: new Date("2026-07-28T12:00:00.000Z"),
        };
      },
    },
  };
  const service = new TelegramNewOrderSettingsService(
    prisma as never,
    {
      record: async () => {
        throw new Error("simulation must not audit a send");
      },
    } as never,
  );

  const result = await service.simulate();

  assert.equal(reads, 1);
  assert.equal(result.mode, "SIMULATED");
  assert.equal(result.deliveryAttempted, false);
  assert.equal(result.externalDeliveryVerified, false);
  assert.deepEqual(result.fields, [
    { code: "ORDER_NUMBER", value: "CB-DEMO-000001" },
    { code: "CONTACT_CHANNEL", value: "EMAIL" },
    { code: "MASKED_CONTACT", value: "de***@invalid.example" },
  ]);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("encrypted"), false);
});
