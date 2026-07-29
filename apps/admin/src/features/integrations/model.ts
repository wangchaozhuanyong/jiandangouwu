import type {
  AdminTelegramNewOrderSettings,
  SystemHealthStatus,
} from "@cloudbridge/contracts";
import type { AdminCurrency } from "../../api";

export const integrationDefinitionCodes = [
  "API_MYSQL_HEALTH",
  "VALKEY_SESSION_STORE",
  "MYSQL_CURRENCY_CONFIGURATION",
  "LOCAL_MEDIA_PIPELINE",
  "TELEGRAM_NEW_ORDER",
  "AWS_STAGING_TEMPLATE",
] as const;
export type IntegrationDefinitionCode = (typeof integrationDefinitionCodes)[number];

export const integrationJobCodes = [
  "CURRENCY_RATE_SYNC",
  "RESERVATION_EXPIRY_RELEASE",
  "EMAIL_DELIVERY_RETRY",
  "DATABASE_BACKUP_JOB",
] as const;
export type IntegrationJobCode = (typeof integrationJobCodes)[number];

export const integrationGateCodes = [
  "OBJECT_STORAGE",
  "EMAIL_DELIVERY",
  "PAYMENT_PROVIDER",
  "EXCHANGE_RATE_PROVIDER",
  "BACKGROUND_JOB_RUNTIME",
  "INTEGRATION_OBSERVABILITY",
  "AWS_DEPLOYMENT_EVIDENCE",
] as const;
export type IntegrationGateCode = (typeof integrationGateCodes)[number];

export type IntegrationHealth = SystemHealthStatus;

export type IntegrationDefinitionState =
  | "RUNTIME_VERIFIED"
  | "DEFINED_LOCAL_CONFIG"
  | "IMPLEMENTED_LOCAL"
  | "RESTRICTED"
  | "NOT_CONNECTED"
  | "NOT_DEPLOYED";

export type IntegrationReadiness = {
  health: IntegrationHealth;
  healthProbeResultCount: 3;
  configuredCurrencyCount: number | null;
  configuredRateCount: number | null;
  activeExternalConnectionCount: 0;
  implementedBackgroundJobCount: 0;
  definitions: ReadonlyArray<{
    code: IntegrationDefinitionCode;
    repositorySource:
      | "GET_V1_HEALTH"
      | "GET_V1_HEALTH_AND_SESSION_SERVICE"
      | "MYSQL_CURRENCY_TABLES"
      | "LOCAL_ASSET_REFERENCES"
      | "TELEGRAM_SETTINGS_API"
      | "AWS_CDK_STACK";
    state: IntegrationDefinitionState;
  }>;
  jobs: ReadonlyArray<{
    code: IntegrationJobCode;
    state: "NOT_IMPLEMENTED";
  }>;
  gates: ReadonlyArray<{
    code: IntegrationGateCode;
    state: "NOT_IMPLEMENTED" | "NOT_DEPLOYED";
  }>;
  telegram: {
    state: "NOT_CONNECTED" | "RESTRICTED";
    requestedEnabled: boolean | null;
    effectiveEnabled: false | null;
    tokenConfigured: false | null;
    externalDeliveryVerified: false | null;
  };
  currencies: {
    state: "RUNTIME_VERIFIED" | "RESTRICTED";
    activeCount: number | null;
    latestEffectiveAt: string | null;
  };
};

