import type {
  AuditEvent,
  AuditEventQuery,
  Locale,
} from "../../api";

export type AuditEventFilter = {
  actor: "all" | "administrator" | "system";
  result: "all" | AuditEvent["result"];
  search: string;
  targetType: "all" | string;
  timeRange: "24h" | "7d" | "30d" | "all";
};

export const defaultAuditEventQuery: Readonly<AuditEventQuery> = {
  page: 1,
  pageSize: 30,
  timeRange: "30d",
};

const actionLabels: Record<string, Record<Locale, string>> = {
  "access.role.permissions.update": { zh: "角色权限已更新", en: "Role permissions updated" },
  "auth.login.failed": { zh: "管理员登录失败", en: "Administrator sign-in failed" },
  "auth.login.password": { zh: "密码登录成功", en: "Password sign-in succeeded" },
  "auth.login.totp": { zh: "双重验证登录成功", en: "Two-factor sign-in succeeded" },
  "auth.session.revoked": { zh: "后台会话已撤销", en: "Administrator session revoked" },
  "auth.sessions.others_revoked": { zh: "其他后台会话已撤销", en: "Other administrator sessions revoked" },
  "auth.setup.complete": { zh: "首位管理员已创建", en: "First administrator created" },
  "auth.totp.disabled": { zh: "双重验证已关闭", en: "Two-factor authentication disabled" },
  "auth.totp.enabled": { zh: "双重验证已开启", en: "Two-factor authentication enabled" },
  "category.create": { zh: "分类已创建", en: "Category created" },
  "category.update": { zh: "分类已更新", en: "Category updated" },
  "currency.rate.update": { zh: "汇率已更新", en: "Exchange rate updated" },
  "hero.create": { zh: "首页轮播已创建", en: "Hero slide created" },
  "hero.order.update": { zh: "首页轮播顺序已更新", en: "Hero order updated" },
  "hero.update": { zh: "首页轮播已更新", en: "Hero slide updated" },
  "merchant_channel.order.update": { zh: "客服渠道顺序已更新", en: "Support channel order updated" },
  "merchant_channel.update": { zh: "客服渠道已更新", en: "Support channel updated" },
  "order.assignment.update": { zh: "订单负责人已更新", en: "Order assignee updated" },
  "order.contact.reveal": { zh: "订单联系方式已查看", en: "Order contact revealed" },
  "order.status.update": { zh: "订单状态已更新", en: "Order status updated" },
  "product.create": { zh: "商品已创建", en: "Product created" },
  "product.update": { zh: "商品已更新", en: "Product updated" },
  "site_setting.update": { zh: "网站设置已更新", en: "Site setting updated" },
  "team.member.roles.update": { zh: "成员角色已更新", en: "Member roles updated" },
  "telegram.new_order.settings.update": { zh: "Telegram 通知意向已更新", en: "Telegram notification intent updated" },
};

const normalized = (value: string): string =>
  value.normalize("NFKC").toLocaleLowerCase().trim();

const eventTimestamp = (event: Pick<AuditEvent, "createdAt">): number => {
  const timestamp = Date.parse(event.createdAt);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
};

export function auditActionLabel(action: string, locale: Locale): string {
  return actionLabels[action]?.[locale] ?? action;
}

export function sortAuditEvents(events: AuditEvent[]): AuditEvent[] {
  return [...events].sort((left, right) => {
    const timeDifference = eventTimestamp(right) - eventTimestamp(left);
    return timeDifference || right.id.localeCompare(left.id);
  });
}

export function auditTargetTypes(events: AuditEvent[]): string[] {
  return [...new Set(events.map((event) => event.targetType).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

export function readAuditQuery(search: string): AuditEventQuery {
  const params = new URLSearchParams(search);
  const pageValue = Number(params.get("page") ?? "1");
  const resultValue = params.get("result");
  const actorValue = params.get("actor");
  const timeRangeValue = params.get("timeRange");
  const searchValue = params.get("search")?.normalize("NFKC").trim().slice(0, 160);
  const targetTypeValue = params.get("targetType")?.normalize("NFKC").trim().slice(0, 80);
  return {
    page: Number.isSafeInteger(pageValue) && pageValue >= 1 && pageValue <= 1000
      ? pageValue
      : 1,
    pageSize: 30,
    ...(searchValue ? { search: searchValue } : {}),
    ...(resultValue && ["SUCCEEDED", "FAILED", "DENIED"].includes(resultValue)
      ? { result: resultValue as AuditEvent["result"] }
      : {}),
    ...(actorValue === "administrator" || actorValue === "system"
      ? { actor: actorValue }
      : {}),
    ...(targetTypeValue ? { targetType: targetTypeValue } : {}),
    timeRange: timeRangeValue && ["24h", "7d", "30d", "all"].includes(timeRangeValue)
      ? timeRangeValue as AuditEventFilter["timeRange"]
      : "30d",
  };
}

export function auditQuerySearch(query: AuditEventQuery): string {
  const params = new URLSearchParams();
  if (query.page > 1) params.set("page", String(query.page));
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.result) params.set("result", query.result);
  if (query.actor) params.set("actor", query.actor);
  if (query.targetType?.trim()) params.set("targetType", query.targetType.trim());
  if (query.timeRange && query.timeRange !== "30d") {
    params.set("timeRange", query.timeRange);
  }
  return params.toString();
}

export function auditFilterFromQuery(query: AuditEventQuery): AuditEventFilter {
  return {
    actor: query.actor ?? "all",
    result: query.result ?? "all",
    search: query.search ?? "",
    targetType: query.targetType ?? "all",
    timeRange: query.timeRange ?? "30d",
  };
}

export function auditQueryFromFilter(filter: AuditEventFilter): AuditEventQuery {
  return {
    page: 1,
    pageSize: 30,
    ...(filter.search.trim() ? { search: filter.search.trim().slice(0, 160) } : {}),
    ...(filter.result !== "all" ? { result: filter.result } : {}),
    ...(filter.actor !== "all" ? { actor: filter.actor } : {}),
    ...(filter.targetType !== "all"
      ? { targetType: filter.targetType.trim().slice(0, 80) }
      : {}),
    timeRange: filter.timeRange,
  };
}

export function filterAuditEvents(
  events: AuditEvent[],
  filter: AuditEventFilter,
  now = Date.now(),
): AuditEvent[] {
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
    if (filter.actor === "administrator" && !event.actor) return false;
    if (filter.actor === "system" && event.actor) return false;
    if (filter.result !== "all" && event.result !== filter.result) return false;
    if (filter.targetType !== "all" && event.targetType !== filter.targetType) return false;
    if (eventTimestamp(event) < oldestAllowed) return false;
    if (!query) return true;
    return normalized([
      event.id,
      event.requestId,
      event.action,
      auditActionLabel(event.action, "zh"),
      auditActionLabel(event.action, "en"),
      event.targetType,
      event.targetId ?? "",
      event.reason ?? "",
      event.actor?.displayName ?? "",
      event.actor?.email ?? "",
    ].join(" ")).includes(query);
  });
}

export function summarizeAuditEvents(
  events: AuditEvent[],
  totalAvailable: number,
  now = Date.now(),
): {
  deniedOrFailed: number;
  last24Hours: number;
  loaded: number;
  totalAvailable: number;
} {
  const dayAgo = now - 24 * 60 * 60 * 1000;
  return {
    deniedOrFailed: events.filter((event) => event.result !== "SUCCEEDED").length,
    last24Hours: events.filter((event) => eventTimestamp(event) >= dayAgo).length,
    loaded: events.length,
    totalAvailable,
  };
}
