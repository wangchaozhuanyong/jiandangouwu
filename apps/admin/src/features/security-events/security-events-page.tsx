import {
  ArrowsClockwise,
  CaretLeft,
  CaretRight,
  Clock,
  Eye,
  LockKey,
  MagnifyingGlass,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getAuditPage,
  type AuditEventPage,
  type Locale,
} from "../../api";
import {
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../../admin-experience";
import {
  Dialog,
  formatDate,
  PanelState,
  RefreshNotice,
  StatusPill,
} from "../../admin-ui";
import {
  buildSecurityEvents,
  defaultSecurityEventQuery,
  readSecurityEventQuery,
  securityActionLabel,
  securityEventFilterFromQuery,
  securityEventQueryFromFilter,
  securityEventQuerySearch,
  type SecurityEvent,
  type SecurityEventCategory,
  type SecurityEventFilter,
  type SecurityEventSeverity,
} from "./model";
import { SystemAlertsPanel } from "../system-alerts/system-alerts-panel";

const copy = (locale: Locale, zh: string, en: string): string =>
  locale === "zh" ? zh : en;

const categoryLabels: Record<SecurityEventCategory, Record<Locale, string>> = {
  authentication: { zh: "登录认证", en: "Authentication" },
  authorization: { zh: "权限控制", en: "Authorization" },
  "sensitive-data": { zh: "敏感数据", en: "Sensitive data" },
  configuration: { zh: "关键配置", en: "Critical configuration" },
};

const severityLabels: Record<SecurityEventSeverity, Record<Locale, string>> = {
  high: { zh: "优先复核", en: "Review first" },
  medium: { zh: "常规复核", en: "Standard review" },
  low: { zh: "信息记录", en: "Informational" },
};

function SeverityTag({
  event,
  locale,
}: {
  event: SecurityEvent;
  locale: Locale;
}) {
  return (
    <span className={`security-event-severity is-${event.severity}`}>
      {severityLabels[event.severity][locale]}
    </span>
  );
}

export default function SecurityEventsPage({
  canWrite,
  locale,
}: {
  canWrite: boolean;
  locale: Locale;
}) {
  const [query, setQuery] = useState(() => (
    readSecurityEventQuery(window.location.search)
  ));
  const [filter, setFilter] = useState<SecurityEventFilter>(() => (
    securityEventFilterFromQuery(query)
  ));
  const querySearch = useMemo(
    () => securityEventQuerySearch(query),
    [query],
  );
  const loader = useCallback(
    (signal: AbortSignal) => getAuditPage(query, signal),
    [query],
  );
  const {
    data,
    state,
    reload,
  } = useCachedAdminResource<AuditEventPage>(
    `security-events:${querySearch || "default"}`,
    loader,
  );
  const slow = useSlowAdminRequest(state);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const events = useMemo(
    () => buildSecurityEvents(data?.data ?? []),
    [data],
  );
  const summary = data?.facets.securitySummary;
  const selected = events.find((event) => event.id === selectedId) ?? null;
  const listBusy = state === "initial-loading" || state === "refreshing";
  const pageCount = data?.meta.pageCount ?? 0;

  useEffect(() => {
    const onPopState = () => {
      const next = readSecurityEventQuery(window.location.search);
      setQuery(next);
      setFilter(securityEventFilterFromQuery(next));
      setSelectedId(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const updateQuery = useCallback((
    next: typeof query,
    historyMode: "push" | "replace" = "push",
  ) => {
    const search = securityEventQuerySearch(next);
    const url = `${window.location.pathname}${search ? `?${search}` : ""}`;
    window.history[historyMode === "push" ? "pushState" : "replaceState"](
      {
        ...(window.history.state ?? {}),
        page: "security-events",
      },
      "",
      url,
    );
    setQuery(next);
    setSelectedId(null);
  }, []);

  useEffect(() => {
    if (!data || listBusy || data.meta.page !== query.page) return;
    const lastAvailablePage = Math.max(1, data.meta.pageCount);
    if (query.page > lastAvailablePage) {
      updateQuery({ ...query, page: lastAvailablePage }, "replace");
    }
  }, [data, listBusy, query, updateQuery]);

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    updateQuery(securityEventQueryFromFilter(filter));
  };

  const resetFilters = () => {
    const next = { ...defaultSecurityEventQuery };
    setFilter(securityEventFilterFromQuery(next));
    updateQuery(next);
  };

  if (!data || !summary) {
    return (
      <section className="admin-panel">
        <PanelState state={state} locale={locale} retry={() => void reload()} />
      </section>
    );
  }

  return (
    <>
      <div className="security-event-truth-note" role="note">
        <ShieldCheck size={19} />
        <span>
          <strong>{copy(locale, "真实审计安全信号", "Live audit security signals")}</strong>
          {copy(
            locale,
            `服务器已在完整审计历史中筛选安全信号，当前条件匹配 ${data.meta.total} 条，第 ${data.meta.page} 页显示 ${events.length} 条。高优先级信号会进入可重试 Telegram 告警队列；固定复核规则仍不代表威胁检测、SIEM 或自动账号处置。`,
            `The server filters security signals across the full audit history. The current filter matches ${data.meta.total} records and page ${data.meta.page} shows ${events.length}. High-priority signals enter the retryable Telegram alert queue; fixed review rules still do not represent threat detection, SIEM, or automatic account response.`,
          )}
        </span>
      </div>

      <SystemAlertsPanel canWrite={canWrite} locale={locale} source="SECURITY" />

      <section className="security-event-summary">
        <article className="admin-panel">
          <span><ShieldCheck size={21} /></span>
          <small>{copy(locale, "安全相关记录", "Security-related records")}</small>
          <strong>{summary.total}</strong>
        </article>
        <article className="admin-panel">
          <span><Clock size={21} /></span>
          <small>{copy(locale, "最近 24 小时", "Last 24 hours")}</small>
          <strong>{summary.last24Hours}</strong>
        </article>
        <article className="admin-panel is-warning">
          <span><WarningCircle size={21} /></span>
          <small>{copy(locale, "优先复核", "Review first")}</small>
          <strong>{summary.needsReview}</strong>
        </article>
        <article className="admin-panel is-danger">
          <span><LockKey size={21} /></span>
          <small>{copy(locale, "拒绝或失败", "Denied or failed")}</small>
          <strong>{summary.deniedOrFailed}</strong>
        </article>
      </section>

      <form className="admin-panel security-event-filters" onSubmit={applyFilters}>
        <div className="security-event-severity-filter" aria-label={copy(locale, "复核级别筛选", "Review priority filter")}>
          {(["all", "high", "medium", "low"] as const).map((severity) => (
            <button
              type="button"
              className={filter.severity === severity ? "is-active" : ""}
              key={severity}
              onClick={() => setFilter((current) => ({ ...current, severity }))}
            >
              {severity === "all"
                ? copy(locale, "全部级别", "All priorities")
                : severityLabels[severity][locale]}
            </button>
          ))}
        </div>
        <label className="security-event-search">
          <MagnifyingGlass size={17} />
          <span className="sr-only">{copy(locale, "搜索安全审计信号", "Search security audit signals")}</span>
          <input
            value={filter.search}
            maxLength={160}
            onChange={(event) => setFilter((current) => ({
              ...current,
              search: event.target.value,
            }))}
            placeholder={copy(locale, "搜索事件、人员、目标或原因", "Search event, actor, target, or reason")}
          />
        </label>
        <label>
          <span>{copy(locale, "事件范围", "Event scope")}</span>
          <select
            value={filter.category}
            onChange={(event) => setFilter((current) => ({
              ...current,
              category: event.target.value as SecurityEventFilter["category"],
            }))}
          >
            <option value="all">{copy(locale, "全部范围", "All scopes")}</option>
            {Object.entries(categoryLabels).map(([category, labels]) => (
              <option value={category} key={category}>{labels[locale]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy(locale, "审计结果", "Audit result")}</span>
          <select
            value={filter.result}
            onChange={(event) => setFilter((current) => ({
              ...current,
              result: event.target.value as SecurityEventFilter["result"],
            }))}
          >
            <option value="all">{copy(locale, "全部结果", "All results")}</option>
            <option value="SUCCEEDED">{copy(locale, "成功", "Succeeded")}</option>
            <option value="DENIED">{copy(locale, "已拒绝", "Denied")}</option>
            <option value="FAILED">{copy(locale, "失败", "Failed")}</option>
          </select>
        </label>
        <label>
          <span>{copy(locale, "时间范围", "Time range")}</span>
          <select
            value={filter.timeRange}
            onChange={(event) => setFilter((current) => ({
              ...current,
              timeRange: event.target.value as SecurityEventFilter["timeRange"],
            }))}
          >
            <option value="24h">{copy(locale, "最近 24 小时", "Last 24 hours")}</option>
            <option value="7d">{copy(locale, "最近 7 天", "Last 7 days")}</option>
            <option value="30d">{copy(locale, "最近 30 天", "Last 30 days")}</option>
            <option value="all">{copy(locale, "全部记录", "All records")}</option>
          </select>
        </label>
        <div className="security-event-filter-actions">
          <button
            type="button"
            className="admin-secondary"
            onClick={resetFilters}
            disabled={
              securityEventQuerySearch(securityEventQueryFromFilter(filter)) === ""
              && querySearch === ""
            }
          >
            {copy(locale, "重置筛选", "Reset filters")}
          </button>
          <button type="submit" className="admin-primary" disabled={listBusy}>
            {copy(locale, "应用筛选", "Apply filters")}
          </button>
          <button type="button" className="admin-secondary" onClick={() => void reload()}>
            <ArrowsClockwise className={state === "refreshing" ? "spin" : ""} size={17} />
            {copy(locale, "刷新记录", "Refresh records")}
          </button>
        </div>
      </form>

      <RefreshNotice
        state={state}
        locale={locale}
        retry={() => void reload()}
        slow={slow}
      />

      <section className="admin-panel security-event-table-panel">
        <div className="security-event-table-heading">
          <div>
            <small>{copy(locale, "当前筛选", "Current filter")}</small>
            <h2>{copy(locale, "安全审计信号", "Security audit signals")}</h2>
          </div>
          <span>
            {copy(
              locale,
              `第 ${data.meta.page} / ${Math.max(1, data.meta.pageCount)} 页 · 本页 ${events.length} 条`,
              `Page ${data.meta.page} of ${Math.max(1, data.meta.pageCount)} · ${events.length} on this page`,
            )}
          </span>
        </div>
        <div
          className="security-event-table-wrap"
          tabIndex={0}
          aria-label={copy(locale, "安全审计信号表，可横向滚动", "Security audit signal table, horizontally scrollable")}
        >
          <table className="security-event-table">
            <thead>
              <tr>
                <th>{copy(locale, "事件 ID", "Event ID")}</th>
                <th>{copy(locale, "追踪 ID", "Trace ID")}</th>
                <th>{copy(locale, "发生时间", "Occurred")}</th>
                <th>{copy(locale, "复核级别", "Priority")}</th>
                <th>{copy(locale, "事件", "Event")}</th>
                <th>{copy(locale, "范围", "Scope")}</th>
                <th>{copy(locale, "结果", "Result")}</th>
                <th>{copy(locale, "操作人", "Actor")}</th>
                <th>{copy(locale, "目标类型", "Target type")}</th>
                <th>{copy(locale, "目标编号", "Target ID")}</th>
                <th>{copy(locale, "记录原因", "Recorded reason")}</th>
                <th>{copy(locale, "详情", "Details")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td><code title={event.id}>{event.id.slice(0, 12)}</code></td>
                  <td><code title={event.requestId}>{event.requestId.slice(0, 12)}</code></td>
                  <td><time dateTime={event.createdAt}>{formatDate(event.createdAt, locale)}</time></td>
                  <td><SeverityTag event={event} locale={locale} /></td>
                  <td><strong title={event.action}>{securityActionLabel(event.action, locale)}</strong></td>
                  <td>{categoryLabels[event.category][locale]}</td>
                  <td><StatusPill status={event.result} locale={locale} /></td>
                  <td title={event.actor?.email ?? undefined}>{event.actor?.displayName ?? copy(locale, "系统", "System")}</td>
                  <td><code>{event.targetType}</code></td>
                  <td><code title={event.targetId ?? undefined}>{event.targetId?.slice(0, 12) ?? "—"}</code></td>
                  <td title={event.reason ?? undefined}>{event.reason ?? "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="security-event-detail-button"
                      aria-label={copy(locale, "查看安全审计详情", "View security audit details")}
                      onClick={() => setSelectedId(event.id)}
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 && (
            <div className="table-empty" role="status">
              {copy(
                locale,
                "没有符合当前筛选的真实安全审计信号。",
                "No live security audit signals match the current filters.",
              )}
            </div>
          )}
        </div>
        <nav
          className="security-event-pagination"
          aria-label={copy(locale, "安全事件分页", "Security event pagination")}
        >
          <button
            type="button"
            className="admin-secondary"
            disabled={query.page <= 1 || listBusy}
            onClick={() => updateQuery({ ...query, page: Math.max(1, query.page - 1) })}
          >
            <CaretLeft aria-hidden="true" />
            {copy(locale, "上一页", "Previous")}
          </button>
          <button
            type="button"
            className="admin-secondary"
            disabled={query.page >= pageCount || listBusy}
            onClick={() => updateQuery({ ...query, page: query.page + 1 })}
          >
            {copy(locale, "下一页", "Next")}
            <CaretRight aria-hidden="true" />
          </button>
        </nav>
      </section>

      {selected && (
        <Dialog
          title={securityActionLabel(selected.action, locale)}
          closeLabel={copy(locale, "关闭安全审计详情", "Close security audit details")}
          onClose={() => setSelectedId(null)}
        >
          <div className="security-event-detail">
            <div className="security-event-detail-heading">
              <SeverityTag event={selected} locale={locale} />
              <StatusPill status={selected.result} locale={locale} />
            </div>
            <p role="note">
              {copy(
                locale,
                "这是审计记录的确定性复核优先级，不是外部威胁检测结论；本页面不执行处置。",
                "This is a deterministic review priority for an audit record, not an external threat-detection verdict. This page performs no response action.",
              )}
            </p>
            <dl>
              <div><dt>{copy(locale, "审计事件 ID", "Audit event ID")}</dt><dd><code>{selected.id}</code></dd></div>
              <div><dt>{copy(locale, "请求追踪 ID", "Request trace ID")}</dt><dd><code>{selected.requestId}</code></dd></div>
              <div><dt>{copy(locale, "发生时间", "Occurred")}</dt><dd>{formatDate(selected.createdAt, locale)}</dd></div>
              <div><dt>{copy(locale, "事件范围", "Event scope")}</dt><dd>{categoryLabels[selected.category][locale]}</dd></div>
              <div><dt>{copy(locale, "操作人", "Actor")}</dt><dd>{selected.actor?.displayName ?? copy(locale, "系统", "System")}</dd></div>
              <div><dt>{copy(locale, "操作人邮箱", "Actor email")}</dt><dd>{selected.actor?.email ?? "—"}</dd></div>
              <div><dt>{copy(locale, "目标类型", "Target type")}</dt><dd><code>{selected.targetType}</code></dd></div>
              <div><dt>{copy(locale, "目标编号", "Target ID")}</dt><dd><code>{selected.targetId ?? "—"}</code></dd></div>
              <div><dt>{copy(locale, "记录原因", "Recorded reason")}</dt><dd>{selected.reason ?? "—"}</dd></div>
            </dl>
          </div>
        </Dialog>
      )}
    </>
  );
}
