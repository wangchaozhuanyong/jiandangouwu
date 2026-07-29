import assert from "node:assert/strict";
import test from "node:test";
import {
  parseStoredTelegramNewOrderSettings,
  toAdminTelegramNewOrderSettings,
} from "../src/notifications/telegram-new-order-settings.model.js";

const fakeBotToken = [
  "123456789",
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi",
].join(":");

test("telegram settings parser fails closed for any damaged or sensitive stored field", () => {
  const parsed = parseStoredTelegramNewOrderSettings({
    requestedEnabled: true,
    recipientGroupLabel: " 订单运营组 ",
    eventType: "CUSTOM_EVENT",
    includedFields: ["ORDER_NUMBER", "NOT_ALLOWED"],
    botToken: "secret-token",
    chatId: "-100123456",
    customTemplate: "{{contactEncrypted}}",
  });

  assert.deepEqual(parsed, {
    requestedEnabled: false,
    recipientGroupLabel: "订单运营组",
    eventType: "ORDER_CREATED",
    includedFields: [
      "ORDER_NUMBER",
      "PRODUCT",
      "AMOUNT",
      "CURRENCY",
      "STATUS",
      "CREATED_AT",
      "CONTACT_CHANNEL",
      "MASKED_CONTACT",
    ],
  });
  const serialized = JSON.stringify(parsed);
  assert.equal(serialized.includes("secret-token"), false);
  assert.equal(serialized.includes("-100123456"), false);
  assert.equal(serialized.includes("contactEncrypted"), false);
});

test("telegram settings parser rejects unapproved stored keys as one invalid configuration", () => {
  const parsed = parseStoredTelegramNewOrderSettings({
    requestedEnabled: true,
    recipientGroupLabel: "Night shift",
    eventType: "ORDER_CREATED",
    includedFields: ["ORDER_NUMBER"],
    harmlessLookingExtra: true,
  });

  assert.equal(parsed.requestedEnabled, false);
  assert.deepEqual(parsed.includedFields, [
    "ORDER_NUMBER",
    "PRODUCT",
    "AMOUNT",
    "CURRENCY",
    "STATUS",
    "CREATED_AT",
    "CONTACT_CHANNEL",
    "MASKED_CONTACT",
  ]);
});

test("telegram settings parser rejects prefixed secrets and unicode format controls", () => {
  for (const recipientGroupLabel of [
    "接收组 1-100123456789",
    `接收组 x${fakeBotToken}`,
    "接收组\u202e伪装",
  ]) {
    const parsed = parseStoredTelegramNewOrderSettings({
      requestedEnabled: true,
      recipientGroupLabel,
      eventType: "ORDER_CREATED",
      includedFields: ["ORDER_NUMBER"],
    });
    assert.equal(parsed.requestedEnabled, false);
    assert.equal(parsed.recipientGroupLabel, "订单运营组");
  }
});

test("admin telegram settings always derive an unconnected external state", () => {
  const result = toAdminTelegramNewOrderSettings(
    {
      requestedEnabled: true,
      recipientGroupLabel: "Night shift",
      eventType: "ORDER_CREATED",
      includedFields: ["ORDER_NUMBER", "MASKED_CONTACT"],
    },
    4,
    new Date("2026-07-28T12:00:00.000Z"),
  );

  assert.deepEqual(result, {
    requestedEnabled: true,
    effectiveEnabled: false,
    recipientGroupLabel: "Night shift",
    eventType: "ORDER_CREATED",
    includedFields: ["ORDER_NUMBER", "MASKED_CONTACT"],
    connectionState: "NOT_CONNECTED",
    tokenConfigured: false,
    externalDeliveryVerified: false,
    version: 4,
    updatedAt: "2026-07-28T12:00:00.000Z",
  });
});
