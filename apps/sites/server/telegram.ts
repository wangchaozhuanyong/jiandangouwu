import {
  telegramNewOrderFieldCodes,
  type AdminTelegramNewOrderSettings,
  type TelegramDeliveryItem,
  type TelegramNewOrderFieldCode,
} from "@cloudbridge/contracts";
import { ApiInputError, writeAudit, type AdminIdentity } from "./http";
import type { D1Database, D1PreparedStatement, D1Result, SitesEnv } from "./types";

const settingKey = "notifications.telegram.new-order";
const telegramApiBase = "https://api.telegram.org";
const retryDelaysMs = [0, 60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 12 * 60 * 60_000] as const;

type TelegramSettingValue = {
  requestedEnabled: boolean;
  recipientGroupLabel: string;
  includedFields: TelegramNewOrderFieldCode[];
  verifiedAt?: string;
  verifiedChatTitle?: string;
  botUsername?: string;
  connectionFingerprint?: string;
};

type DeliveryRow = {
  id: string;
  orderId: string | null;
  orderNumber: string;
  eventType: "ORDER_CREATED";
  status: TelegramDeliveryItem["status"];
  payloadJson: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  telegramMessageId: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

type OrderNotificationPayload = {
  ORDER_NUMBER: string;
  PRODUCT: string;
  AMOUNT: string;
  CURRENCY: string;
  STATUS: string;
  CREATED_AT: string;
  CONTACT_CHANNEL: string;
  MASKED_CONTACT: string;
};

export async function getTelegramSettings(env: SitesEnv): Promise<AdminTelegramNewOrderSettings> {
  const row = await env.DB.prepare(
    "SELECT value_json AS valueJson, version, updated_at AS updatedAt FROM site_settings WHERE key = ? LIMIT 1",
  ).bind(settingKey).first<{ valueJson: string; version: number; updatedAt: string }>();
  const parsed = parseSetting(row?.valueJson);
  const tokenConfigured = Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ORDER_CHAT_ID);
  const fingerprint = tokenConfigured
    ? await connectionFingerprint(env.TELEGRAM_BOT_TOKEN!, env.TELEGRAM_ORDER_CHAT_ID!)
    : null;
  const externalDeliveryVerified = Boolean(
    parsed.verifiedAt
    && parsed.connectionFingerprint
    && fingerprint
    && parsed.connectionFingerprint === fingerprint,
  );
  const connectionState = !tokenConfigured
    ? "MISSING_SECRETS"
    : externalDeliveryVerified
      ? "CONNECTED"
      : "UNVERIFIED";
  return {
    requestedEnabled: parsed.requestedEnabled,
    effectiveEnabled: parsed.requestedEnabled && connectionState === "CONNECTED",
    recipientGroupLabel: parsed.recipientGroupLabel,
    eventType: "ORDER_CREATED",
    includedFields: parsed.includedFields,
    connectionState,
    tokenConfigured,
    externalDeliveryVerified,
    verifiedAt: externalDeliveryVerified ? parsed.verifiedAt ?? null : null,
    verifiedChatTitle: externalDeliveryVerified ? parsed.verifiedChatTitle ?? null : null,
    botUsername: externalDeliveryVerified ? parsed.botUsername ?? null : null,
    version: row?.version ?? 1,
    updatedAt: row?.updatedAt ?? new Date(0).toISOString(),
  };
}

