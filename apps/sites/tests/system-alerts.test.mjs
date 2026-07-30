import assert from "node:assert/strict";
import test from "node:test";
import { writeAudit } from "../server/http.ts";
import { ensureDailyBackup, getBackupReadiness } from "../server/backup-api.ts";
import {
  createSystemAlertDeliveryTest,
  listSystemAlertDeliveries,
  processSystemAlertDeliveries,
  retrySystemAlertDelivery,
} from "../server/system-alerts.ts";
import {
  getTelegramSettings,
  testTelegramConnection,
  updateTelegramSettingValue,
} from "../server/telegram.ts";
import {
  createTestDatabase,
  memoryR2,
  testActor,
} from "./test-helpers.mjs";

test("high-priority audit signals create masked idempotent Telegram alerts", async () => {
  const { sqlite, db } = createTestDatabase();
  const env = connectedEnv(db);
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = telegramFetch(calls, { messageId: 410 });
  try {
    await enableTelegram(env);
    await writeAudit(db, {
      action: "audit.export.csv",
      result: "DENIED",
      actor: {
        email: "sensitive-owner@example.test",
        displayName: "Sensitive Owner",
      },
      targetType: "AUDIT_EXPORT",
      targetId: "full-sensitive-target-identifier",
      reason: "Sensitive business reason that must stay in D1",
    });
    assert.equal(
      sqlite.prepare("SELECT COUNT(*) AS count FROM system_alert_deliveries").get().count,
      1,
    );

    await processSystemAlertDeliveries(env);
    const response = await listSystemAlertDeliveries(env, "SECURITY");
    assert.equal(response.items.length, 1);
    assert.equal(response.items[0].status, "DELIVERED");
    assert.equal(response.items[0].telegramMessageId, "410");
    assert.equal(response.readiness.connectionState, "CONNECTED");
    assert.equal(response.readiness.deliveredCount, 1);

    const sentText = calls.filter((call) => call.method === "sendMessage").at(-1)?.body.text ?? "";
    assert.match(sentText, /audit\.export\.csv/u);
    assert.match(sentText, /DENIED/u);
    assert.doesNotMatch(sentText, /sensitive-owner@example\.test/u);
    assert.doesNotMatch(sentText, /Sensitive Owner/u);
    assert.doesNotMatch(sentText, /Sensitive business reason/u);
    assert.doesNotMatch(sentText, /full-sensitive-target-identifier/u);
  } finally {
    globalThis.fetch = originalFetch;
    sqlite.close();
  }
});

test("system alerts retry six times, expose real receipts, and support audited manual retry", async () => {
  const { sqlite, db } = createTestDatabase();
  const env = connectedEnv(db);
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = telegramFetch(calls, { messageId: 411 });
  try {
    await enableTelegram(env);
    const testDelivery = await createSystemAlertDeliveryTest(
      env,
      "BACKUP",
      testActor,
      "Verify the backup exception alert channel",
    );
    assert.equal(testDelivery.status, "DELIVERED");
    assert.equal(testDelivery.telegramMessageId, "411");

    await writeAudit(db, {
      action: "audit.export.csv",
      result: "DENIED",
      actor: testActor,
      targetType: "AUDIT_EXPORT",
      targetId: "retry-alert",
      reason: "Exercise system alert retry behavior",
    });
    globalThis.fetch = async () => new Response(
      JSON.stringify({ ok: false, error_code: 429 }),
      { status: 429, headers: { "content-type": "application/json" } },
    );
    await processSystemAlertDeliveries(env);
    let failed = (await listSystemAlertDeliveries(env, "SECURITY")).items[0];
    assert.equal(failed.status, "RETRY_SCHEDULED");
    assert.equal(failed.attemptCount, 1);
    assert.equal(failed.errorCode, "TELEGRAM_RATE_LIMITED");

    sqlite.prepare(
      `UPDATE system_alert_deliveries SET attempt_count = 5,
        status = 'RETRY_SCHEDULED', next_attempt_at = ?, updated_at = ? WHERE id = ?`,
    ).run(
      new Date(Date.now() - 1_000).toISOString(),
      new Date(Date.now() - 1_000).toISOString(),
      failed.id,
    );
    await processSystemAlertDeliveries(env);
    failed = (await listSystemAlertDeliveries(env, "SECURITY")).items[0];
    assert.equal(failed.status, "FAILED");
    assert.equal(failed.attemptCount, 6);
    assert.equal(failed.nextAttemptAt, null);

    globalThis.fetch = telegramFetch(calls, { messageId: 412 });
    const retried = await retrySystemAlertDelivery(
      env,
      failed.id,
      testActor,
      "Retry the reviewed failed security alert",
    );
    assert.equal(retried.status, "DELIVERED");
    assert.equal(retried.telegramMessageId, "412");
    assert.equal(
      sqlite.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE action = ? AND result = 'SUCCEEDED'",
      ).get("notifications.system-alert.delivery.retried").count,
      1,
    );
  } finally {
    globalThis.fetch = originalFetch;
    sqlite.close();
  }
});

