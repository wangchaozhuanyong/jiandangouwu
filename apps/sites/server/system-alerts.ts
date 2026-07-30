import {
  systemAlertSources,
  type SystemAlertDeliveriesResponse,
  type SystemAlertDeliveryItem,
  type SystemAlertReadiness,
  type SystemAlertSource,
} from "@cloudbridge/contracts";
import {
  ApiInputError,
  writeAudit,
  type AdminIdentity,
} from "./http";
import {
  systemAlertTestInsert,
  type SystemAlertMessagePayload,
} from "./system-alert-core";
import {
  getTelegramSettings,
  sendVerifiedTelegramMessage,
} from "./telegram";
import type {
  D1Database,
  D1Result,
  SitesEnv,
} from "./types";

const retryDelaysMs = [
  0,
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  12 * 60 * 60_000,
] as const;

type SystemAlertRow = {
  id: string;
  source: SystemAlertDeliveryItem["source"];
  eventType: SystemAlertDeliveryItem["eventType"];
  severity: SystemAlertDeliveryItem["severity"];
  status: SystemAlertDeliveryItem["status"];
  subjectType: string;
  subjectId: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  payloadJson: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  telegramMessageId: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listSystemAlertDeliveries(
  env: SitesEnv,
  source?: SystemAlertSource,
): Promise<SystemAlertDeliveriesResponse> {
  const items = await readSystemAlertDeliveries(env.DB, source);
  return {
    items,
    readiness: await getSystemAlertReadiness(env, source),
  };
}

export async function processSystemAlertDeliveries(
  env: SitesEnv,
  limit = 5,
  onlyId?: string,
): Promise<void> {
  const settings = await getTelegramSettings(env);
  if (!settings.effectiveEnabled) return;
  const now = new Date();
  const idCondition = onlyId ? " AND id = ?" : "";
  const bindings: unknown[] = [
    retryDelaysMs.length,
    now.toISOString(),
    ...(onlyId ? [onlyId] : []),
    limit,
  ];
  const rows = await env.DB.prepare(
    `SELECT id, source, event_type AS eventType, severity, status,
      subject_type AS subjectType, subject_id AS subjectId,
      title_zh AS titleZh, title_en AS titleEn,
      summary_zh AS summaryZh, summary_en AS summaryEn,
      payload_json AS payloadJson, attempt_count AS attemptCount,
      next_attempt_at AS nextAttemptAt, delivered_at AS deliveredAt,
      telegram_message_id AS telegramMessageId, error_code AS errorCode,
      created_at AS createdAt, updated_at AS updatedAt
     FROM system_alert_deliveries
     WHERE status IN ('PENDING','RETRY_SCHEDULED')
       AND attempt_count < ? AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
       ${idCondition}
     ORDER BY created_at ASC LIMIT ?`,
  ).bind(...bindings).all<SystemAlertRow>();
  for (const row of rows.results ?? []) {
    const claimAt = new Date().toISOString();
    const claimUntil = new Date(Date.now() + 5 * 60_000).toISOString();
    const claimed = await env.DB.prepare(
      `UPDATE system_alert_deliveries SET next_attempt_at = ?, updated_at = ?
       WHERE id = ? AND updated_at = ? AND status IN ('PENDING','RETRY_SCHEDULED')`,
    ).bind(claimUntil, claimAt, row.id, row.updatedAt).run();
    if (changes(claimed) !== 1) continue;
    try {
      const message = await sendVerifiedTelegramMessage(
        env,
        formatSystemAlertMessage(row),
      );
      const deliveredAt = new Date().toISOString();
      await env.DB.prepare(
        `UPDATE system_alert_deliveries SET status = 'DELIVERED',
          attempt_count = attempt_count + 1, next_attempt_at = NULL,
          delivered_at = ?, telegram_message_id = ?, error_code = NULL,
          updated_at = ? WHERE id = ?`,
      ).bind(
        deliveredAt,
        String(message.message_id),
        deliveredAt,
        row.id,
      ).run();
    } catch (error) {
      const attemptCount = row.attemptCount + 1;
      const exhausted = attemptCount >= retryDelaysMs.length;
      const nextAttemptAt = exhausted
        ? null
        : new Date(Date.now() + retryDelaysMs[attemptCount]).toISOString();
      await env.DB.prepare(
        `UPDATE system_alert_deliveries SET status = ?, attempt_count = ?,
          next_attempt_at = ?, error_code = ?, updated_at = ? WHERE id = ?`,
      ).bind(
        exhausted ? "FAILED" : "RETRY_SCHEDULED",
        attemptCount,
        nextAttemptAt,
        error instanceof ApiInputError ? error.code : "SYSTEM_ALERT_DELIVERY_FAILED",
        new Date().toISOString(),
        row.id,
      ).run();
    }
  }
}

export async function createSystemAlertDeliveryTest(
  env: SitesEnv,
  source: SystemAlertSource,
  actor: AdminIdentity,
  reason: string,
): Promise<SystemAlertDeliveryItem> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await systemAlertTestInsert(env.DB, { id, source, createdAt }).run();
  await writeAudit(env.DB, {
    action: "notifications.system-alert.test.requested",
    result: "SUCCEEDED",
    actor,
    targetType: "SYSTEM_ALERT_CHANNEL",
    targetId: id,
    reason,
  });
  await processSystemAlertDeliveries(env, 1, id);
  return requireSystemAlertDelivery(env.DB, id);
}

