export const AUDIT_CSV_EXPORT_LIMIT = 5_000;
export const AUDIT_CSV_EXPORT_CONFIRMATION = "EXPORT_AUDIT_CSV";

export const securityEventCategories = [
  "authentication",
  "authorization",
  "sensitive-data",
  "configuration",
] as const;
export type SecurityEventCategory = (typeof securityEventCategories)[number];

export const securityEventSeverities = ["high", "medium", "low"] as const;
export type SecurityEventSeverity = (typeof securityEventSeverities)[number];

export type AuditEventResult = "SUCCEEDED" | "FAILED" | "DENIED";

export type SecurityAuditClassification = {
  category: SecurityEventCategory;
  severity: SecurityEventSeverity;
  needsReview: boolean;
};

type SecurityAuditActionProfile = {
  category: SecurityEventCategory;
  defaultSeverity: SecurityEventSeverity;
  label: Readonly<Record<"zh" | "en", string>>;
};

export const securityAuditActionProfiles: Readonly<Record<string, SecurityAuditActionProfile>> = {
  "auth.setup.complete": {
    category: "authorization",
    defaultSeverity: "medium",
    label: { zh: "首位管理员创建", en: "First administrator created" },
  },
  "auth.sites.bootstrap": {
    category: "authorization",
    defaultSeverity: "medium",
    label: { zh: "Sites 管理员授权", en: "Sites administrator authorized" },
  },
  "auth.login.password": {
    category: "authentication",
    defaultSeverity: "low",
    label: { zh: "密码登录成功", en: "Password sign-in succeeded" },
  },
  "auth.login.totp": {
    category: "authentication",
    defaultSeverity: "low",
    label: { zh: "双重验证登录成功", en: "Two-factor sign-in succeeded" },
  },
  "auth.login.failed": {
    category: "authentication",
    defaultSeverity: "high",
    label: { zh: "管理员登录失败", en: "Administrator sign-in failed" },
  },
  "auth.totp.enabled": {
    category: "authentication",
    defaultSeverity: "low",
    label: { zh: "双重验证已开启", en: "Two-factor authentication enabled" },
  },
  "auth.totp.disabled": {
    category: "authentication",
    defaultSeverity: "medium",
    label: { zh: "双重验证已关闭", en: "Two-factor authentication disabled" },
  },
  "auth.session.revoked": {
    category: "authentication",
    defaultSeverity: "medium",
    label: { zh: "后台会话已撤销", en: "Administrator session revoked" },
  },
  "auth.sessions.others_revoked": {
    category: "authentication",
    defaultSeverity: "medium",
    label: { zh: "其他后台会话已撤销", en: "Other administrator sessions revoked" },
  },
  "team.member.roles.update": {
    category: "authorization",
    defaultSeverity: "medium",
    label: { zh: "成员角色已变更", en: "Member roles changed" },
  },
  "team.member.enabled": {
    category: "authorization",
    defaultSeverity: "medium",
    label: { zh: "管理员账号已启用", en: "Administrator account enabled" },
  },
  "team.member.disabled": {
    category: "authorization",
    defaultSeverity: "medium",
    label: { zh: "管理员账号已停用", en: "Administrator account disabled" },
  },
  "team.member.unlocked": {
    category: "authorization",
    defaultSeverity: "medium",
    label: { zh: "管理员账号已解锁", en: "Administrator account unlocked" },
  },
  "team.member.totp_reset": {
    category: "authentication",
    defaultSeverity: "medium",
    label: { zh: "成员双重验证已重置", en: "Member two-factor authentication reset" },
  },
  "access.role.created": {
    category: "authorization",
    defaultSeverity: "medium",
    label: { zh: "角色已创建", en: "Role created" },
  },
  "access.role.deleted": {
    category: "authorization",
    defaultSeverity: "medium",
    label: { zh: "角色已删除", en: "Role deleted" },
  },
  "access.role.metadata.update": {
    category: "authorization",
    defaultSeverity: "medium",
    label: { zh: "角色资料已变更", en: "Role metadata changed" },
  },
  "access.role.permissions.update": {
    category: "authorization",
    defaultSeverity: "medium",
    label: { zh: "角色权限已变更", en: "Role permissions changed" },
  },
  "order.contact.reveal": {
    category: "sensitive-data",
    defaultSeverity: "medium",
    label: { zh: "订单联系方式查看", en: "Order contact revealed" },
  },
  "order.contact.revealed": {
    category: "sensitive-data",
    defaultSeverity: "medium",
    label: { zh: "订单联系方式查看", en: "Order contact revealed" },
  },
  "audit.export.csv": {
    category: "sensitive-data",
    defaultSeverity: "medium",
    label: { zh: "审计记录已导出", en: "Audit records exported" },
  },
  "site_setting.update": {
    category: "configuration",
    defaultSeverity: "medium",
    label: { zh: "站点关键设置已变更", en: "Critical site settings changed" },
  },
  "settings.storefront.updated": {
    category: "configuration",
    defaultSeverity: "medium",
    label: { zh: "站点关键设置已变更", en: "Critical site settings changed" },
  },
  "merchant_channel.update": {
    category: "configuration",
    defaultSeverity: "medium",
    label: { zh: "客服渠道已变更", en: "Support channel changed" },
  },
  "support.channel.updated": {
    category: "configuration",
    defaultSeverity: "medium",
    label: { zh: "客服渠道已变更", en: "Support channel changed" },
  },
  "telegram.new_order.settings.update": {
    category: "configuration",
    defaultSeverity: "medium",
    label: { zh: "Telegram 通知意向已变更", en: "Telegram notification intent changed" },
  },
  "notifications.telegram.intent.updated": {
    category: "configuration",
    defaultSeverity: "medium",
    label: { zh: "Telegram 通知意向已变更", en: "Telegram notification intent changed" },
  },
};

