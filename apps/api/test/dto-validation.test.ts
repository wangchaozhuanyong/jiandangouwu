import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import {
  BadRequestException,
  ValidationPipe,
  type Type,
} from "@nestjs/common";

const contentDtoPath = "../dist/src/content/content.dto.js";
const settingsDtoPath = "../dist/src/settings/settings.dto.js";
const supportDtoPath = "../dist/src/support/support.dto.js";
const {
  CreateHeroDto,
  ReorderHeroesDto,
} = await import(contentDtoPath) as typeof import("../src/content/content.dto.js");
const {
  UpdateStorefrontSettingsDto,
} = await import(settingsDtoPath) as typeof import("../src/settings/settings.dto.js");
const {
  ReorderContactChannelsDto,
  UpdateContactChannelDto,
} = await import(supportDtoPath) as typeof import("../src/support/support.dto.js");

const validationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

const validateBody = <T>(metatype: Type<T>, value: unknown): Promise<T> =>
  validationPipe.transform(value, { type: "body", metatype }) as Promise<T>;

const heroInput = () => ({
  key: " main ",
  imageKey: " /assets/hero-main.webp ",
  targetSlug: " codex ",
  tone: " cyan ",
  status: " ACTIVE ",
  sortOrder: 99,
  translations: {
    zh: {
      eyebrow: " 云桥 / 01 ",
      title: " 中文标题 ",
      body: " 中文正文 ",
      cta: " 查看 ",
    },
    en: {
      eyebrow: " CloudBridge / 01 ",
      title: " English title ",
      body: " English body ",
      cta: " View ",
    },
  },
});

const channelInput = () => ({
  version: 1,
  label: {
    zh: " 微信 ",
    en: " WeChat ",
  },
  publicAccount: " CloudBridge_AI ",
  directTarget: null,
  serviceHours: {
    zh: " 10:00–22:00 ",
    en: " 10:00–22:00 ",
  },
  active: true,
  sortOrder: 4,
});

const settingsInput = () => ({
  version: 1,
  siteName: {
    zh: " 云桥 ",
    en: " CloudBridge ",
  },
  defaultLocale: " en ",
  seoDescription: {
    zh: " 中文说明 ",
    en: " English description ",
  },
  policyVersion: " 2026-08-01 ",
  acceptOrders: true,
  supportEnabled: true,
  inventoryRiskThreshold: 3,
  transitServiceEnabled: true,
  transitServiceUrl: " https://transit.example.com/path ",
  reason: " 更新客户端基础设置 ",
});

test("content DTOs trim every string before validation", async () => {
  const result = await validateBody(CreateHeroDto, heroInput());
  assert.equal(result.key, "main");
  assert.equal(result.imageKey, "/assets/hero-main.webp");
  assert.equal(result.targetSlug, "codex");
  assert.equal(result.tone, "cyan");
  assert.equal(result.status, "ACTIVE");
  assert.deepEqual({ ...result.translations.zh }, {
    eyebrow: "云桥 / 01",
    title: "中文标题",
    body: "中文正文",
    cta: "查看",
  });
  assert.deepEqual({ ...result.translations.en }, {
    eyebrow: "CloudBridge / 01",
    title: "English title",
    body: "English body",
    cta: "View",
  });

  const order = await validateBody(ReorderHeroesDto, {
    items: [{ id: " hero-id ", version: 1 }],
  });
  assert.equal(order.items[0]?.id, "hero-id");
});

test("content DTOs reject missing nested values and whitespace-only copy", async () => {
  const { translations: _translations, ...withoutTranslations } = heroInput();
  await assert.rejects(
    validateBody(CreateHeroDto, withoutTranslations),
    BadRequestException,
  );
  await assert.rejects(
    validateBody(CreateHeroDto, {
      ...heroInput(),
      translations: {
        en: heroInput().translations.en,
      },
    }),
    BadRequestException,
  );
  await assert.rejects(
    validateBody(CreateHeroDto, {
      ...heroInput(),
      translations: {
        ...heroInput().translations,
        zh: {
          ...heroInput().translations.zh,
          title: "   ",
        },
      },
    }),
    BadRequestException,
  );
});

test("support DTOs trim every string before validation", async () => {
  const result = await validateBody(UpdateContactChannelDto, channelInput());
  assert.deepEqual({ ...result.label }, { zh: "微信", en: "WeChat" });
  assert.equal(result.publicAccount, "CloudBridge_AI");
  assert.deepEqual({ ...result.serviceHours }, { zh: "10:00–22:00", en: "10:00–22:00" });

  const order = await validateBody(ReorderContactChannelsDto, {
    items: [{ id: " channel-id ", version: 1 }],
  });
  assert.equal(order.items[0]?.id, "channel-id");
});

test("support DTOs reject missing nested values and whitespace-only copy", async () => {
  const { label: _label, ...withoutLabel } = channelInput();
  await assert.rejects(
    validateBody(UpdateContactChannelDto, withoutLabel),
    BadRequestException,
  );
  const { serviceHours: _serviceHours, ...withoutHours } = channelInput();
  await assert.rejects(
    validateBody(UpdateContactChannelDto, withoutHours),
    BadRequestException,
  );
  await assert.rejects(
    validateBody(UpdateContactChannelDto, {
      ...channelInput(),
      label: { en: "WeChat" },
    }),
    BadRequestException,
  );
  await assert.rejects(
    validateBody(UpdateContactChannelDto, {
      ...channelInput(),
      publicAccount: "   ",
    }),
    BadRequestException,
  );
});

test("settings DTO trims every string before validation", async () => {
  const result = await validateBody(UpdateStorefrontSettingsDto, settingsInput());
  assert.deepEqual({ ...result.siteName }, { zh: "云桥", en: "CloudBridge" });
  assert.equal(result.defaultLocale, "en");
  assert.deepEqual({ ...result.seoDescription }, {
    zh: "中文说明",
    en: "English description",
  });
  assert.equal(result.policyVersion, "2026-08-01");
  assert.equal(result.transitServiceUrl, "https://transit.example.com/path");
  assert.equal(result.reason, "更新客户端基础设置");
});

test("settings DTO rejects missing nested values and whitespace-only copy", async () => {
  const { siteName: _siteName, ...withoutSiteName } = settingsInput();
  await assert.rejects(
    validateBody(UpdateStorefrontSettingsDto, withoutSiteName),
    BadRequestException,
  );
  const { seoDescription: _seoDescription, ...withoutSeo } = settingsInput();
  await assert.rejects(
    validateBody(UpdateStorefrontSettingsDto, withoutSeo),
    BadRequestException,
  );
  await assert.rejects(
    validateBody(UpdateStorefrontSettingsDto, {
      ...settingsInput(),
      siteName: { en: "CloudBridge" },
    }),
    BadRequestException,
  );
  await assert.rejects(
    validateBody(UpdateStorefrontSettingsDto, {
      ...settingsInput(),
      reason: "        ",
    }),
    BadRequestException,
  );
  await assert.rejects(
    validateBody(UpdateStorefrontSettingsDto, {
      ...settingsInput(),
      inventoryRiskThreshold: 0,
    }),
    BadRequestException,
  );
  await assert.rejects(
    validateBody(UpdateStorefrontSettingsDto, {
      ...settingsInput(),
      inventoryRiskThreshold: 100,
    }),
    BadRequestException,
  );
});
