import assert from "node:assert/strict";
import test from "node:test";
import {
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { isConfiguredContactChannel } from "@cloudbridge/contracts";
import {
  SupportService,
  validateContactChannelTarget,
} from "../src/support/support.service.js";

const channel = () => ({
  id: "whatsapp",
  type: "WHATSAPP" as const,
  mode: "DIRECT_LINK" as const,
  labelZh: "WhatsApp",
  labelEn: "WhatsApp",
  publicAccount: "+60 12-888 6618",
  directTarget: "https://wa.me/60128886618",
  serviceHoursZh: "10:00–22:00",
  serviceHoursEn: "10:00–22:00",
  active: true,
  sortOrder: 4,
  version: 1,
  updatedAt: new Date("2026-07-27T00:00:00.000Z"),
});

const updateInput = () => ({
  version: 1,
  label: {
    zh: "WhatsApp 客服",
    en: "WhatsApp support",
  },
  publicAccount: "+60 12-888 6618",
  directTarget: "https://wa.me/60128886618",
  serviceHours: {
    zh: "09:00–23:00",
    en: "09:00–23:00",
  },
  active: true,
  sortOrder: 999,
});

test("contact channel targets accept only their approved protocol and mode", () => {
  assert.doesNotThrow(() => validateContactChannelTarget(
    "WHATSAPP",
    "DIRECT_LINK",
    "https://wa.me/60128886618",
  ));
  assert.doesNotThrow(() => validateContactChannelTarget(
    "EMAIL",
    "DIRECT_LINK",
    "mailto:support@example.com",
  ));
  assert.doesNotThrow(() => validateContactChannelTarget(
    "TELEGRAM",
    "DIRECT_LINK",
    "https://t.me/CloudBridgeSupport",
  ));
  assert.doesNotThrow(() => validateContactChannelTarget("WECHAT", "QR_COPY", null));
  assert.doesNotThrow(() => validateContactChannelTarget(
    "QQ",
    "DIRECT_WITH_FALLBACK",
    "mqqwpa://im/chat?chat_type=wpa&uin=288661812",
  ));
});

test("contact channel targets reject unsafe or misleading jumps", () => {
  const invalid: Array<Parameters<typeof validateContactChannelTarget>> = [
    ["WHATSAPP", "DIRECT_LINK", "https://example.com/60128886618"],
    ["EMAIL", "DIRECT_LINK", "https://example.com"],
    ["TELEGRAM", "DIRECT_LINK", "javascript:alert(1)"],
    ["WECHAT", "DIRECT_LINK", "https://weixin.qq.com"],
    ["QQ", "DIRECT_WITH_FALLBACK", "https://example.com/qq"],
  ];
  for (const input of invalid) {
    assert.throws(() => validateContactChannelTarget(...input), BadRequestException);
  }
});

test("contact channel configuration rejects launch placeholders", () => {
  assert.equal(isConfiguredContactChannel({
    type: "WECHAT",
    mode: "QR_COPY",
    publicAccount: "未配置",
    directTarget: null,
  }), false);
  assert.equal(isConfiguredContactChannel({
    type: "WECHAT",
    mode: "QR_COPY",
    publicAccount: "CloudBridge_AI",
    directTarget: null,
  }), true);
});

test("the final configured channel cannot be disabled while support is live", async () => {
  const current = channel();
  let updateCalled = false;
  const transaction = {
    merchantChannel: {
      findUnique: async () => current,
      findMany: async () => [],
      updateMany: async () => {
        updateCalled = true;
        return { count: 1 };
      },
    },
    siteSetting: {
      findUnique: async () => ({
        value: {
          acceptOrders: false,
          supportEnabled: true,
        },
      }),
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof transaction) => unknown) => callback(transaction),
  };
  const service = new SupportService(
    prisma as never,
    { record: async () => undefined } as never,
  );

  await assert.rejects(
    service.updateChannel(
      current.id,
      { ...updateInput(), active: false },
      { userId: "admin", requestId: "request" },
    ),
    ConflictException,
  );
  assert.equal(updateCalled, false);
});

test("the final configured channel can be disabled after support and ordering are closed", async () => {
  const current = channel();
  const saved = { ...current, active: false, version: 2 };
  let updateCalled = false;
  const transaction = {
    merchantChannel: {
      findUnique: async () => current,
      findMany: async () => [],
      updateMany: async () => {
        updateCalled = true;
        return { count: 1 };
      },
      findUniqueOrThrow: async () => saved,
    },
    siteSetting: {
      findUnique: async () => ({
        value: {
          acceptOrders: false,
          supportEnabled: false,
        },
      }),
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof transaction) => unknown) => callback(transaction),
  };
  const service = new SupportService(
    prisma as never,
    { record: async () => undefined } as never,
  );

  const updated = await service.updateChannel(
    current.id,
    { ...updateInput(), active: false },
    { userId: "admin", requestId: "request" },
  );

  assert.equal(updateCalled, true);
  assert.equal(updated.active, false);
});

test("contact channel update preserves order and audits complete channel maps", async () => {
  const current = channel();
  const saved = {
    ...current,
    labelZh: "WhatsApp 客服",
    labelEn: "WhatsApp support",
    serviceHoursZh: "09:00–23:00",
    serviceHoursEn: "09:00–23:00",
    version: 2,
    updatedAt: new Date("2026-07-28T00:00:00.000Z"),
  };
  let updateData: Record<string, unknown> | undefined;
  const auditEvents: Array<Record<string, unknown>> = [];
  const transaction = {
    merchantChannel: {
      findUnique: async () => current,
      count: async () => 1,
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return { count: 1 };
      },
      findUniqueOrThrow: async () => saved,
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof transaction) => unknown) => callback(transaction),
  };
  const audit = {
    record: async (event: Record<string, unknown>) => {
      auditEvents.push(event);
    },
  };
  const service = new SupportService(prisma as never, audit as never);

  const updated = await service.updateChannel(
    current.id,
    updateInput(),
    { userId: "admin", requestId: "request" },
  );

  assert.equal(Object.hasOwn(updateData ?? {}, "sortOrder"), false);
  assert.equal(updated.sortOrder, 4);
  assert.deepEqual(auditEvents[0]?.beforeData, {
    id: "whatsapp",
    type: "WHATSAPP",
    mode: "DIRECT_LINK",
    label: { zh: "WhatsApp", en: "WhatsApp" },
    publicAccount: "+60 12-888 6618",
    directTarget: "https://wa.me/60128886618",
    serviceHours: { zh: "10:00–22:00", en: "10:00–22:00" },
    active: true,
    sortOrder: 4,
    version: 1,
    updatedAt: "2026-07-27T00:00:00.000Z",
  });
  assert.deepEqual(auditEvents[0]?.afterData, {
    id: "whatsapp",
    type: "WHATSAPP",
    mode: "DIRECT_LINK",
    label: { zh: "WhatsApp 客服", en: "WhatsApp support" },
    publicAccount: "+60 12-888 6618",
    directTarget: "https://wa.me/60128886618",
    serviceHours: { zh: "09:00–23:00", en: "09:00–23:00" },
    active: true,
    sortOrder: 4,
    version: 2,
    updatedAt: "2026-07-28T00:00:00.000Z",
  });
});
