import {
  classifySecurityAuditEvent,
  type AuditEventResult,
  type SystemAlertSource,
} from "@cloudbridge/contracts";
import { formatChinaDateTime } from "./time";
import type {
  D1Database,
  D1PreparedStatement,
} from "./types";

export type SystemAlertMessagePayload = {
  facts: ReadonlyArray<{
    label: string;
    value: string;
  }>;
};

type AlertInsertInput = {
  id?: string;
  dedupeKey: string;
  source: SystemAlertSource;
  eventType: "SECURITY_SIGNAL" | "BACKUP_FAILURE" | "BACKUP_STALE" | "DELIVERY_TEST";
  severity: "HIGH" | "MEDIUM";
  subjectType: string;
  subjectId: string;
  title: Readonly<Record<"zh" | "en", string>>;
  summary: Readonly<Record<"zh" | "en", string>>;
  payload: SystemAlertMessagePayload;
  createdAt: string;
};

export function systemAlertDeliveryInsert(
  db: D1Database,
  input: AlertInsertInput,
): D1PreparedStatement {
  return db.prepare(
    `INSERT OR IGNORE INTO system_alert_deliveries
      (id, dedupe_key, source, event_type, severity, status, subject_type,
       subject_id, title_zh, title_en, summary_zh, summary_en, payload_json,
       attempt_count, next_attempt_at, delivered_at, telegram_message_id,
       error_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL, NULL, ?, ?)`,
  ).bind(
    input.id ?? crypto.randomUUID(),
    input.dedupeKey,
    input.source,
    input.eventType,
    input.severity,
    input.subjectType,
    input.subjectId,
    input.title.zh,
    input.title.en,
    input.summary.zh,
    input.summary.en,
    JSON.stringify(input.payload),
    input.createdAt,
    input.createdAt,
    input.createdAt,
  );
}

export function securityAlertDeliveryInsert(
  db: D1Database,
  input: {
    auditId: string;
    action: string;
    result: AuditEventResult;
    targetType: string | null;
    targetId: string | null;
    createdAt: string;
  },
): D1PreparedStatement | null {
  const classification = classifySecurityAuditEvent(input.action, input.result);
  if (!classification?.needsReview) return null;
  const subjectType = input.targetType ?? "SYSTEM";
  const shortAuditId = shortIdentifier(input.auditId);
  return systemAlertDeliveryInsert(db, {
    dedupeKey: `security:${input.auditId}`,
    source: "SECURITY",
    eventType: "SECURITY_SIGNAL",
    severity: "HIGH",
    subjectType,
    subjectId: input.auditId,
    title: {
      zh: "高优先级安全审计信号",
      en: "High-priority security audit signal",
    },
    summary: {
      zh: `${input.action} · ${input.result} · ${subjectType}`,
      en: `${input.action} · ${input.result} · ${subjectType}`,
    },
    payload: {
      facts: [
        { label: "事件", value: input.action },
        { label: "结果", value: input.result },
        { label: "范围", value: classification.category },
        { label: "目标类型", value: subjectType },
        { label: "审计 ID", value: shortAuditId },
        { label: "时间", value: formatChinaDateTime(input.createdAt) },
      ],
    },
    createdAt: input.createdAt,
  });
}

export function backupAlertDeliveryInsert(
  db: D1Database,
  input: {
    dedupeKey: string;
    eventType: "BACKUP_FAILURE" | "BACKUP_STALE";
    backupId: string;
    errorCode: string;
    createdAt: string;
  },
): D1PreparedStatement {
  const stale = input.eventType === "BACKUP_STALE";
  return systemAlertDeliveryInsert(db, {
    dedupeKey: input.dedupeKey,
    source: "BACKUP",
    eventType: input.eventType,
    severity: "HIGH",
    subjectType: "BACKUP",
    subjectId: input.backupId,
    title: stale
      ? { zh: "备份创建超时", en: "Backup creation is stale" }
      : { zh: "备份创建失败", en: "Backup creation failed" },
    summary: {
      zh: `${input.errorCode} · 备份 ${shortIdentifier(input.backupId)}`,
      en: `${input.errorCode} · Backup ${shortIdentifier(input.backupId)}`,
    },
    payload: {
      facts: [
        { label: "事件", value: input.eventType },
        { label: "错误码", value: input.errorCode },
        { label: "备份 ID", value: shortIdentifier(input.backupId) },
        { label: "时间", value: formatChinaDateTime(input.createdAt) },
      ],
    },
    createdAt: input.createdAt,
  });
}

export function systemAlertTestInsert(
  db: D1Database,
  input: {
    id: string;
    source: SystemAlertSource;
    createdAt: string;
  },
): D1PreparedStatement {
  const scope = input.source === "SECURITY" ? "安全事件" : "备份异常";
  const scopeEn = input.source === "SECURITY" ? "security events" : "backup exceptions";
  return systemAlertDeliveryInsert(db, {
    id: input.id,
    dedupeKey: `test:${input.source}:${input.id}`,
    source: input.source,
    eventType: "DELIVERY_TEST",
    severity: "MEDIUM",
    subjectType: "SYSTEM_ALERT_CHANNEL",
    subjectId: input.id,
    title: {
      zh: `${scope}告警通道测试`,
      en: `${scopeEn} alert-channel test`,
    },
    summary: {
      zh: "该消息不代表发生了真实异常。",
      en: "This message does not represent a real incident.",
    },
    payload: {
      facts: [
        { label: "事件", value: "DELIVERY_TEST" },
        { label: "范围", value: input.source },
        { label: "测试 ID", value: shortIdentifier(input.id) },
        { label: "时间", value: formatChinaDateTime(input.createdAt) },
      ],
    },
    createdAt: input.createdAt,
  });
}

function shortIdentifier(value: string): string {
  const normalized = value.trim();
  return normalized.length > 12 ? normalized.slice(0, 12) : normalized;
}