export async function testTelegramConnection(
  env: SitesEnv,
  actor: AdminIdentity,
  reason: string,
) {
  const token = requiredSecret(env.TELEGRAM_BOT_TOKEN, "TELEGRAM_BOT_TOKEN");
  const chatId = requiredSecret(env.TELEGRAM_ORDER_CHAT_ID, "TELEGRAM_ORDER_CHAT_ID");
  const settingsRow = await env.DB.prepare(
    "SELECT value_json AS valueJson, version FROM site_settings WHERE key = ? LIMIT 1",
  ).bind(settingKey).first<{ valueJson: string; version: number }>();
  const setting = parseSetting(settingsRow?.valueJson);
  const me = await telegramCall<{ username?: string }>(token, "getMe", {});
  const chat = await telegramCall<{ title?: string; type?: string }>(token, "getChat", {
    chat_id: chatId,
  });
  const chatTitle = chat.title?.trim() ?? "";
  if (!chatTitle || !["group", "supergroup"].includes(chat.type ?? "")) {
    throw new ApiInputError("TELEGRAM_CHAT_INVALID", "The configured Telegram target is not a group.", 409);
  }
  if (
    setting.recipientGroupLabel
    && setting.recipientGroupLabel.normalize("NFKC") !== chatTitle.normalize("NFKC")
  ) {
    throw new ApiInputError(
      "TELEGRAM_CHAT_TITLE_MISMATCH",
      "The Telegram group title does not match the saved recipient label.",
      409,
    );
  }
  const deliveredAt = new Date().toISOString();
  const message = await telegramCall<{ message_id: number }>(token, "sendMessage", {
    chat_id: chatId,
    text: [
      "CloudBridge 云桥",
      "Telegram 新订单通知连接测试成功",
      `群组：${chatTitle}`,
      `时间：${deliveredAt}`,
      "此消息不包含真实订单或客户联系方式。",
    ].join("\n"),
    disable_notification: true,
  });
  const fingerprint = await connectionFingerprint(token, chatId);
  const value: TelegramSettingValue = {
    ...setting,
    recipientGroupLabel: setting.recipientGroupLabel || chatTitle,
    verifiedAt: deliveredAt,
    verifiedChatTitle: chatTitle,
    botUsername: me.username ?? "",
    connectionFingerprint: fingerprint,
  };
  const updated = await env.DB.prepare(
    `UPDATE site_settings SET value_json = ?, version = version + 1,
      updated_at = ?, updated_by_email = ? WHERE key = ? AND version = ?`,
  ).bind(
    JSON.stringify(value),
    deliveredAt,
    actor.email,
    settingKey,
    settingsRow?.version ?? 1,
  ).run();
  if (changes(updated) !== 1) {
    throw new ApiInputError("VERSION_CONFLICT", "Telegram settings changed. Refresh and test again.", 409);
  }
  await writeAudit(env.DB, {
    action: "notifications.telegram.connection.verified",
    result: "SUCCEEDED",
    actor,
    targetType: "TELEGRAM_CONNECTION",
    targetId: chatTitle,
    reason,
  });
  return {
    mode: "REAL" as const,
    delivered: true as const,
    messageId: String(message.message_id),
    chatTitle,
    botUsername: me.username ?? "",
    deliveredAt,
  };
}

export async function updateTelegramSettingValue(
  env: SitesEnv,
  input: {
    version: number;
    requestedEnabled: boolean;
    recipientGroupLabel: string;
    includedFields: string[];
    reason: string;
  },
  actor: AdminIdentity,
): Promise<AdminTelegramNewOrderSettings> {
  const current = await env.DB.prepare(
    "SELECT value_json AS valueJson FROM site_settings WHERE key = ? LIMIT 1",
  ).bind(settingKey).first<{ valueJson: string }>();
  const parsed = parseSetting(current?.valueJson);
  const fields = telegramNewOrderFieldCodes.filter((field) => input.includedFields.includes(field));
  if (fields.length === 0) {
    throw new ApiInputError("TELEGRAM_FIELDS_REQUIRED", "Keep at least one Telegram message field.", 422);
  }
  const value: TelegramSettingValue = {
    ...parsed,
    requestedEnabled: input.requestedEnabled,
    recipientGroupLabel: input.recipientGroupLabel,
    includedFields: fields,
  };
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE site_settings SET value_json = ?, version = version + 1,
      updated_at = ?, updated_by_email = ? WHERE key = ? AND version = ?`,
  ).bind(JSON.stringify(value), now, actor.email, settingKey, input.version).run();
  if (changes(result) !== 1) {
    throw new ApiInputError("VERSION_CONFLICT", "Notification settings changed. Refresh and try again.", 409);
  }
  await writeAudit(env.DB, {
    action: "notifications.telegram.intent.updated",
    result: "SUCCEEDED",
    actor,
    targetType: "SITE_SETTING",
    targetId: settingKey,
    reason: input.reason,
  });
  return getTelegramSettings(env);
}

export function telegramDeliveryInsert(
  db: D1Database,
  settings: AdminTelegramNewOrderSettings,
  input: {
    orderId: string;
    orderNumber: string;
    product: string;
    amount: string;
    currency: string;
    status: string;
    createdAt: string;
    contactChannel: string;
    maskedContact: string;
  },
): D1PreparedStatement | null {
  if (!settings.effectiveEnabled) return null;
  const allValues: OrderNotificationPayload = {
    ORDER_NUMBER: input.orderNumber,
    PRODUCT: input.product,
    AMOUNT: input.amount,
    CURRENCY: input.currency,
    STATUS: input.status,
    CREATED_AT: input.createdAt,
    CONTACT_CHANNEL: input.contactChannel,
    MASKED_CONTACT: input.maskedContact,
  };
  const payload = Object.fromEntries(
    settings.includedFields.map((field) => [field, allValues[field]]),
  );
  return db.prepare(
    `INSERT OR IGNORE INTO telegram_deliveries
      (id, order_id, order_number, event_type, status, payload_json, attempt_count,
       next_attempt_at, delivered_at, telegram_message_id, error_code, created_at, updated_at)
     VALUES (?, ?, ?, 'ORDER_CREATED', 'PENDING', ?, 0, ?, NULL, NULL, NULL, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    input.orderId,
    input.orderNumber,
    JSON.stringify(payload),
    input.createdAt,
    input.createdAt,
    input.createdAt,
  );
}

