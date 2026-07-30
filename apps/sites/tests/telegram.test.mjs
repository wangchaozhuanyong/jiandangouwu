import assert from "node:assert/strict";
import test from "node:test";
import {
  getTelegramSettings,
  listTelegramDeliveries,
  processTelegramDeliveries,
  telegramDeliveryInsert,
  testTelegramConnection,
  updateTelegramSettingValue,
} from "../server/telegram.ts";
import {
  encryptOrderContact,
  hashOrderContact,
} from "../server/data-protection.ts";
import {
  createTestDatabase,
  memoryR2,
  seedOrder,
  testActor,
} from "./test-helpers.mjs";

const dataKey = Buffer.alloc(32, 11).toString("base64url");

test("Telegram connection uses real API receipts and keeps secrets out of D1", async () => {
  const { sqlite, db } = createTestDatabase();
  const env = {
    DB: db,
    MEDIA: memoryR2(),
    CLOUDBRIDGE_DATA_KEY: dataKey,
    TELEGRAM_BOT_TOKEN: "123456:test-secret-token",
    TELEGRAM_ORDER_CHAT_ID: "-1001234567890",
  };
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const method = String(url).split("/").at(-1);
    calls.push({ method, body: JSON.parse(String(init?.body ?? "{}")) });
    const result = method === "getMe"
      ? { username: "cloudbridge_order_bot" }
      : method === "getChat"
        ? { title: "云桥代充网站", type: "supergroup" }
        : { message_id: 90210 };
    return Response.json({ ok: true, result });
  };
  try {
    assert.equal((await getTelegramSettings(env)).connectionState, "UNVERIFIED");
    const receipt = await testTelegramConnection(
      env,
      testActor,
      "Verify the real order notification group",
    );
    assert.equal(receipt.delivered, true);
    assert.equal(receipt.chatTitle, "云桥代充网站");
    assert.equal(receipt.messageId, "90210");
    assert.deepEqual(calls.map((call) => call.method), ["getMe", "getChat", "sendMessage"]);

    const row = sqlite.prepare(
      "SELECT value_json AS valueJson FROM site_settings WHERE key = 'notifications.telegram.new-order'",
    ).get();
    assert.doesNotMatch(row.valueJson, /test-secret-token|-1001234567890/u);
    assert.equal((await getTelegramSettings(env)).connectionState, "CONNECTED");
  } finally {
    globalThis.fetch = originalFetch;
    sqlite.close();
  }
});

test("Telegram queue is idempotent, masked, retryable, and terminal after six attempts", async () => {
  const { sqlite, db } = createTestDatabase();
  const env = {
    DB: db,
    MEDIA: memoryR2(),
    CLOUDBRIDGE_DATA_KEY: dataKey,
    TELEGRAM_BOT_TOKEN: "123456:test-secret-token",
    TELEGRAM_ORDER_CHAT_ID: "-1001234567890",
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const method = String(url).split("/").at(-1);
    const result = method === "getMe"
      ? { username: "cloudbridge_order_bot" }
      : method === "getChat"
        ? { title: "云桥代充网站", type: "supergroup" }
        : { message_id: 77 };
    return Response.json({ ok: true, result });
  };
  try {
    await testTelegramConnection(env, testActor, "Verify before queue delivery test");
    const current = await getTelegramSettings(env);
    const enabled = await updateTelegramSettingValue(env, {
      version: current.version,
      requestedEnabled: true,
      recipientGroupLabel: "云桥代充网站",
      includedFields: [
        "ORDER_NUMBER",
        "PRODUCT",
        "AMOUNT",
        "CURRENCY",
        "MASKED_CONTACT",
      ],
      reason: "Enable verified Telegram order delivery",
    }, testActor);
    assert.equal(enabled.effectiveEnabled, true);

    const plainContact = "customer@example.test";
    await seedOrder(sqlite, {
      id: "order-telegram-one",
      contactEncrypted: await encryptOrderContact(plainContact, dataKey),
      contactHash: await hashOrderContact(plainContact, dataKey),
      contact: "cu***@example.test",
      status: "MANUAL_PENDING",
      updatedAt: new Date().toISOString(),
    });
    const input = {
      orderId: "order-telegram-one",
      orderNumber: "CB-TELEGRAM-ONE",
      product: "OpenAI Codex Professional",
      amount: "89.00",
      currency: "MYR",
      status: "MANUAL_PENDING",
      createdAt: new Date(Date.now() - 1_000).toISOString(),
      contactChannel: "EMAIL",
      maskedContact: "cu***@example.test",
    };
    await db.batch([
      telegramDeliveryInsert(db, enabled, input),
      telegramDeliveryInsert(db, enabled, input),
    ].filter(Boolean));
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM telegram_deliveries").get().count, 1);
    const payload = sqlite.prepare("SELECT payload_json AS payload FROM telegram_deliveries").get().payload;
    assert.doesNotMatch(payload, /customer@example\.test/u);

    await processTelegramDeliveries(env);
    let delivery = (await listTelegramDeliveries(db))[0];
    assert.equal(delivery.status, "DELIVERED");
    assert.equal(delivery.telegramMessageId, "77");
    assert.equal(delivery.attemptCount, 1);

    await seedOrder(sqlite, {
      id: "order-telegram-rate-limit",
      contactEncrypted: await encryptOrderContact("second@example.test", dataKey),
      contactHash: await hashOrderContact("second@example.test", dataKey),
      status: "MANUAL_PENDING",
      updatedAt: new Date().toISOString(),
    });
    const limitedStatement = telegramDeliveryInsert(db, enabled, {
      ...input,
      orderId: "order-telegram-rate-limit",
      orderNumber: "CB-TELEGRAM-TWO",
      createdAt: new Date(Date.now() - 1_000).toISOString(),
    });
    await limitedStatement.run();
    globalThis.fetch = async () => new Response(
      JSON.stringify({ ok: false, error_code: 429 }),
      { status: 429, headers: { "content-type": "application/json" } },
    );
    await processTelegramDeliveries(env);
    delivery = (await listTelegramDeliveries(db)).find((item) => item.orderId === "order-telegram-rate-limit");
    assert.equal(delivery.status, "RETRY_SCHEDULED");
    assert.equal(delivery.attemptCount, 1);
    assert.equal(delivery.errorCode, "TELEGRAM_RATE_LIMITED");
    assert.ok(Date.parse(delivery.nextAttemptAt) > Date.now());

    sqlite.prepare(
      `UPDATE telegram_deliveries SET attempt_count = 5,
        status = 'RETRY_SCHEDULED', next_attempt_at = ?, updated_at = ? WHERE order_id = ?`,
    ).run(
      new Date(Date.now() - 1_000).toISOString(),
      new Date(Date.now() - 1_000).toISOString(),
      "order-telegram-rate-limit",
    );
    await processTelegramDeliveries(env);
    delivery = (await listTelegramDeliveries(db)).find((item) => item.orderId === "order-telegram-rate-limit");
    assert.equal(delivery.status, "FAILED");
    assert.equal(delivery.attemptCount, 6);
    assert.equal(delivery.nextAttemptAt, null);
  } finally {
    globalThis.fetch = originalFetch;
    sqlite.close();
  }
});
