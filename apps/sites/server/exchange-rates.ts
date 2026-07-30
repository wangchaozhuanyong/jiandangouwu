import type {
  AdminExchangeRateSyncSettings,
  ExchangeRateIntervalMinutes,
  ExchangeRateMode,
  ExchangeRateSyncRun,
} from "@cloudbridge/contracts";
import { exchangeRateIntervals } from "@cloudbridge/contracts";
import { ApiInputError, writeAudit, type AdminIdentity } from "./http";
import type { D1Database, D1Result, SitesEnv } from "./types";

const settingKey = "exchange-rates.sync";
const fiatCodes = ["CNY", "USD", "SGD", "EUR", "GBP", "JPY", "IDR"] as const;
const managedCodes = [...fiatCodes, "USDT"] as const;
const ecbEndpoint = "https://data-api.ecb.europa.eu/service/data/EXR/D.CNY+USD+SGD+GBP+JPY+IDR+MYR.EUR.SP00.A?lastNObservations=1&format=csvdata";
const coinbaseEndpoint = "https://api.coinbase.com/v2/exchange-rates?currency=USDT";
const rateScale = 10;
const fiatMaximumAgeMs = 120 * 60 * 60_000;
const usdtMaximumAgeMs = 48 * 60 * 60_000;

type SyncSettingValue = {
  enabled: boolean;
  intervalMinutes: ExchangeRateIntervalMinutes;
  modes: Record<string, ExchangeRateMode>;
};

type RateCandidate = {
  code: string;
  rate: string;
  source: string;
  effectiveAt: string;
  expiresAt: string;
};

type SyncRunRow = {
  id: string;
  trigger: "AUTOMATIC" | "MANUAL";
  status: ExchangeRateSyncRun["status"];
  providerSummary: string;
  updatedCurrenciesJson: string;
  errorCode: string | null;
  startedAt: string;
  completedAt: string | null;
};

export async function getExchangeRateSyncSettings(
  db: D1Database,
  now = new Date(),
): Promise<AdminExchangeRateSyncSettings> {
  const row = await db.prepare(
    "SELECT value_json AS valueJson, version, updated_at AS updatedAt FROM site_settings WHERE key = ? LIMIT 1",
  ).bind(settingKey).first<{ valueJson: string; version: number; updatedAt: string }>();
  const value = parseSetting(row?.valueJson);
  const latestRun = await db.prepare(
    `SELECT id, trigger, status, provider_summary AS providerSummary,
      updated_currencies_json AS updatedCurrenciesJson, error_code AS errorCode,
      started_at AS startedAt, completed_at AS completedAt
     FROM exchange_rate_sync_runs ORDER BY started_at DESC, id DESC LIMIT 1`,
  ).first<SyncRunRow>();
  const latestSuccess = await db.prepare(
    `SELECT completed_at AS completedAt FROM exchange_rate_sync_runs
     WHERE status = 'SUCCEEDED' ORDER BY completed_at DESC LIMIT 1`,
  ).first<{ completedAt: string }>();
  const rates = await latestManagedRates(db);
  const nextDueAt = latestSuccess?.completedAt
    ? new Date(
        Date.parse(latestSuccess.completedAt) + value.intervalMinutes * 60_000,
      ).toISOString()
    : now.toISOString();
  return {
    enabled: value.enabled,
    intervalMinutes: value.intervalMinutes,
    currencies: managedCodes.map((code) => {
      const rate = rates.get(code);
      return {
        code,
        mode: value.modes[code] ?? "AUTO",
        rate: rate?.rate ?? null,
        source: rate?.source ?? null,
        effectiveAt: rate?.effectiveAt ?? null,
        stale: rate ? isStale(code, rate.effectiveAt, rate.expiresAt, now) : true,
      };
    }),
    lastAttemptAt: latestRun?.startedAt ?? null,
    lastSuccessAt: latestSuccess?.completedAt ?? null,
    nextDueAt,
    lastStatus: latestRun?.status ?? null,
    lastErrorCode: latestRun?.errorCode ?? null,
    version: row?.version ?? 1,
    updatedAt: row?.updatedAt ?? new Date(0).toISOString(),
  };
}

