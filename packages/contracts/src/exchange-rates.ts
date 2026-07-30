export const exchangeRateIntervals = [60, 360, 720, 1440] as const;
export type ExchangeRateIntervalMinutes = (typeof exchangeRateIntervals)[number];
export type ExchangeRateMode = "AUTO" | "MANUAL";
export type ExchangeRateSyncStatus = "RUNNING" | "SUCCEEDED" | "FAILED" | "REVIEW_REQUIRED";

export type AdminExchangeRateSyncCurrency = {
  code: string;
  mode: ExchangeRateMode;
  rate: string | null;
  source: string | null;
  effectiveAt: string | null;
  stale: boolean;
};

export type AdminExchangeRateSyncSettings = {
  enabled: boolean;
  intervalMinutes: ExchangeRateIntervalMinutes;
  currencies: ReadonlyArray<AdminExchangeRateSyncCurrency>;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  nextDueAt: string | null;
  lastStatus: ExchangeRateSyncStatus | null;
  lastErrorCode: string | null;
  version: number;
  updatedAt: string;
};

export type UpdateAdminExchangeRateSyncSettingsInput = {
  enabled: boolean;
  intervalMinutes: ExchangeRateIntervalMinutes;
  modes: Readonly<Record<string, ExchangeRateMode>>;
  version: number;
  reason: string;
};

export type ExchangeRateSyncRun = {
  id: string;
  status: ExchangeRateSyncStatus;
  trigger: "AUTOMATIC" | "MANUAL";
  providerSummary: string;
  updatedCurrencies: ReadonlyArray<string>;
  errorCode: string | null;
  startedAt: string;
  completedAt: string | null;
};