test("backup failures and stale backup records enqueue deduplicated alerts", async () => {
  const { sqlite, db } = createTestDatabase();
  const env = {
    DB: db,
    MEDIA: memoryR2(),
  };
  try {
    await assert.rejects(
      ensureDailyBackup(env),
      (error) => error?.code === "BACKUP_ENCRYPTION_NOT_CONFIGURED",
    );
    await assert.rejects(
      ensureDailyBackup(env),
      (error) => error?.code === "BACKUP_ENCRYPTION_NOT_CONFIGURED",
    );
    assert.equal(
      sqlite.prepare(
        "SELECT COUNT(*) AS count FROM system_alert_deliveries WHERE event_type = 'BACKUP_FAILURE'",
      ).get().count,
      1,
    );

    const staleAt = new Date(Date.now() - 20 * 60_000).toISOString();
    sqlite.prepare(
      `INSERT INTO backup_snapshots
        (id, schedule_key, mode, status, object_key, schema_version,
         record_counts_json, created_by_email, reason, created_at)
       VALUES ('backup-stale-test', 'manual:stale-test', 'MANUAL', 'CREATING',
         'backups/stale.cbk', 4, '{}', NULL, 'Stale backup test', ?)`,
    ).run(staleAt);
    await getBackupReadiness(env);
    await getBackupReadiness(env);
    assert.equal(
      sqlite.prepare(
        "SELECT COUNT(*) AS count FROM system_alert_deliveries WHERE event_type = 'BACKUP_STALE'",
      ).get().count,
      1,
    );
    const response = await listSystemAlertDeliveries(env, "BACKUP");
    assert.equal(response.readiness.connectionState, "MISSING_SECRETS");
    assert.equal(response.readiness.pendingCount, 2);
  } finally {
    sqlite.close();
  }
});

function connectedEnv(db) {
  return {
    DB: db,
    MEDIA: memoryR2(),
    TELEGRAM_BOT_TOKEN: "123456:test-secret-token",
    TELEGRAM_ORDER_CHAT_ID: "-1001234567890",
  };
}

async function enableTelegram(env) {
  await testTelegramConnection(
    env,
    testActor,
    "Verify the system alert Telegram group",
  );
  const current = await getTelegramSettings(env);
  return updateTelegramSettingValue(env, {
    version: current.version,
    requestedEnabled: true,
    recipientGroupLabel: "云桥代充网站",
    includedFields: ["ORDER_NUMBER"],
    reason: "Enable the verified Telegram delivery channel",
  }, testActor);
}

function telegramFetch(calls, { messageId }) {
  return async (url, init) => {
    const method = String(url).split("/").at(-1);
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ method, body });
    const result = method === "getMe"
      ? { username: "cloudbridge_order_bot" }
      : method === "getChat"
        ? { title: "云桥代充网站", type: "supergroup" }
        : { message_id: messageId };
    return Response.json({ ok: true, result });
  };
}