export async function processTelegramDeliveries(env: SitesEnv, limit = 5): Promise<void> {
  const settings = await getTelegramSettings(env);
  if (!settings.effectiveEnabled) return;
  const token = requiredSecret(env.TELEGRAM_BOT_TOKEN, "TELEGRAM_BOT_TOKEN");
  const chatId = requiredSecret(env.TELEGRAM_ORDER_CHAT_ID, "TELEGRAM_ORDER_CHAT_ID");
  const now = new Date();
  const rows = await env.DB.prepare(
    `SELECT id, order_id AS orderId, order_number AS orderNumber, event_type AS eventType,
      status, payload_json AS payloadJson, attempt_count AS attemptCount,
      next_attempt_at AS nextAttemptAt, delivered_at AS deliveredAt,
      telegram_message_id AS telegramMessageId, error_code AS errorCode,
      created_at AS createdAt, updated_at AS updatedAt
     FROM telegram_deliveries
     WHERE status IN ('PENDING','RETRY_SCHEDULED')
       AND attempt_count < ? AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
     ORDER BY created_at ASC LIMIT ?`,
  ).bind(retryDelaysMs.length, now.toISOString(), limit).all<DeliveryRow>();
  for (const row of rows.results ?? []) {
    const claimAt = new Date().toISOString();
    const claimUntil = new Date(Date.now() + 5 * 60_000).toISOString();
    const claimed = await env.DB.prepare(
      `UPDATE telegram_deliveries SET next_attempt_at = ?, updated_at = ?
       WHERE id = ? AND updated_at = ? AND status IN ('PENDING','RETRY_SCHEDULED')`,
    ).bind(claimUntil, claimAt, row.id, row.updatedAt).run();
    if (changes(claimed) !== 1) continue;
    try {
      const message = await telegramCall<{ message_id: number }>(token, "sendMessage", {
        chat_id: chatId,
        text: formatDeliveryMessage(row.payloadJson),
      });
      const deliveredAt = new Date().toISOString();
      await env.DB.prepare(
        `UPDATE telegram_deliveries SET status = 'DELIVERED',
          attempt_count = attempt_count + 1, next_attempt_at = NULL,
          delivered_at = ?, telegram_message_id = ?, error_code = NULL, updated_at = ?
         WHERE id = ?`,
      ).bind(deliveredAt, String(message.message_id), deliveredAt, row.id).run();
    } catch (error) {
      const attemptCount = row.attemptCount + 1;
      const exhausted = attemptCount >= retryDelaysMs.length;
      const nextAttemptAt = exhausted
        ? null
        : new Date(Date.now() + retryDelaysMs[attemptCount]).toISOString();
      await env.DB.prepare(
        `UPDATE telegram_deliveries SET status = ?, attempt_count = ?,
          next_attempt_at = ?, error_code = ?, updated_at = ? WHERE id = ?`,
      ).bind(
        exhausted ? "FAILED" : "RETRY_SCHEDULED",
        attemptCount,
        nextAttemptAt,
        error instanceof ApiInputError ? error.code : "TELEGRAM_DELIVERY_FAILED",
        new Date().toISOString(),
        row.id,
      ).run();
    }
  }
}

export async function listTelegramDeliveries(db: D1Database): Promise<TelegramDeliveryItem[]> {
  const rows = await db.prepare(
    `SELECT id, order_id AS orderId, order_number AS orderNumber, event_type AS eventType,
      status, attempt_count AS attemptCount, next_attempt_at AS nextAttemptAt,
      delivered_at AS deliveredAt, telegram_message_id AS telegramMessageId,
      error_code AS errorCode, created_at AS createdAt, updated_at AS updatedAt
     FROM telegram_deliveries ORDER BY created_at DESC, id DESC LIMIT 100`,
  ).all<Omit<DeliveryRow, "payloadJson">>();
  return rows.results ?? [];
}

