import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { SettingsService } from "../src/settings/settings.service.js";

const storedSettings = {
  siteName: { zh: "云桥", en: "CloudBridge" },
  defaultLocale: "zh" as const,
  seoDescription: { zh: "中文介绍", en: "English description" },
  policyVersion: "2026-07-29",
  acceptOrders: true,
  supportEnabled: true,
  inventoryRiskThreshold: 3,
  transitServiceEnabled: true,
  transitServiceUrl: null,
};

const placeholderChannel = {
  id: "channel-wechat",
  type: "WECHAT" as const,
  mode: "QR_COPY" as const,
  publicAccount: "未配置",
  directTarget: null,
  active: true,
};

const configuredChannel = {
  ...placeholderChannel,
  publicAccount: "CloudBridge_AI",
};

const settingRow = {
  key: "storefront.settings",
  value: storedSettings,
  version: 3,
  updatedAt: new Date("2026-07-29T00:00:00.000Z"),
};

function readService(activeChannels: Array<typeof placeholderChannel>) {
  const prisma = {
    siteSetting: {
      findUnique: async ({ where }: { where: { key: string } }) => (
        where.key === "storefront.settings"
          ? settingRow
          : { key: where.key, value: "2026-07-29" }
      ),
    },
    merchantChannel: {
      findMany: async () => activeChannels,
    },
  };
  return new SettingsService(
    prisma as never,
    { record: async () => undefined } as never,
  );
}

test("public settings fail closed when active channels are only placeholders", async () => {
  const service = readService([placeholderChannel]);

  const publicSettings = await service.publicSettings();
  assert.equal(publicSettings.supportEnabled, false);
  assert.equal(publicSettings.acceptOrders, false);

  const adminSettings = await service.adminSettings();
  assert.deepEqual(adminSettings.orderReadiness, {
    activeContactChannels: 1,
    configuredActiveContactChannels: 0,
  });
  assert.equal(adminSettings.supportEnabled, true);
  assert.equal(adminSettings.acceptOrders, true);
});

test("public settings retain live support and ordering with a configured channel", async () => {
  const service = readService([configuredChannel]);
  const settings = await service.publicSettings();
  assert.equal(settings.supportEnabled, true);
  assert.equal(settings.acceptOrders, true);
});

function updateService(activeChannels: Array<typeof placeholderChannel>) {
  let wroteSettings = false;
  let committedSettings = settingRow;
  const auditRecords: Array<Record<string, unknown>> = [];
  const transaction = {
    siteSetting: {
      findUnique: async ({ where }: { where: { key: string } }) => (
        where.key === "storefront.settings"
          ? committedSettings
          : { key: where.key, value: "2026-07-29" }
      ),
      updateMany: async ({ data }: { data: { value: typeof storedSettings } }) => {
        wroteSettings = true;
        committedSettings = {
          ...settingRow,
          value: data.value,
          version: settingRow.version + 1,
        };
        return { count: 1 };
      },
      upsert: async () => undefined,
      findUniqueOrThrow: async () => committedSettings,
    },
    merchantChannel: {
      findMany: async () => activeChannels,
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof transaction) => unknown) => callback(transaction),
  };
  return {
    service: new SettingsService(
      prisma as never,
      { record: async (record: Record<string, unknown>) => {
        auditRecords.push(record);
      } } as never,
    ),
    wroteSettings: () => wroteSettings,
    auditRecords,
  };
}

const updateInput = {
  version: 3,
  siteName: storedSettings.siteName,
  defaultLocale: storedSettings.defaultLocale,
  seoDescription: storedSettings.seoDescription,
  policyVersion: storedSettings.policyVersion,
  acceptOrders: true,
  supportEnabled: true,
  inventoryRiskThreshold: 3,
  transitServiceEnabled: true,
  transitServiceUrl: null,
  reason: "Enable launch after contact review",
};

test("settings reject ordering without visible support before writing", async () => {
  const { service, wroteSettings } = updateService([configuredChannel]);
  await assert.rejects(
    service.update(
      { ...updateInput, supportEnabled: false },
      { userId: "admin", requestId: "request" },
    ),
    BadRequestException,
  );
  assert.equal(wroteSettings(), false);
});

test("settings reject support and ordering when no configured channel exists", async () => {
  const { service, wroteSettings } = updateService([placeholderChannel]);
  await assert.rejects(
    service.update(updateInput, { userId: "admin", requestId: "request" }),
    BadRequestException,
  );
  assert.equal(wroteSettings(), false);
});

test("settings persist the inventory risk threshold through CAS and audit", async () => {
  const { service, wroteSettings, auditRecords } = updateService([configuredChannel]);
  const settings = await service.update(
    { ...updateInput, inventoryRiskThreshold: 7 },
    { userId: "admin", requestId: "request" },
  );

  assert.equal(wroteSettings(), true);
  assert.equal(settings.inventoryRiskThreshold, 7);
  assert.equal(settings.version, 4);
  assert.equal(auditRecords.length, 1);
  assert.deepEqual(
    (auditRecords[0]?.afterData as { inventoryRiskThreshold?: number }).inventoryRiskThreshold,
    7,
  );
});