export async function updateExchangeRateSyncSettings(
  db: D1Database,
  input: {
    enabled: boolean;
    intervalMinutes: number;
    modes: Record<string, unknown>;
    version: number;
    reason: string;
  },
  actor: AdminIdentity,
): Promise<AdminExchangeRateSyncSettings> {
  if (!exchangeRateIntervals.includes(input.intervalMinutes as ExchangeRateIntervalMinutes)) {
    throw new ApiInputError("INVALID_RATE_INTERVAL", "The exchange-rate interval is invalid.", 422);
  }
  const modes = Object.fromEntries(managedCodes.map((code) => {
    const mode = String(input.modes[code] ?? "AUTO").toUpperCase();
    if (mode !== "AUTO" && mode !== "MANUAL") {
      throw new ApiInputError("INVALID_RATE_MODE", `The rate mode for ${code} is invalid.`, 422);
    }
    return [code, mode];
  })) as Record<string, ExchangeRateMode>;
  const now = new Date().toISOString();
  const value: SyncSettingValue = {
    enabled: input.enabled,
    intervalMinutes: input.intervalMinutes as ExchangeRateIntervalMinutes,
    modes,
  };
  const result = await db.prepare(
    `UPDATE site_settings SET value_json = ?, version = version + 1,
      updated_at = ?, updated_by_email = ?
     WHERE key = ? AND version = ?`,
  ).bind(JSON.stringify(value), now, actor.email, settingKey, input.version).run();
  if (changes(result) !== 1) {
    throw new ApiInputError("VERSION_CONFLICT", "Exchange-rate settings changed. Refresh and try again.", 409);
  }
  await writeAudit(db, {
    action: "exchange-rates.settings.updated",
    result: "SUCCEEDED",
    actor,
    targetType: "SITE_SETTING",
    targetId: settingKey,
    reason: input.reason,
  });
  return getExchangeRateSyncSettings(db);
}

export async function ensureExchangeRatesFresh(env: SitesEnv): Promise<void> {
  const settings = await getExchangeRateSyncSettings(env.DB);
  if (!settings.enabled) return;
  if (settings.nextDueAt && Date.parse(settings.nextDueAt) > Date.now()) return;
  await runExchangeRateSync(env, "AUTOMATIC");
}