export async function retryTelegramDelivery(
  db: D1Database,
  id: string,
  actor: AdminIdentity,
  reason: string,
): Promise<TelegramDeliveryItem> {
  const now = new Date().toISOString();
  const result = await db.prepare(
    `UPDATE telegram_deliveries SET status = 'PENDING', attempt_count = 0,
      next_attempt_at = ?, error_code = NULL, updated_at = ?
     WHERE id = ? AND status = 'FAILED'`,
  ).bind(now, now, id).run();
  if (changes(result) !== 1) {
    throw new ApiInputError("TELEGRAM_DELIVERY_NOT_RETRYABLE", "The Telegram delivery cannot be retried.", 409);
  }
  await writeAudit(db, {
    action: "notifications.telegram.delivery.retried",
    result: "SUCCEEDED",
    actor,
    targetType: "TELEGRAM_DELIVERY",
    targetId: id,
    reason,
  });
  const items = await listTelegramDeliveries(db);
  const item = items.find((delivery) => delivery.id === id);
  if (!item) throw new ApiInputError("TELEGRAM_DELIVERY_NOT_FOUND", "The Telegram delivery was not found.", 404);
  return item;
}

function parseSetting(value: string | undefined): TelegramSettingValue {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = value ? JSON.parse(value) as Record<string, unknown> : {};
  } catch {
    parsed = {};
  }
  const included = Array.isArray(parsed.includedFields)
    ? parsed.includedFields.map(String)
    : telegramNewOrderFieldCodes;
  return {
    requestedEnabled: parsed.requestedEnabled === true,
    recipientGroupLabel: typeof parsed.recipientGroupLabel === "string"
      ? parsed.recipientGroupLabel.trim().slice(0, 120)
      : "",
    includedFields: telegramNewOrderFieldCodes.filter((field) => included.includes(field)),
    verifiedAt: typeof parsed.verifiedAt === "string" ? parsed.verifiedAt : undefined,
    verifiedChatTitle: typeof parsed.verifiedChatTitle === "string" ? parsed.verifiedChatTitle : undefined,
    botUsername: typeof parsed.botUsername === "string" ? parsed.botUsername : undefined,
    connectionFingerprint: typeof parsed.connectionFingerprint === "string"
      ? parsed.connectionFingerprint
      : undefined,
  };
}

async function telegramCall<T>(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${telegramApiBase}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new ApiInputError("TELEGRAM_NETWORK_FAILED", "Telegram could not be reached.", 502);
  }
  const payload = await response.json().catch(() => null) as {
    ok?: boolean;
    result?: T;
    error_code?: number;
  } | null;
  if (!response.ok || !payload?.ok || !payload.result) {
    const code = payload?.error_code === 429
      ? "TELEGRAM_RATE_LIMITED"
      : response.status === 401
        ? "TELEGRAM_TOKEN_INVALID"
        : "TELEGRAM_API_FAILED";
    throw new ApiInputError(code, "Telegram rejected the request.", 502);
  }
  return payload.result;
}

function formatDeliveryMessage(payloadJson: string): string {
  let payload: Record<string, string> = {};
  try {
    payload = JSON.parse(payloadJson) as Record<string, string>;
  } catch {
    throw new ApiInputError("TELEGRAM_PAYLOAD_INVALID", "The Telegram delivery payload is invalid.", 500);
  }
  const labels: Record<string, string> = {
    ORDER_NUMBER: "订单号",
    PRODUCT: "商品",
    AMOUNT: "金额",
    CURRENCY: "币种",
    STATUS: "状态",
    CREATED_AT: "创建时间",
    CONTACT_CHANNEL: "联系渠道",
    MASKED_CONTACT: "脱敏联系方式",
  };
  const lines = ["CloudBridge 云桥 · 新订单"];
  for (const field of telegramNewOrderFieldCodes) {
    if (payload[field]) lines.push(`${labels[field]}：${payload[field]}`);
  }
  return lines.join("\n");
}

function requiredSecret(value: string | undefined, key: string): string {
  if (!value?.trim()) {
    throw new ApiInputError("TELEGRAM_SECRETS_MISSING", `${key} is not configured.`, 503);
  }
  return value.trim();
}

async function connectionFingerprint(token: string, chatId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${token}\u0000${chatId}`),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function changes(result: D1Result): number {
  return Number(result.meta?.changes ?? result.meta?.rows_written ?? 0);
}