export async function retrySystemAlertDelivery(
  env: SitesEnv,
  id: string,
  actor: AdminIdentity,
  reason: string,
): Promise<SystemAlertDeliveryItem> {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE system_alert_deliveries SET status = 'PENDING', attempt_count = 0,
      next_attempt_at = ?, error_code = NULL, updated_at = ?
     WHERE id = ? AND status = 'FAILED'`,
  ).bind(now, now, id).run();
  if (changes(result) !== 1) {
    throw new ApiInputError(
      "SYSTEM_ALERT_DELIVERY_NOT_RETRYABLE",
      "The system alert delivery cannot be retried.",
      409,
    );
  }
  await writeAudit(env.DB, {
    action: "notifications.system-alert.delivery.retried",
    result: "SUCCEEDED",
    actor,
    targetType: "SYSTEM_ALERT_DELIVERY",
    targetId: id,
    reason,
  });
  await processSystemAlertDeliveries(env, 1, id);
  return requireSystemAlertDelivery(env.DB, id);
}

export function parseSystemAlertSource(value: string | null): SystemAlertSource | undefined {
  return systemAlertSources.includes(value as SystemAlertSource)
    ? value as SystemAlertSource
    : undefined;
}

export async function getSystemAlertReadiness(
  env: SitesEnv,
  source?: SystemAlertSource,
): Promise<SystemAlertReadiness> {
  const settings = await getTelegramSettings(env);
  const condition = source ? " WHERE source = ?" : "";
  const bindings = source ? [source] : [];
  const [counts, lastDelivery] = await Promise.all([
    env.DB.prepare(
      `SELECT
        SUM(CASE WHEN status IN ('PENDING','RETRY_SCHEDULED') THEN 1 ELSE 0 END) AS pendingCount,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failedCount,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) AS deliveredCount
       FROM system_alert_deliveries${condition}`,
    ).bind(...bindings).first<{
      pendingCount: number | null;
      failedCount: number | null;
      deliveredCount: number | null;
    }>(),
    env.DB.prepare(
      `SELECT delivered_at AS deliveredAt FROM system_alert_deliveries
       ${source ? "WHERE source = ? AND status = 'DELIVERED'" : "WHERE status = 'DELIVERED'"}
       ORDER BY delivered_at DESC LIMIT 1`,
    ).bind(...bindings).first<{ deliveredAt: string }>(),
  ]);
  const connectionState = settings.connectionState === "MISSING_SECRETS"
    ? "MISSING_SECRETS"
    : settings.connectionState !== "CONNECTED"
      ? "UNVERIFIED"
      : !settings.effectiveEnabled
        ? "DISABLED"
        : "CONNECTED";
  return {
    connectionState,
    configuredChannels: connectionState === "CONNECTED" ? 1 : 0,
    recipientGroupLabel: settings.recipientGroupLabel,
    verifiedAt: settings.verifiedAt,
    pendingCount: Number(counts?.pendingCount ?? 0),
    failedCount: Number(counts?.failedCount ?? 0),
    deliveredCount: Number(counts?.deliveredCount ?? 0),
    lastDeliveryVerifiedAt: lastDelivery?.deliveredAt ?? null,
  };
}

async function readSystemAlertDeliveries(
  db: D1Database,
  source?: SystemAlertSource,
): Promise<SystemAlertDeliveryItem[]> {
  const condition = source ? " WHERE source = ?" : "";
  const rows = await db.prepare(
    `SELECT id, source, event_type AS eventType, severity, status,
      subject_type AS subjectType, subject_id AS subjectId,
      title_zh AS titleZh, title_en AS titleEn,
      summary_zh AS summaryZh, summary_en AS summaryEn,
      payload_json AS payloadJson, attempt_count AS attemptCount,
      next_attempt_at AS nextAttemptAt, delivered_at AS deliveredAt,
      telegram_message_id AS telegramMessageId, error_code AS errorCode,
      created_at AS createdAt, updated_at AS updatedAt
     FROM system_alert_deliveries${condition}
     ORDER BY created_at DESC, id DESC LIMIT 100`,
  ).bind(...(source ? [source] : [])).all<SystemAlertRow>();
  return (rows.results ?? []).map(alertItem);
}

async function requireSystemAlertDelivery(
  db: D1Database,
  id: string,
): Promise<SystemAlertDeliveryItem> {
  const row = await db.prepare(
    `SELECT id, source, event_type AS eventType, severity, status,
      subject_type AS subjectType, subject_id AS subjectId,
      title_zh AS titleZh, title_en AS titleEn,
      summary_zh AS summaryZh, summary_en AS summaryEn,
      payload_json AS payloadJson, attempt_count AS attemptCount,
      next_attempt_at AS nextAttemptAt, delivered_at AS deliveredAt,
      telegram_message_id AS telegramMessageId, error_code AS errorCode,
      created_at AS createdAt, updated_at AS updatedAt
     FROM system_alert_deliveries WHERE id = ? LIMIT 1`,
  ).bind(id).first<SystemAlertRow>();
  if (!row) {
    throw new ApiInputError(
      "SYSTEM_ALERT_DELIVERY_NOT_FOUND",
      "The system alert delivery was not found.",
      404,
    );
  }
  return alertItem(row);
}

function alertItem(row: SystemAlertRow): SystemAlertDeliveryItem {
  return {
    id: row.id,
    source: row.source,
    eventType: row.eventType,
    severity: row.severity,
    status: row.status,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    title: { zh: row.titleZh, en: row.titleEn },
    summary: { zh: row.summaryZh, en: row.summaryEn },
    attemptCount: row.attemptCount,
    nextAttemptAt: row.nextAttemptAt,
    deliveredAt: row.deliveredAt,
    telegramMessageId: row.telegramMessageId,
    errorCode: row.errorCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function formatSystemAlertMessage(row: SystemAlertRow): string {
  const payload = parsePayload(row.payloadJson);
  return [
    "CloudBridge 云桥",
    `${row.severity === "HIGH" ? "⚠️" : "ℹ️"} ${row.titleZh}`,
    row.summaryZh,
    ...payload.facts.map((fact) => `${fact.label}：${fact.value}`),
    "该消息仅含脱敏运维元数据，请在 CloudBridge 后台查看完整审计记录。",
  ].join("\n");
}

function parsePayload(value: string): SystemAlertMessagePayload {
  try {
    const parsed = JSON.parse(value) as Partial<SystemAlertMessagePayload>;
    if (!Array.isArray(parsed.facts)) return { facts: [] };
    return {
      facts: parsed.facts.flatMap((fact) => (
        fact
        && typeof fact === "object"
        && typeof fact.label === "string"
        && typeof fact.value === "string"
          ? [{ label: fact.label.slice(0, 80), value: fact.value.slice(0, 240) }]
          : []
      )).slice(0, 8),
    };
  } catch {
    return { facts: [] };
  }
}

function changes(result: D1Result): number {
  return Number(result.meta?.changes ?? result.meta?.rows_written ?? 0);
}
