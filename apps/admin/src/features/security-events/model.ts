import {
  classifySecurityAuditEvent,
  securityAuditActionProfiles,
  securityEventCategories,
  securityEventSeverities,
  type SecurityAuditSummary,
  type SecurityEventCategory,
  type SecurityEventSeverity,
} from "@cloudbridge/contracts";
import type {
  AuditEvent,
  AuditEventQuery,
  Locale,
} from "../../api";

export {
  securityEventCategories,
  securityEventSeverities,
};
export type {
  SecurityEventCategory,
  SecurityEventSeverity,
};

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

export type SecurityEventQuery = AuditEventQuery & {
  scope: "security";
};

export const defaultSecurityEventQuery: Readonly<SecurityEventQuery> = {
  page: 1,
  pageSize: 30,
  scope: "security",
  timeRange: "30d",
};

const normalized = (value: string): string =>
  value.normalize("NFKC").toLocaleLowerCase().trim();

const eventTimestamp = (event: Pick<AuditEvent, "createdAt">): number => {
  const timestamp = Date.parse(event.createdAt);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
};

export function securityActionLabel(action: string, locale: Locale): string {
  return securityAuditActionProfiles[action]?.label[locale] ?? action;
}

export function toSecurityEvent(event: AuditEvent): SecurityEvent | null {
  const classification = classifySecurityAuditEvent(event.action, event.result);
  if (!classification) return null;
  return {
    ...event,
    ...classification,
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
): SecurityAuditSummary {
  const dayAgo = now - 24 * 60 * 60 * 1000;
  return {
    total: events.length,
    last24Hours: events.filter((event) => eventTimestamp(event) >= dayAgo).length,
    needsReview: events.filter((event) => event.needsReview).length,
    deniedOrFailed: events.filter((event) => event.result !== "SUCCEEDED").length,
  };
}

export function readSecurityEventQuery(search: string): SecurityEventQuery {
  const params = new URLSearchParams(search);
  const pageValue = Number(params.get("page") ?? "1");
  const resultValue = params.get("result");
  const categoryValue = params.get("category");
  const severityValue = params.get("severity");
  const timeRangeValue = params.get("timeRange");
  const searchValue = params.get("search")?.normalize("NFKC").trim().slice(0, 160);
  return {
    page: Number.isSafeInteger(pageValue) && pageValue >= 1 && pageValue <= 1000
      ? pageValue
      : 1,
    pageSize: 30,
    scope: "security",
    ...(searchValue ? { search: searchValue } : {}),
    ...(resultValue && ["SUCCEEDED", "FAILED", "DENIED"].includes(resultValue)
      ? { result: resultValue as AuditEvent["result"] }
      : {}),
    ...(categoryValue && securityEventCategories.includes(
      categoryValue as SecurityEventCategory,
    )
      ? { category: categoryValue as SecurityEventCategory }
      : {}),
    ...(severityValue && securityEventSeverities.includes(
      severityValue as SecurityEventSeverity,
    )
      ? { severity: severityValue as SecurityEventSeverity }
      : {}),
    timeRange: timeRangeValue && ["24h", "7d", "30d", "all"].includes(timeRangeValue)
      ? timeRangeValue as SecurityEventFilter["timeRange"]
      : "30d",
  };
}

export function securityEventQuerySearch(query: SecurityEventQuery): string {
  const params = new URLSearchParams();
  if (query.page > 1) params.set("page", String(query.page));
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.result) params.set("result", query.result);
  if (query.category) params.set("category", query.category);
  if (query.severity) params.set("severity", query.severity);
  if (query.timeRange && query.timeRange !== "30d") {
    params.set("timeRange", query.timeRange);
  }
  return params.toString();
}

export function securityEventFilterFromQuery(
  query: SecurityEventQuery,
): SecurityEventFilter {
  return {
    category: query.category ?? "all",
    result: query.result ?? "all",
    search: query.search ?? "",
    severity: query.severity ?? "all",
    timeRange: query.timeRange ?? "30d",
  };
}

export function securityEventQueryFromFilter(
  filter: SecurityEventFilter,
): SecurityEventQuery {
  return {
    page: 1,
    pageSize: 30,
    scope: "security",
    ...(filter.search.trim() ? { search: filter.search.trim().slice(0, 160) } : {}),
    ...(filter.result !== "all" ? { result: filter.result } : {}),
    ...(filter.category !== "all" ? { category: filter.category } : {}),
    ...(filter.severity !== "all" ? { severity: filter.severity } : {}),
    timeRange: filter.timeRange,
  };
}
