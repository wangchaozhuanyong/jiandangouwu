import assert from "node:assert/strict";
import test from "node:test";
import type { StorefrontChannel } from "@cloudbridge/contracts";
import { resolveContactTarget } from "../lib/contact-actions.js";

const channel = (
  input: Pick<StorefrontChannel, "type" | "mode" | "directTarget">,
): StorefrontChannel => ({
  label: input.type,
  account: "account",
  serviceHours: "09:00 - 18:00",
  ...input,
});

test("WhatsApp receives a localized preset message without replacing an existing one", () => {
  const target = resolveContactTarget(channel({
    type: "WHATSAPP",
    mode: "DIRECT_LINK",
    directTarget: "https://wa.me/60128886618",
  }), "zh");
  assert.ok(target);
  assert.equal(new URL(target).searchParams.get("text"), "你好，我想咨询 CloudBridge 服务。");

  const existing = resolveContactTarget(channel({
    type: "WHATSAPP",
    mode: "DIRECT_LINK",
    directTarget: "https://wa.me/60128886618?text=Keep%20this",
  }), "en");
  assert.ok(existing);
  assert.equal(new URL(existing).searchParams.get("text"), "Keep this");
});

test("only approved channel, mode, and protocol combinations produce direct actions", () => {
  assert.equal(resolveContactTarget(channel({
    type: "EMAIL",
    mode: "DIRECT_LINK",
    directTarget: "mailto:support@example.com",
  }), "en"), "mailto:support@example.com");
  assert.equal(resolveContactTarget(channel({
    type: "TELEGRAM",
    mode: "DIRECT_LINK",
    directTarget: "https://t.me/CloudBridgeSupport",
  }), "en"), "https://t.me/CloudBridgeSupport");
  assert.equal(resolveContactTarget(channel({
    type: "QQ",
    mode: "DIRECT_WITH_FALLBACK",
    directTarget: "mqqwpa://im/chat?chat_type=wpa&uin=288661812",
  }), "zh"), "mqqwpa://im/chat?chat_type=wpa&uin=288661812");
  assert.equal(resolveContactTarget(channel({
    type: "WECHAT",
    mode: "QR_COPY",
    directTarget: null,
  }), "zh"), null);
  assert.equal(resolveContactTarget(channel({
    type: "WHATSAPP",
    mode: "DIRECT_LINK",
    directTarget: "javascript:alert(1)",
  }), "zh"), null);
});