export async function runExchangeRateSync(
  env: SitesEnv,
  trigger: "AUTOMATIC" | "MANUAL",
  actor?: AdminIdentity,
): Promise<ExchangeRateSyncRun> {
  const settings = await getExchangeRateSyncSettings(env.DB);
  if (!settings.enabled && trigger === "AUTOMATIC") {
    throw new ApiInputError("RATE_SYNC_DISABLED", "Automatic exchange-rate synchronization is disabled.", 409);
  }
  const startedAt = new Date();
  const scheduleKey = trigger === "AUTOMATIC"
    ? `automatic:${settings.intervalMinutes}:${Math.floor(startedAt.getTime() / (settings.intervalMinutes * 60_000))}`
    : `manual:${crypto.randomUUID()}`;
  const id = crypto.randomUUID();
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO exchange_rate_sync_runs
      (id, schedule_key, trigger, status, provider_summary, updated_currencies_json,
       error_code, started_at, completed_at)
     VALUES (?, ?, ?, 'RUNNING', 'ECB + Coinbase', '[]', NULL, ?, NULL)`,
  ).bind(id, scheduleKey, trigger, startedAt.toISOString()).run();
  if (changes(inserted) !== 1) {
    const existing = await env.DB.prepare(
      `SELECT id, trigger, status, provider_summary AS providerSummary,
        updated_currencies_json AS updatedCurrenciesJson, error_code AS errorCode,
        started_at AS startedAt, completed_at AS completedAt
       FROM exchange_rate_sync_runs WHERE schedule_key = ? LIMIT 1`,
    ).bind(scheduleKey).first<SyncRunRow>();
    if (!existing) throw new ApiInputError("RATE_SYNC_CONFLICT", "An exchange-rate synchronization is already running.", 409);
    return syncRunItem(existing);
  }

  try {
    const [fiat, usdt] = await Promise.all([fetchEcbRates(startedAt), fetchUsdtRate(startedAt)]);
    const candidates = [...fiat, usdt].filter(
      (candidate) => settings.currencies.find((item) => item.code === candidate.code)?.mode === "AUTO",
    );
    await validateCandidates(env.DB, candidates);
    const statements = candidates.map((candidate) => env.DB.prepare(
      `INSERT OR IGNORE INTO exchange_rates
        (id, from_code, to_code, rate, source, effective_at, expires_at, created_at)
       VALUES (?, 'MYR', ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      candidate.code,
      candidate.rate,
      candidate.source,
      candidate.effectiveAt,
      candidate.expiresAt,
      startedAt.toISOString(),
    ));
    if (statements.length > 0) await env.DB.batch(statements);
    const completedAt = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE exchange_rate_sync_runs SET status = 'SUCCEEDED',
        updated_currencies_json = ?, completed_at = ? WHERE id = ?`,
    ).bind(JSON.stringify(candidates.map((item) => item.code)), completedAt, id).run();
    if (actor) {
      await writeAudit(env.DB, {
        action: "exchange-rates.sync.completed",
        result: "SUCCEEDED",
        actor,
        targetType: "EXCHANGE_RATE_SYNC",
        targetId: id,
        reason: "Manual exchange-rate synchronization",
      });
    }
  } catch (error) {
    const errorCode = error instanceof ApiInputError ? error.code : "RATE_PROVIDER_FAILED";
    await env.DB.prepare(
      `UPDATE exchange_rate_sync_runs SET status = ?, error_code = ?, completed_at = ? WHERE id = ?`,
    ).bind(
      errorCode === "RATE_CHANGE_REVIEW_REQUIRED" ? "REVIEW_REQUIRED" : "FAILED",
      errorCode,
      new Date().toISOString(),
      id,
    ).run();
    if (trigger === "MANUAL") throw error;
  }
  const row = await env.DB.prepare(
    `SELECT id, trigger, status, provider_summary AS providerSummary,
      updated_currencies_json AS updatedCurrenciesJson, error_code AS errorCode,
      started_at AS startedAt, completed_at AS completedAt
     FROM exchange_rate_sync_runs WHERE id = ? LIMIT 1`,
  ).bind(id).first<SyncRunRow>();
  if (!row) throw new ApiInputError("RATE_SYNC_RESULT_MISSING", "The exchange-rate result is unavailable.", 500);
  return syncRunItem(row);
}

export async function assertOrderRatesFresh(
  db: D1Database,
  currency: string,
  now = new Date(),
): Promise<void> {
  const requiredCodes = currency === "MYR" ? ["USDT"] : [currency, "USDT"];
  for (const code of new Set(requiredCodes)) {
    const row = await db.prepare(
      `SELECT rate, source, effective_at AS effectiveAt, expires_at AS expiresAt
       FROM exchange_rates WHERE from_code = 'MYR' AND to_code = ?
       ORDER BY effective_at DESC LIMIT 1`,
    ).bind(code).first<{ rate: string; source: string; effectiveAt: string; expiresAt: string | null }>();
    if (!row) throw new ApiInputError("RATE_UNAVAILABLE", `The ${code} exchange rate is unavailable.`, 503);
    if (isStale(code, row.effectiveAt, row.expiresAt, now)) {
      throw new ApiInputError("RATE_STALE", `The ${code} exchange rate is stale. Ordering remains paused.`, 503);
    }
  }
}

function parseSetting(value: string | undefined): SyncSettingValue {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = value ? JSON.parse(value) as Record<string, unknown> : {};
  } catch {
    parsed = {};
  }
  const interval = Number(parsed.intervalMinutes);
  const modes = parsed.modes && typeof parsed.modes === "object"
    ? parsed.modes as Record<string, unknown>
    : {};
  return {
    enabled: parsed.enabled !== false,
    intervalMinutes: exchangeRateIntervals.includes(interval as ExchangeRateIntervalMinutes)
      ? interval as ExchangeRateIntervalMinutes
      : 360,
    modes: Object.fromEntries(managedCodes.map((code) => [
      code,
      String(modes[code] ?? "AUTO").toUpperCase() === "MANUAL" ? "MANUAL" : "AUTO",
    ])) as Record<string, ExchangeRateMode>,
  };
}

async function fetchEcbRates(now: Date): Promise<RateCandidate[]> {
  const response = await fetch(ecbEndpoint, {
    headers: { accept: "text/csv" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new ApiInputError("ECB_RATE_FETCH_FAILED", "ECB exchange rates could not be fetched.", 502);
  const records = parseCsv(await response.text());
  const values = new Map(records.map((row) => [row.CURRENCY, {
    value: row.OBS_VALUE,
    date: row.TIME_PERIOD,
  }]));
  const myr = values.get("MYR");
  if (!myr || !isSourceDateValid(myr.date, now, fiatMaximumAgeMs)) {
    throw new ApiInputError("ECB_RATE_DATA_INVALID", "ECB exchange-rate data is incomplete or stale.", 502);
  }
  return fiatCodes.map((code) => {
    const item = code === "EUR" ? { value: "1", date: myr.date } : values.get(code);
    if (!item || !isSourceDateValid(item.date, now, fiatMaximumAgeMs)) {
      throw new ApiInputError("ECB_RATE_DATA_INVALID", `ECB did not return a valid ${code} rate.`, 502);
    }
    const effectiveAt = `${item.date}T16:00:00.000Z`;
    return {
      code,
      rate: divideDecimal(item.value, myr.value, rateScale),
      source: "ecb-reference",
      effectiveAt,
      expiresAt: new Date(Date.parse(effectiveAt) + fiatMaximumAgeMs).toISOString(),
    };
  });
}

async function fetchUsdtRate(now: Date): Promise<RateCandidate> {
  const response = await fetch(coinbaseEndpoint, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new ApiInputError("COINBASE_RATE_FETCH_FAILED", "The USDT exchange rate could not be fetched.", 502);
  const payload = await response.json() as {
    data?: { currency?: string; rates?: Record<string, string> };
  };
  const myrPerUsdt = payload.data?.currency === "USDT" ? payload.data.rates?.MYR : undefined;
  if (!myrPerUsdt) throw new ApiInputError("COINBASE_RATE_DATA_INVALID", "The USDT exchange-rate data is incomplete.", 502);
  return {
    code: "USDT",
    rate: divideDecimal("1", myrPerUsdt, rateScale),
    source: "coinbase-usdt",
    effectiveAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + usdtMaximumAgeMs).toISOString(),
  };
}

async function validateCandidates(db: D1Database, candidates: RateCandidate[]): Promise<void> {
  for (const candidate of candidates) {
    if (parseScaled(candidate.rate, rateScale) <= 0n) {
      throw new ApiInputError("RATE_PROVIDER_DATA_INVALID", `The ${candidate.code} rate is invalid.`, 502);
    }
    const previous = await db.prepare(
      `SELECT rate FROM exchange_rates WHERE from_code = 'MYR' AND to_code = ?
       ORDER BY effective_at DESC LIMIT 1`,
    ).bind(candidate.code).first<{ rate: string }>();
    if (previous && exceedsPercent(candidate.rate, previous.rate, 10)) {
      throw new ApiInputError(
        "RATE_CHANGE_REVIEW_REQUIRED",
        `The ${candidate.code} exchange rate changed by more than 10 percent.`,
        409,
      );
    }
  }
}

async function latestManagedRates(db: D1Database) {
  const rows = await db.prepare(
    `SELECT r.to_code AS code, r.rate, r.source, r.effective_at AS effectiveAt,
      r.expires_at AS expiresAt
     FROM exchange_rates r
     JOIN (
       SELECT to_code, MAX(effective_at) AS effective_at FROM exchange_rates
       WHERE from_code = 'MYR' GROUP BY to_code
     ) latest ON latest.to_code = r.to_code AND latest.effective_at = r.effective_at
     WHERE r.from_code = 'MYR'`,
  ).all<{ code: string; rate: string; source: string; effectiveAt: string; expiresAt: string | null }>();
  return new Map((rows.results ?? []).map((row) => [row.code, row]));
}

function syncRunItem(row: SyncRunRow): ExchangeRateSyncRun {
  let currencies: string[] = [];
  try {
    const parsed = JSON.parse(row.updatedCurrenciesJson);
    if (Array.isArray(parsed)) currencies = parsed.map(String);
  } catch {
    currencies = [];
  }
  return {
    id: row.id,
    trigger: row.trigger,
    status: row.status,
    providerSummary: row.providerSummary,
    updatedCurrencies: currencies,
    errorCode: row.errorCode,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  };
}

function parseCsv(value: string): Array<Record<string, string>> {
  const lines = value.split(/\r?\n/u).filter(Boolean);
  if (lines.length < 2) throw new ApiInputError("ECB_RATE_DATA_INVALID", "ECB returned no exchange-rate rows.", 502);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === "\"") {
      if (quoted && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current);
  return values;
}

function divideDecimal(numerator: string, denominator: string, digits: number): string {
  const scale = 12;
  const top = parseScaled(numerator, scale);
  const bottom = parseScaled(denominator, scale);
  if (top <= 0n || bottom <= 0n) throw new ApiInputError("RATE_PROVIDER_DATA_INVALID", "Exchange-rate values must be positive.", 502);
  const factor = 10n ** BigInt(digits);
  const quotient = (top * factor + bottom / 2n) / bottom;
  return formatScaled(quotient, digits);
}

function parseScaled(value: string, digits: number): bigint {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d+)?$/u.test(normalized)) throw new ApiInputError("RATE_PROVIDER_DATA_INVALID", "An exchange-rate value is invalid.", 502);
  const [whole, fraction = ""] = normalized.split(".");
  const padded = `${fraction}${"0".repeat(digits)}`.slice(0, digits);
  return BigInt(whole) * 10n ** BigInt(digits) + BigInt(padded || "0");
}

function formatScaled(value: bigint, digits: number): string {
  const factor = 10n ** BigInt(digits);
  const whole = value / factor;
  const fraction = (value % factor).toString().padStart(digits, "0");
  return `${whole}.${fraction}`;
}

function exceedsPercent(next: string, previous: string, percent: number): boolean {
  const nextValue = parseScaled(next, rateScale);
  const previousValue = parseScaled(previous, rateScale);
  if (previousValue <= 0n) return true;
  const difference = nextValue >= previousValue
    ? nextValue - previousValue
    : previousValue - nextValue;
  return difference * 100n > previousValue * BigInt(percent);
}

function isSourceDateValid(value: string, now: Date, maximumAgeMs: number): boolean {
  const timestamp = Date.parse(`${value}T16:00:00.000Z`);
  return Number.isFinite(timestamp)
    && timestamp <= now.getTime() + 60 * 60_000
    && timestamp >= now.getTime() - maximumAgeMs;
}

function isStale(
  code: string,
  effectiveAt: string,
  expiresAt: string | null,
  now: Date,
): boolean {
  const effective = Date.parse(effectiveAt);
  if (!Number.isFinite(effective) || effective > now.getTime() + 60 * 60_000) return true;
  const maximumAge = code === "USDT" ? usdtMaximumAgeMs : fiatMaximumAgeMs;
  const expiry = expiresAt ? Date.parse(expiresAt) : effective + maximumAge;
  return !Number.isFinite(expiry) || expiry < now.getTime();
}

function changes(result: D1Result): number {
  return Number(result.meta?.changes ?? result.meta?.rows_written ?? 0);
}
