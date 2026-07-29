import assert from "node:assert/strict";
import test from "node:test";
import type { AdminTelegramNewOrderSettings } from "@cloudbridge/contracts";
import type { AdminCurrency } from "../src/api";
import {
  buildIntegrationReadiness,
  integrationDefinitionCodes,
  integrationGateCodes,
  integrationJobCodes,
} from "../src/features/integrations/model";

const health = {
  status: "healthy" as const,
  database: "connected" as const,
  valkey: "connected" as const,
  latencyMs: {
    database: 4,
    valkey: 2,
  },
  timestamp: "2026-07-29T12:30:00.000Z",
};

const currency = (
  code: string,
  overrides: Partial<AdminCurrency> = {},
): AdminCurrency => ({
  code,
  token: code,
  name: { zh: code, en: code },
  digits: 2,
  active: true,
  rate: "1.00000000",
  effectiveAt: "2026-07-27T08:00:00.000Z",
  ...overrides,
});

const telegram = (
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
  version: 0,
  updatedAt: "2026-07-29T12:00:00.000Z",
  ...overrides,
});

test("integration readiness reports only the evidence supplied by real reads", () => {
  const currencies = Array.from({ length: 9 }, (_, index) => (
    currency(`C${index}`, index === 8 ? { rate: null } : {})
  ));
  const result = buildIntegrationReadiness({
    health,
    canReadCurrencies: true,
    currencies,
    canReadTelegram: true,
    telegram: telegram(),
  });

  assert.equal(result.healthProbeResultCount, 3);
  assert.equal(result.configuredCurrencyCount, 9);
  assert.equal(result.configuredRateCount, 8);
  assert.equal(result.currencies.activeCount, 9);
  assert.equal(result.currencies.latestEffectiveAt, "2026-07-27T08:00:00.000Z");
  assert.equal(result.activeExternalConnectionCount, 0);
  assert.equal(result.implementedBackgroundJobCount, 0);
  assert.deepEqual(result.definitions.map((definition) => definition.code), integrationDefinitionCodes);
  assert.deepEqual(result.definitions.map((definition) => definition.state), [
    "RUNTIME_VERIFIED",
    "RUNTIME_VERIFIED",
    "RUNTIME_VERIFIED",
    "IMPLEMENTED_LOCAL",
    "NOT_CONNECTED",
    "NOT_DEPLOYED",
  ]);
});

test("integration readiness keeps all former jobs and launch gates explicitly open", () => {
  const result = buildIntegrationReadiness({
    health,
    canReadCurrencies: true,
    currencies: [currency("MYR")],
    canReadTelegram: true,
    telegram: telegram(),
  });

  assert.deepEqual(result.jobs.map((job) => job.code), integrationJobCodes);
  assert.ok(result.jobs.every((job) => job.state === "NOT_IMPLEMENTED"));
  assert.deepEqual(result.gates.map((gate) => gate.code), integrationGateCodes);
  assert.deepEqual(result.gates.map((gate) => gate.state), [
    "NOT_IMPLEMENTED",
    "NOT_IMPLEMENTED",
    "NOT_IMPLEMENTED",
    "NOT_IMPLEMENTED",
    "NOT_IMPLEMENTED",
    "NOT_IMPLEMENTED",
    "NOT_DEPLOYED",
  ]);
});

test("integration readiness fails closed when protected evidence is unavailable", () => {
  const result = buildIntegrationReadiness({
    health,
    canReadCurrencies: false,
    currencies: null,
    canReadTelegram: false,
    telegram: null,
  });

  assert.equal(result.configuredCurrencyCount, null);
  assert.equal(result.configuredRateCount, null);
  assert.equal(result.currencies.state, "RESTRICTED");
  assert.equal(result.telegram.state, "RESTRICTED");
  assert.throws(
    () => buildIntegrationReadiness({
      health,
      canReadCurrencies: false,
      currencies: [currency("MYR")],
      canReadTelegram: false,
      telegram: null,
    }),
    /Currency evidence must match its read permission/u,
  );
});

test("integration readiness rejects unsupported health or connected Telegram claims", () => {
  assert.throws(
    () => buildIntegrationReadiness({
      health: { ...health, status: "unhealthy" } as never,
      canReadCurrencies: false,
      currencies: null,
      canReadTelegram: false,
      telegram: null,
    }),
    /health response failed/u,
  );
  assert.throws(
    () => buildIntegrationReadiness({
      health: { ...health, valkey: "disconnected" } as never,
      canReadCurrencies: false,
      currencies: null,
      canReadTelegram: false,
      telegram: null,
    }),
    /health response failed/u,
  );
  assert.throws(
    () => buildIntegrationReadiness({
      health: {
        ...health,
        latencyMs: { ...health.latencyMs, valkey: -1 },
      },
      canReadCurrencies: false,
      currencies: null,
      canReadTelegram: false,
      telegram: null,
    }),
    /health response failed/u,
  );
  assert.throws(
    () => buildIntegrationReadiness({
      health,
      canReadCurrencies: false,
      currencies: null,
      canReadTelegram: true,
      telegram: telegram({ effectiveEnabled: true as never }),
    }),
    /unconnected-state contract/u,
  );
});

test("integration readiness model never fabricates uptime, runs, retries, or traces", () => {
  const serialized = JSON.stringify(buildIntegrationReadiness({
    health,
    canReadCurrencies: true,
    currencies: [currency("MYR")],
    canReadTelegram: true,
    telegram: telegram(),
  }));

  for (const fabricatedValue of [
    "99.99",
    "TRACE-CB-JOB",
    "11:30",
    "11:25",
    "11:20",
    "04:00",
    "retrying",
    "completed",
  ]) {
    assert.equal(serialized.toLowerCase().includes(fabricatedValue.toLowerCase()), false);
  }
});
