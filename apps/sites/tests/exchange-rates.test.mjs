import assert from "node:assert/strict";
import test from "node:test";
import {
  assertOrderRatesFresh,
  getExchangeRateSyncSettings,
  runExchangeRateSync,
  updateExchangeRateSyncSettings,
} from "../server/exchange-rates.ts";
import {
  createTestDatabase,
  memoryR2,
  testActor,
} from "./test-helpers.mjs";

test("ECB cross rates and Coinbase USDT sync use validated decimal strings", async () => {
  const { sqlite, db } = createTestDatabase();
  sqlite.exec("DELETE FROM exchange_rates");
  const env = { DB: db, MEDIA: memoryR2() };
  const originalFetch = globalThis.fetch;
  const date = new Date(Date.now() - 24 * 60 * 60_000).toISOString().slice(0, 10);
  globalThis.fetch = providerFetch(date, {
    CNY: "7.2000",
    USD: "1.1000",
    SGD: "1.4500",
    GBP: "0.8600",
    JPY: "165.0000",
    IDR: "19000.0000",
    MYR: "5.0000",
  }, "4.7000");
  try {
    const run = await runExchangeRateSync(env, "MANUAL", testActor);
    assert.equal(run.status, "SUCCEEDED");
    assert.deepEqual([...run.updatedCurrencies].sort(), [
      "CNY", "EUR", "GBP", "IDR", "JPY", "SGD", "USD", "USDT",
    ]);
    const rates = new Map(sqlite.prepare(
      "SELECT to_code AS code, rate, source FROM exchange_rates ORDER BY to_code",
    ).all().map((row) => [row.code, row]));
    assert.equal(rates.get("CNY").rate, "1.4400000000");
    assert.equal(rates.get("USD").rate, "0.2200000000");
    assert.equal(rates.get("EUR").rate, "0.2000000000");
    assert.equal(rates.get("USDT").rate, "0.2127659574");
    assert.equal(rates.get("CNY").source, "ecb-reference");
    assert.equal(rates.get("USDT").source, "coinbase-usdt");
    await assertOrderRatesFresh(db, "MYR");
  } finally {
    globalThis.fetch = originalFetch;
    sqlite.close();
  }
});

test("manual currency mode survives sync and a greater-than-10-percent change is rejected atomically", async () => {
  const { sqlite, db } = createTestDatabase();
  sqlite.exec("DELETE FROM exchange_rates");
  const env = { DB: db, MEDIA: memoryR2() };
  const originalFetch = globalThis.fetch;
  const date = new Date(Date.now() - 24 * 60 * 60_000).toISOString().slice(0, 10);
  const baseline = {
    CNY: "7.2000", USD: "1.1000", SGD: "1.4500", GBP: "0.8600",
    JPY: "165.0000", IDR: "19000.0000", MYR: "5.0000",
  };
  globalThis.fetch = providerFetch(date, baseline, "4.7000");
  try {
    await runExchangeRateSync(env, "MANUAL", testActor);
    const settings = await getExchangeRateSyncSettings(db);
    const modes = Object.fromEntries(settings.currencies.map((item) => [item.code, item.mode]));
    modes.CNY = "MANUAL";
    await updateExchangeRateSyncSettings(db, {
      enabled: true,
      intervalMinutes: 60,
      modes,
      version: settings.version,
      reason: "Keep the CNY quote under manual review",
    }, testActor);

    globalThis.fetch = providerFetch(date, { ...baseline, CNY: "12.0000" }, "4.7000");
    const manualRun = await runExchangeRateSync(env, "MANUAL", testActor);
    assert.equal(manualRun.status, "SUCCEEDED");
    assert.equal(manualRun.updatedCurrencies.includes("CNY"), false);
    assert.equal(sqlite.prepare(
      "SELECT rate FROM exchange_rates WHERE to_code = 'CNY' ORDER BY effective_at DESC LIMIT 1",
    ).get().rate, "1.4400000000");

    const afterManual = await getExchangeRateSyncSettings(db);
    const autoModes = Object.fromEntries(afterManual.currencies.map((item) => [item.code, "AUTO"]));
    await updateExchangeRateSyncSettings(db, {
      enabled: true,
      intervalMinutes: 60,
      modes: autoModes,
      version: afterManual.version,
      reason: "Return every currency to automatic validation",
    }, testActor);
    await assert.rejects(
      runExchangeRateSync(env, "MANUAL", testActor),
      (error) => error?.code === "RATE_CHANGE_REVIEW_REQUIRED",
    );
    const latestRun = sqlite.prepare(
      "SELECT status, error_code AS errorCode FROM exchange_rate_sync_runs ORDER BY started_at DESC, rowid DESC LIMIT 1",
    ).get();
    assert.equal(latestRun.status, "REVIEW_REQUIRED");
    assert.equal(latestRun.errorCode, "RATE_CHANGE_REVIEW_REQUIRED");
  } finally {
    globalThis.fetch = originalFetch;
    sqlite.close();
  }
});

test("corrupt provider batches write no rates and stale rates fail ordering closed", async () => {
  const { sqlite, db } = createTestDatabase();
  sqlite.exec("DELETE FROM exchange_rates");
  const env = { DB: db, MEDIA: memoryR2() };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes("ecb")
    ? new Response("CURRENCY,TIME_PERIOD,OBS_VALUE\nMYR,2026-07-28,5.0\n", { status: 200 })
    : Response.json({ data: { currency: "USDT", rates: {} } });
  try {
    await assert.rejects(runExchangeRateSync(env, "MANUAL", testActor));
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM exchange_rates").get().count, 0);

    const old = new Date(Date.now() - 8 * 24 * 60 * 60_000).toISOString();
    sqlite.prepare(
      `INSERT INTO exchange_rates
        (id, from_code, to_code, rate, source, effective_at, expires_at, created_at)
       VALUES ('stale-usdt','MYR','USDT','0.2','test',?,?,?)`,
    ).run(old, old, old);
    await assert.rejects(
      assertOrderRatesFresh(db, "MYR"),
      (error) => error?.code === "RATE_STALE",
    );
  } finally {
    globalThis.fetch = originalFetch;
    sqlite.close();
  }
});

function providerFetch(date, fiat, usdtMyr) {
  return async (url) => {
    if (String(url).includes("coinbase")) {
      return Response.json({ data: { currency: "USDT", rates: { MYR: usdtMyr } } });
    }
    const rows = Object.entries(fiat).map(([code, value]) => `${code},${date},${value}`);
    return new Response(
      ["CURRENCY,TIME_PERIOD,OBS_VALUE", ...rows].join("\n"),
      { status: 200, headers: { "content-type": "text/csv" } },
    );
  };
}
