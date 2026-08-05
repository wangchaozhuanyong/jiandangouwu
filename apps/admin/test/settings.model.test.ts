import assert from "node:assert/strict";
import test from "node:test";
import type {
  AdminStorefrontSettings,
  UpdateStorefrontSettingsInput,
} from "@cloudbridge/contracts";
import {
  editableSettings,
  validateSettings,
} from "../src/features/settings/settings-page.js";

const settings: AdminStorefrontSettings = {
  siteName: { zh: "云桥", en: "CloudBridge" },
  defaultLocale: "zh",
  seoDescription: { zh: "中文介绍", en: "English description" },
  policyVersion: "2026-07-29",
  acceptOrders: false,
  supportEnabled: false,
  inventoryRiskThreshold: 7,
  transitServiceEnabled: false,
  transitServiceUrl: null,
  bannerVisibility: {
    HOME: true,
    TRANSIT_SUBSCRIPTIONS: true,
    AI_RECHARGE: true,
  },
  shareTemplate: {
    zh: "推荐 {productName}，当前价格 {price}。",
    en: "See {productName}, currently {price}.",
  },
  version: 4,
  updatedAt: "2026-07-29T00:00:00.000Z",
  orderReadiness: {
    activeContactChannels: 0,
    configuredActiveContactChannels: 0,
  },
};

const validForm = (): UpdateStorefrontSettingsInput => ({
  ...editableSettings(settings),
  reason: "调整库存风险阈值用于运营复核",
});

test("settings form preserves the saved inventory risk threshold", () => {
  const form = editableSettings(settings);
  assert.equal(form.inventoryRiskThreshold, 7);
  assert.equal(form.reason, "");
});

test("settings validation accepts only integer inventory thresholds from 1 to 99", () => {
  const valid = validateSettings(validForm(), "zh", 0);
  assert.equal(valid.ok, true);

  for (const inventoryRiskThreshold of [0, 100, 1.5]) {
    const result = validateSettings(
      { ...validForm(), inventoryRiskThreshold },
      "en",
      0,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.section, "inventory");
      assert.match(result.message, /integer from 1 to 99/u);
    }
  }
});

test("settings validation accepts only the supported product share placeholders", () => {
  const valid = validateSettings(validForm(), "zh", 0);
  assert.equal(valid.ok, true);

  const invalid = validateSettings({
    ...validForm(),
    shareTemplate: {
      zh: "推荐 {productName}，折扣 {discount}",
      en: "See {productName} with {discount}",
    },
  }, "zh", 0);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.section, "share");
    assert.match(invalid.message, /只能使用/u);
  }
});
