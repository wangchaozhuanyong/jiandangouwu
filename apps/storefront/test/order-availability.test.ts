import assert from "node:assert/strict";
import test from "node:test";
import type {
  StorefrontChannel,
  StorefrontConfig,
} from "@cloudbridge/contracts";
import {
  resolveAvailableContactChannel,
  resolveOrderAvailability,
} from "../lib/order-availability.js";

const channel = (type: StorefrontChannel["type"]): StorefrontChannel => ({
  type,
  mode: type === "WECHAT" ? "QR_COPY" : "DIRECT_LINK",
  label: type,
  account: "account",
  directTarget: null,
  serviceHours: "09:00 - 18:00",
});

const config = (
  acceptOrders: boolean,
  channels: StorefrontChannel[],
): StorefrontConfig => ({
  heroes: [],
  currencies: [],
  channels,
  settings: {
    siteName: { zh: "云桥", en: "CloudBridge" },
    defaultLocale: "zh",
    seoDescription: { zh: "介绍", en: "Description" },
    policyVersion: "2026-07-27",
    acceptOrders,
    supportEnabled: true,
    inventoryRiskThreshold: 3,
    transitServiceEnabled: true,
    transitServiceUrl: null,
  },
});

test("ordering requires both the site switch and at least one active channel", () => {
  assert.equal(resolveOrderAvailability(null), "loading");
  assert.equal(resolveOrderAvailability(config(false, [channel("WHATSAPP")])), "paused");
  assert.equal(resolveOrderAvailability(config(true, [])), "no-channels");
  assert.equal(resolveOrderAvailability(config(true, [channel("WHATSAPP")])), "available");
});

test("a stale draft channel moves to the first currently available channel", () => {
  const channels = [channel("WECHAT"), channel("QQ")];
  assert.equal(resolveAvailableContactChannel(channels, "QQ"), "QQ");
  assert.equal(resolveAvailableContactChannel(channels, "WHATSAPP"), "WECHAT");
  assert.equal(resolveAvailableContactChannel([], "WHATSAPP"), null);
});