export function buildIntegrationReadiness(input: {
  health: IntegrationHealth;
  canReadCurrencies: boolean;
  currencies: ReadonlyArray<AdminCurrency> | null;
  canReadTelegram: boolean;
  telegram: AdminTelegramNewOrderSettings | null;
}): IntegrationReadiness {
  if (
    input.health.status !== "healthy"
    || input.health.database !== "connected"
    || input.health.valkey !== "connected"
    || !Number.isSafeInteger(input.health.latencyMs.database)
    || input.health.latencyMs.database < 0
    || !Number.isSafeInteger(input.health.latencyMs.valkey)
    || input.health.latencyMs.valkey < 0
  ) {
    throw new Error("Integration health response failed the runtime contract.");
  }
  if (input.canReadCurrencies !== (input.currencies !== null)) {
    throw new Error("Currency evidence must match its read permission.");
  }
  if (input.canReadTelegram !== (input.telegram !== null)) {
    throw new Error("Telegram evidence must match its read permission.");
  }
  if (
    input.telegram
    && (
      input.telegram.connectionState !== "NOT_CONNECTED"
      || input.telegram.effectiveEnabled !== false
      || input.telegram.tokenConfigured !== false
      || input.telegram.externalDeliveryVerified !== false
    )
  ) {
    throw new Error("Telegram integration response failed the unconnected-state contract.");
  }

  const currencies = input.currencies;
  const telegram = input.telegram;

  return {
    health: input.health,
    healthProbeResultCount: 3,
    configuredCurrencyCount: currencies?.length ?? null,
    configuredRateCount: currencies?.filter((currency) => currency.rate !== null).length ?? null,
    activeExternalConnectionCount: 0,
    implementedBackgroundJobCount: 0,
    definitions: [
      {
        code: "API_MYSQL_HEALTH",
        repositorySource: "GET_V1_HEALTH",
        state: "RUNTIME_VERIFIED",
      },
      {
        code: "VALKEY_SESSION_STORE",
        repositorySource: "GET_V1_HEALTH_AND_SESSION_SERVICE",
        state: "RUNTIME_VERIFIED",
      },
      {
        code: "MYSQL_CURRENCY_CONFIGURATION",
        repositorySource: "MYSQL_CURRENCY_TABLES",
        state: currencies ? "RUNTIME_VERIFIED" : "RESTRICTED",
      },
      {
        code: "LOCAL_MEDIA_PIPELINE",
        repositorySource: "LOCAL_ASSET_REFERENCES",
        state: "IMPLEMENTED_LOCAL",
      },
      {
        code: "TELEGRAM_NEW_ORDER",
        repositorySource: "TELEGRAM_SETTINGS_API",
        state: telegram ? "NOT_CONNECTED" : "RESTRICTED",
      },
      {
        code: "AWS_STAGING_TEMPLATE",
        repositorySource: "AWS_CDK_STACK",
        state: "NOT_DEPLOYED",
      },
    ],
    jobs: integrationJobCodes.map((code) => ({ code, state: "NOT_IMPLEMENTED" })),
    gates: [
      { code: "OBJECT_STORAGE", state: "NOT_IMPLEMENTED" },
      { code: "EMAIL_DELIVERY", state: "NOT_IMPLEMENTED" },
      { code: "PAYMENT_PROVIDER", state: "NOT_IMPLEMENTED" },
      { code: "EXCHANGE_RATE_PROVIDER", state: "NOT_IMPLEMENTED" },
      { code: "BACKGROUND_JOB_RUNTIME", state: "NOT_IMPLEMENTED" },
      { code: "INTEGRATION_OBSERVABILITY", state: "NOT_IMPLEMENTED" },
      { code: "AWS_DEPLOYMENT_EVIDENCE", state: "NOT_DEPLOYED" },
    ],
    telegram: telegram
      ? {
          state: "NOT_CONNECTED",
          requestedEnabled: telegram.requestedEnabled,
          effectiveEnabled: telegram.effectiveEnabled,
          tokenConfigured: telegram.tokenConfigured,
          externalDeliveryVerified: telegram.externalDeliveryVerified,
        }
      : {
          state: "RESTRICTED",
          requestedEnabled: null,
          effectiveEnabled: null,
          tokenConfigured: null,
          externalDeliveryVerified: null,
        },
    currencies: {
      state: currencies ? "RUNTIME_VERIFIED" : "RESTRICTED",
      activeCount: currencies?.filter((currency) => currency.active).length ?? null,
      latestEffectiveAt: currencies
        ?.map((currency) => currency.effectiveAt)
        .filter((value): value is string => value !== null)
        .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null,
    },
  };
}