export const securityAuditActions = Object.freeze(
  Object.keys(securityAuditActionProfiles),
);

export const securityAuditActionsForCategory = (
  category: SecurityEventCategory,
): string[] => securityAuditActions.filter(
  (action) => securityAuditActionProfiles[action]?.category === category,
);

export const securityAuditActionsForDefaultSeverity = (
  severity: SecurityEventSeverity,
): string[] => securityAuditActions.filter(
  (action) => securityAuditActionProfiles[action]?.defaultSeverity === severity,
);

export function classifySecurityAuditEvent(
  action: string,
  result: AuditEventResult,
): SecurityAuditClassification | null {
  const profile = securityAuditActionProfiles[action];
  if (!profile && result !== "DENIED") return null;
  const severity = result === "DENIED" || result === "FAILED"
    ? "high"
    : profile?.defaultSeverity ?? "medium";
  return {
    category: profile?.category ?? "authorization",
    severity,
    needsReview: severity === "high",
  };
}

export type SecurityAuditSummary = {
  total: number;
  last24Hours: number;
  needsReview: number;
  deniedOrFailed: number;
};

export type AuditCsvRow = {
  id: string;
  requestId: string;
  createdAt: string;
  action: string;
  actorDisplayName: string | null;
  actorEmail: string | null;
  targetType: string;
  targetId: string | null;
  result: AuditEventResult;
  reason: string | null;
};

const auditCsvColumns: ReadonlyArray<{
  header: string;
  value: (row: AuditCsvRow) => string;
}> = [
  { header: "event_id", value: (row) => row.id },
  { header: "request_id", value: (row) => row.requestId },
  { header: "created_at", value: (row) => row.createdAt },
  { header: "action", value: (row) => row.action },
  { header: "actor_name", value: (row) => row.actorDisplayName ?? "" },
  { header: "actor_email", value: (row) => row.actorEmail ?? "" },
  { header: "target_type", value: (row) => row.targetType },
  { header: "target_id", value: (row) => row.targetId ?? "" },
  { header: "result", value: (row) => row.result },
  { header: "reason", value: (row) => row.reason ?? "" },
];

const spreadsheetFormulaPrefix = /^[\t ]*[=+\-@]/u;

const csvCell = (input: string): string => {
  const safe = spreadsheetFormulaPrefix.test(input) ? `'${input}` : input;
  return `"${safe.replaceAll("\"", "\"\"")}"`;
};

export function serializeAuditCsv(rows: readonly AuditCsvRow[]): string {
  const header = auditCsvColumns.map((column) => csvCell(column.header)).join(",");
  const body = rows.map((row) => (
    auditCsvColumns.map((column) => csvCell(column.value(row))).join(",")
  ));
  return `\uFEFF${[header, ...body].join("\r\n")}\r\n`;
}

export function auditCsvFilename(now = new Date()): string {
  const stamp = now.toISOString()
    .replace(/\.\d{3}Z$/u, "Z")
    .replaceAll(":", "")
    .replace("T", "-");
  return `cloudbridge-audit-${stamp}.csv`;
}
