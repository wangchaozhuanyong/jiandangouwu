import {
  ArrowsClockwise,
  CaretLeft,
  CaretRight,
  Clock,
  Eye,
  ListChecks,
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
} from "../api";
import {
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../admin-experience";
import {
  Dialog,
  formatDate,
  PanelState,
  RefreshNotice,
  StatusPill,
} from "../admin-ui";
import {
  auditActionLabel,
  auditFilterFromQuery,
  auditQueryFromFilter,
  auditQuerySearch,
  defaultAuditEventQuery,
  readAuditQuery,
  sortAuditEvents,
  summarizeAuditEvents,
  type AuditEventFilter,
} from "../features/audit/model";

const copy = (locale: Locale, zh: string, en: string): string =>
  locale === "zh" ? zh : en;

export default function AuditPage({ locale }: { locale: Locale }) {
  const [query, setQuery] = useState(() => readAuditQuery(window.location.search));
  const [filter, setFilter] = useState<AuditEventFilter>(() => auditFilterFromQuery(query));
  const querySearch = useMemo(() => auditQuerySearch(query), [query]);
  const loader = useCallback(
    (signal: AbortSignal) => getAuditPage(query, signal),
    [query],
  );
  const {
    data,
    state,
    reload,
  } = useCachedAdminResource<AuditEventPage>(
    `audit-page:${querySearch || "default"}`,
    loader,
  );
  const slow = useSlowAdminRequest(state);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const events = useMemo(
    () => sortAuditEvents(data?.data ?? []),
    [data],
  );
  const targetTypes = useMemo(
    () => [...new Set([
      ...(data?.facets.targetTypes ?? []),
      ...(filter.targetType !== "all" ? [filter.targetType] : []),
    ])].sort(),
    [data?.facets.targetTypes, filter.targetType],
  );
  const summary = useMemo(
    () => summarizeAuditEvents(events, data?.meta.total ?? 0),
    [data?.meta.total, events],
  );
  const selected = events.find((event) => event.id === selectedId) ?? null;
  const listBusy = state === "initial-loading" || state === "refreshing";
  const pageCount = data?.meta.pageCount ?? 0;

  useEffect(() => {
    const onPopState = () => {
      const next = readAuditQuery(window.location.search);
      setQuery(next);
      setFilter(auditFilterFromQuery(next));
      setSelectedId(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const updateQuery = useCallback((
    next: typeof query,
    historyMode: "push" | "replace" = "push",
  ) => {
    const search = auditQuerySearch(next);
    const url = `${window.location.pathname}${search ? `?${search}` : ""}`;
    window.history[historyMode === "push" ? "pushState" : "replaceState"](
      {
        ...(window.history.state ?? {}),
        page: "logs",
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
    updateQuery(auditQueryFromFilter(filter));
  };

  const resetFilters = () => {
    const next = { ...defaultAuditEventQuery };
    setFilter(auditFilterFromQuery(next));
    updateQuery(next);
  };

  if (!data) {
    return (
      <section className="admin-panel">
        <PanelState state={state} locale={locale} retry={() => void reload()} />
      </section>
    );
  }

  return (
    <>
      <div className="audit-log-truth-note" role="note">
        <ShieldCheck size={20} />
        <span>
          <strong>{copy(locale, "受保护的真实审计记录", "Protected live audit records")}</strong>
          {copy(
            locale,
            `当前筛选共 ${summary.totalAvailable} 条，正在查看第 ${data.meta.page} 页的 ${summary.loaded} 条记录。筛选与分页由服务器执行；API 只返回白名单字段，前后差异、IP 哈希、导出和正式保留策略尚未开放。`,
            `The current server-side filter matches ${summary.totalAvailable} records; page ${data.meta.page} contains ${summary.loaded}. The API returns allowlisted fields only; before/after diffs, IP hashes, export, and a formal retention policy are not exposed.`,
          )}
        </span>
      </div>

      <section className="audit-log-summary">
        <article className="admin-panel">
          <span><ListChecks size={21} /></span>
          <small>{copy(locale, "当前已加载", "Currently loaded")}</small>
          <strong>{summary.loaded}</strong>
        </article>
        <article className="admin-panel">
          <span><ShieldCheck size={21} /></span>
          <small>{copy(locale, "当前筛选总数", "Current filter total")}</small>
          <strong>{summary.totalAvailable}</strong>
        </article>
        <article className="admin-panel">
          <span><Clock size={21} /></span>
          <small>{copy(locale, "本页最近 24 小时", "Last 24 hours on page")}</small>
          <strong>{summary.last24Hours}</strong>
        </article>
        <article className="admin-panel is-warning">
          <span><WarningCircle size={21} /></span>
          <small>{copy(locale, "本页拒绝或失败", "Denied or failed on page")}</small>
          <strong>{summary.deniedOrFailed}</strong>
        </article>
      </section>

      <form className="admin-panel audit-log-filters" onSubmit={applyFilters}>
        <label className="audit-log-search">
          <MagnifyingGlass size={17} />
          <span className="sr-only">{copy(locale, "搜索审计记录", "Search audit records")}</span>
          <input
            value={filter.search}
            maxLength={160}
            onChange={(event) => setFilter((current) => ({
              ...current,
              search: event.target.value,
            }))}
            placeholder={copy(locale, "搜索动作代码、追踪、人员、目标或原因", "Search action code, trace, actor, target, or reason")}
          />
        </label>
        <label>
          <span>{copy(locale, "审计结果", "Audit result")}</span>
          <select
            value={filter.result}
            onChange={(event) => setFilter((current) => ({
              ...current,
              result: event.target.value as AuditEventFilter["result"],
            }))}
          >
            <option value="all">{copy(locale, "全部结果", "All results")}</option>
            <option value="SUCCEEDED">{copy(locale, "成功", "Succeeded")}</option>
            <option value="DENIED">{copy(locale, "已拒绝", "Denied")}</option>
            <option value="FAILED">{copy(locale, "失败", "Failed")}</option>
          </select>
        </label>
        <label>
          <span>{copy(locale, "操作来源", "Actor source")}</span>
          <select
            value={filter.actor}
            onChange={(event) => setFilter((current) => ({
              ...current,
              actor: event.target.value as AuditEventFilter["actor"],
            }))}
          >
            <option value="all">{copy(locale, "全部来源", "All sources")}</option>
            <option value="administrator">{copy(locale, "管理员", "Administrator")}</option>
            <option value="system">{copy(locale, "系统", "System")}</option>
          </select>
        </label>
        <label>
          <span>{copy(locale, "目标类型", "Target type")}</span>
          <select
            value={filter.targetType}
            onChange={(event) => setFilter((current) => ({
              ...current,
              targetType: event.target.value,
            }))}
          >
            <option value="all">{copy(locale, "全部目标", "All targets")}</option>
            {targetTypes.map((targetType) => (
              <option value={targetType} key={targetType}>{targetType}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy(locale, "时间范围", "Time range")}</span>
          <select
            value={filter.timeRange}
            onChange={(event) => setFilter((current) => ({
              ...current,
              timeRange: event.target.value as AuditEventFilter["timeRange"],
            }))}
          >
            <option value="24h">{copy(locale, "最近 24 小时", "Last 24 hours")}</option>
            <option value="7d">{copy(locale, "最近 7 天", "Last 7 days")}</option>
            <option value="30d">{copy(locale, "最近 30 天", "Last 30 days")}</option>
            <option value="all">{copy(locale, "全部记录", "All records")}</option>
          </select>
        </label>
        <div className="audit-log-filter-actions">
          <button
            type="button"
            className="admin-secondary"
            onClick={resetFilters}
            disabled={
              auditQuerySearch(auditQueryFromFilter(filter)) === ""
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

      <section className="admin-panel audit-log-table-panel">
        <div className="audit-log-table-heading">
          <div>
            <small>{copy(locale, "当前筛选", "Current filter")}</small>
            <h2>{copy(locale, "审计事件记录", "Audit event records")}</h2>
          </div>
          <span>{copy(
            locale,
            `第 ${data.meta.page} / ${Math.max(1, data.meta.pageCount)} 页 · 本页 ${events.length} 条`,
            `Page ${data.meta.page} of ${Math.max(1, data.meta.pageCount)} · ${events.length} on this page`,
          )}</span>
        </div>
        <div
          className="audit-log-table-wrap"
          tabIndex={0}
          aria-label={copy(locale, "审计日志表，可横向滚动", "Audit log table, horizontally scrollable")}
        >
          <table className="audit-log-table">
            <thead>
              <tr>
                <th>{copy(locale, "事件 ID", "Event ID")}</th>
                <th>{copy(locale, "追踪 ID", "Trace ID")}</th>
                <th>{copy(locale, "发生时间", "Occurred")}</th>
                <th>{copy(locale, "动作", "Action")}</th>
                <th>{copy(locale, "操作人", "Actor")}</th>
                <th>{copy(locale, "操作人邮箱", "Actor email")}</th>
                <th>{copy(locale, "目标类型", "Target type")}</th>
                <th>{copy(locale, "目标编号", "Target ID")}</th>
                <th>{copy(locale, "结果", "Result")}</th>
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
                  <td><strong title={event.action}>{auditActionLabel(event.action, locale)}</strong></td>
                  <td>{event.actor?.displayName ?? copy(locale, "系统", "System")}</td>
                  <td title={event.actor?.email ?? undefined}>{event.actor?.email ?? "—"}</td>
                  <td><code>{event.targetType}</code></td>
                  <td><code title={event.targetId ?? undefined}>{event.targetId?.slice(0, 12) ?? "—"}</code></td>
                  <td><StatusPill status={event.result} locale={locale} /></td>
                  <td title={event.reason ?? undefined}>{event.reason ?? "—"}</td>
                  <td>
                    <button
                      className="audit-log-detail-button"
                      aria-label={copy(locale, "查看审计事件详情", "View audit event details")}
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
              {copy(locale, "没有符合当前筛选的真实审计记录。", "No live audit records match the current filters.")}
            </div>
          )}
        </div>
        <nav className="audit-log-pagination" aria-label={copy(locale, "审计日志分页", "Audit log pagination")}>
          <button
            type="button"
            className="admin-secondary"
            disabled={query.page <= 1 || listBusy}
            onClick={() => updateQuery({ ...query, page: Math.max(1, query.page - 1) })}
          >
            <CaretLeft aria-hidden="true" />{copy(locale, "上一页", "Previous")}
          </button>
          <button
            type="button"
            className="admin-secondary"
            disabled={query.page >= pageCount || listBusy}
            onClick={() => updateQuery({ ...query, page: query.page + 1 })}
          >
            {copy(locale, "下一页", "Next")}<CaretRight aria-hidden="true" />
          </button>
        </nav>
      </section>

      {selected && (
        <Dialog
          title={auditActionLabel(selected.action, locale)}
          closeLabel={copy(locale, "关闭审计事件详情", "Close audit event details")}
          onClose={() => setSelectedId(null)}
        >
          <div className="audit-log-detail">
            <div className="audit-log-detail-heading">
              <StatusPill status={selected.result} locale={locale} />
              <code>{selected.action}</code>
            </div>
            <p role="note">
              {copy(
                locale,
                "详情仅显示当前审计 API 的安全白名单字段；变更前后快照、IP 哈希和内部载荷不会发送到管理前端。",
                "Details show only the current audit API allowlist. Before/after snapshots, IP hashes, and internal payloads are not sent to the admin client.",
              )}
            </p>
            <dl>
              <div><dt>{copy(locale, "审计事件 ID", "Audit event ID")}</dt><dd><code>{selected.id}</code></dd></div>
              <div><dt>{copy(locale, "请求追踪 ID", "Request trace ID")}</dt><dd><code>{selected.requestId}</code></dd></div>
              <div><dt>{copy(locale, "发生时间", "Occurred")}</dt><dd>{formatDate(selected.createdAt, locale)}</dd></div>
              <div><dt>{copy(locale, "动作代码", "Action code")}</dt><dd><code>{selected.action}</code></dd></div>
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
