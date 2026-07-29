import assert from "node:assert/strict";
import test from "node:test";
import type { AdminTelegramNewOrderSettings } from "@cloudbridge/contracts";
import { buildNotificationReadiness } from "../src/features/notifications/model";

const settings = (
  overrides: Partial<AdminTelegramNewOrderSettings> = {},
): AdminTelegramNewOrderSettings => ({
  requestedEnabled: false,
  effectiveEnabled: false,
  recipientGroupLabel: "Internal order operations",
  eventType: "ORDER_CREATED",
  includedFields: ["ORDER_NUMBER", "PRODUCT", "MASKED_CONTACT"],
  connectionState: "NOT_CONNECTED",
  tokenConfigured: false,
  externalDeliveryVerified: false,
  version: 3,
  updatedAt: "2026-07-29T12:00:00.000Z",
  ...overrides,
});

test("notification readiness preserves the server's unconnected truth", () => {
  const result = buildNotificationReadiness(settings());

  assert.equal(result.route.provider, "TELEGRAM");
  assert.equal(result.route.eventType, "ORDER_CREATED");
  assert.equal(result.route.connectionState, "NOT_CONNECTED");
  assert.equal(result.route.effectiveEnabled, false);
  assert.equal(result.route.tokenConfigured, false);
  assert.equal(result.route.externalDeliveryVerified, false);
  assert.equal(result.deliveryEvidenceState, "NOT_COLLECTED");
});

test("future activation intent never becomes effective delivery", () => {
  const result = buildNotificationReadiness(settings({ requestedEnabled: true }));

  assert.equal(result.route.requestedEnabled, true);
  assert.equal(result.route.effectiveEnabled, false);
  assert.equal(result.route.connectionState, "NOT_CONNECTED");
});

test("notification readiness separates blocked gates from missing infrastructure", () => {
  const result = buildNotificationReadiness(settings());

  assert.deepEqual(
    result.gates.filter((gate) => gate.state === "BLOCKED").map((gate) => gate.code),
    ["DELIVERY_RUNTIME", "BOT_CREDENTIAL", "EXTERNAL_VERIFICATION"],
  );
  assert.deepEqual(
    result.gates.filter((gate) => gate.state === "NOT_IMPLEMENTED").map((gate) => gate.code),
    ["DELIVERY_EVENT_STORE", "RETRY_QUEUE"],
  );
});

test("notification readiness retains only the real saved route metadata", () => {
  const result = buildNotificationReadiness(settings());

  assert.equal(result.route.recipientGroupLabel, "Internal order operations");
  assert.deepEqual(result.route.includedFields, [
    "ORDER_NUMBER",
    "PRODUCT",
    "MASKED_CONTACT",
  ]);
  assert.equal(result.route.version, 3);
  assert.equal(result.route.updatedAt, "2026-07-29T12:00:00.000Z");
});
