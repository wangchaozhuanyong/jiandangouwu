import type {
  AuditEvent,
  Locale,
} from "../../api";

export const securityEventSeverities = ["high", "medium", "low"] as const;
export type SecurityEventSeverity = (typeof securityEventSeverities)[number];

export const securityEventCategories = [
  "authentication",
  "authorization",
  "sensitive-data",
  "configuration",
] as const;
export type SecurityEventCategory = (typeof securityEventCategories)[number];

export type SecurityEvent = AuditEvent & {
  category: SecurityEventCategory;
  severity: SecurityEventSeverity;
  needsReview: boolean;
};

export type SecurityEventFilter = {
  category: "all" | SecurityEventCategory;
  result: "all" | AuditEvent["result"];
  search: string;
  severity: "all" | SecurityEventSeverity;
  timeRange: "24h" | "7d" | "30d" | "all";
};

type SecurityActionProfile = {
  category: SecurityEventCategory;
  defaultSeverity: SecurityEventSeverity;
  label: Record<Locale, string>;
};

const securityActionProfiles: Record<string, SecurityActionProfile> = {
  "auth.setup.complete": {
    category: "authorization",
    defaultSeverity: "medium",
    label: { zh: "首位管理员创建", en: "First administrator created" },
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
  "team.member.roles.update": {
    category: "authorization",
    defaultSeverity: "medium",
    label: { zh: "成员角色已变更", en: "Member roles changed" },
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
  "site_setting.update": {
    category: "configuration",
    defaultSeverity: "medium",
    label: { zh: "站点关键设置已变更", en: "Critical site settings changed" },
  },
  "telegram.new_order.settings.update": {
    category: "configuration",
    defaultSeverity: "medium",
    label: { zh: "Telegram 通知意向已变更", en: "Telegram notification intent changed" },
  },
};

const normalized = (value: string): string =>
  value.normalize("NFKC").toLocaleLowerCase().trim();

const eventTimestamp = (event: Pick<AuditEvent, "createdAt">): number => {
  const timestamp = Date.parse(event.createdAt);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
};

export function securityActionLabel(action: string, locale: Locale): string {
  return securityActionProfiles[action]?.label[locale] ?? action;
}

export function toSecurityEvent(event: AuditEvent): SecurityEvent | null {
  const profile = securityActionProfiles[event.action];
  if (!profile && event.result !== "DENIED") return null;
  const category = profile?.category ?? "authorization";
  const severity = event.result === "DENIED" || event.result === "FAILED"
    ? "high"
    : profile?.defaultSeverity ?? "medium";
  return {
    ...event,
    category,
    severity,
    needsReview: severity === "high",
  };
}

export function buildSecurityEvents(events: AuditEvent[]): SecurityEvent[] {
  return events
    .map(toSecurityEvent)
    .filter((event): event is SecurityEvent => event !== null)
    .sort((left, right) => eventTimestamp(right) - eventTimestamp(left));
}

export function filterSecurityEvents(
  events: SecurityEvent[],
  filter: SecurityEventFilter,
  now = Date.now(),
): SecurityEvent[] {
  const timeRangeMs = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  } as const;
  const query = normalized(filter.search);
  const oldestAllowed = filter.timeRange === "all"
    ? Number.NEGATIVE_INFINITY
    : now - timeRangeMs[filter.timeRange];

  return events.filter((event) => {
    if (filter.category !== "all" && event.category !== filter.category) return false;
    if (filter.result !== "all" && event.result !== filter.result) return false;
    if (filter.severity !== "all" && event.severity !== filter.severity) return false;
    if (eventTimestamp(event) < oldestAllowed) return false;
    if (!query) return true;
    return normalized([
      event.id,
      event.requestId,
      event.action,
      event.targetType,
      event.targetId ?? "",
      event.reason ?? "",
      event.actor?.displayName ?? "",
      event.actor?.email ?? "",
    ].join(" ")).includes(query);
  });
}

export function summarizeSecurityEvents(
  events: SecurityEvent[],
  now = Date.now(),
): {
  total: number;
  last24Hours: number;
  needsReview: number;
  deniedOrFailed: number;
} {
  const dayAgo = now - 24 * 60 * 60 * 1000;
  return {
    total: events.length,
    last24Hours: events.filter((event) => eventTimestamp(event) >= dayAgo).length,
    needsReview: events.filter((event) => event.needsReview).length,
    deniedOrFailed: events.filter((event) => event.result !== "SUCCEEDED").length,
  };
}
