import {
  ArrowsClockwise,
  CaretLeft,
  CaretRight,
  Clock,
  DownloadSimple,
  Eye,
  ListChecks,
  MagnifyingGlass,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { AUDIT_CSV_EXPORT_LIMIT } from "@cloudbridge/contracts";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ApiError,
  exportAuditCsv,
  getAuditPage,
  type AuditEventPage,
  type Locale,
} from "../api";
import {
  useCachedAdminResource,
  useAdminStatus,
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

export default function AuditPage({
  locale,
  sitesRuntime,
}: {
  locale: Locale;
  sitesRuntime: boolean;
}) {
  const { notify } = useAdminStatus();
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
  const [exportOpen, setExportOpen] = useState(false);
  const [exportReason, setExportReason] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState("");

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
  const normalizedExportReason = exportReason.normalize("NFKC").trim();
  const exportLimit = AUDIT_CSV_EXPORT_LIMIT;

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

  const closeExport = () => {
    if (exportBusy) return;
    setExportOpen(false);
    setExportReason("");
    setExportError("");
  };

  const submitExport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (normalizedExportReason.length < 8 || normalizedExportReason.length > 500) {
      setExportError(copy(
        locale,
        "业务原因必须为 8–500 个字符。",
        "The business reason must contain 8–500 characters.",
      ));
      return;
    }
    if (summary.totalAvailable > exportLimit) {
      setExportError(copy(
        locale,
        `当前筛选超过 ${exportLimit} 条，请先缩小筛选范围。`,
        `The current filter exceeds ${exportLimit} records. Narrow the filter first.`,
      ));
      return;
    }
    const confirmed = window.confirm(copy(
      locale,
      `确认导出当前筛选匹配的 ${summary.totalAvailable} 条审计记录？文件下载后将离开系统控制范围；本操作不可撤销并会写入审计。`,
      `Export the ${summary.totalAvailable} audit records matching the current filter? The downloaded file leaves system control. This cannot be undone and will be audited.`,
    ));
    if (!confirmed) return;
    setExportBusy(true);
    setExportError("");
    try {
      const exported = await exportAuditCsv({
        ...(query.search ? { search: query.search } : {}),
        ...(query.result ? { result: query.result } : {}),
        ...(query.actor ? { actor: query.actor } : {}),
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.timeRange ? { timeRange: query.timeRange } : {}),
        reason: normalizedExportReason,
      });
      const url = URL.createObjectURL(exported.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = exported.filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      notify(exported.recordCount === null
        ? copy(
            locale,
            "审计 CSV 已由服务器生成并开始下载，导出事件已写入审计。",
            "The server generated the audit CSV and the download started. The export event was audited.",
          )
        : copy(
            locale,
            `已下载 ${exported.recordCount} 条安全白名单审计记录，导出事件已写入审计。`,
            `${exported.recordCount} allowlisted audit records were downloaded. The export event was audited.`,
          ));
      setExportOpen(false);
      setExportReason("");
      void reload();
    } catch (requestError) {
      const recentAuthRequired = requestError instanceof ApiError
        && requestError.code === "RECENT_AUTHENTICATION_REQUIRED";
      const message = recentAuthRequired
        ? copy(
            locale,
            "最近认证已过期。请退出后台并重新登录，在五分钟内再次导出。",
            "Recent authentication expired. Sign out and sign in again, then export within five minutes.",
          )
        : requestError instanceof Error
          ? requestError.message
          : copy(locale, "审计导出失败。", "Audit export failed.");
      setExportError(message);
      notify(message, "error");
    } finally {
      setExportBusy(false);
    }
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
            `当前筛选共 ${summary.totalAvailable} 条，正在查看第 ${data.meta.page} 页的 ${summary.loaded} 条记录。筛选、分页和安全 CSV 导出由服务器执行；前后差异、IP 哈希和正式保留策略不向前端开放。`,
            `The current server-side filter matches ${summary.totalAvailable} records; page ${data.meta.page} contains ${summary.loaded}. Filtering, pagination, and safe CSV export run on the server; before/after diffs, IP hashes, and a formal retention policy are not exposed.`,
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
          <div className="audit-log-table-tools">
            <span>{copy(
              locale,
              `第 ${data.meta.page} / ${Math.max(1, data.meta.pageCount)} 页 · 本页 ${events.length} 条`,
              `Page ${data.meta.page} of ${Math.max(1, data.meta.pageCount)} · ${events.length} on this page`,
            )}</span>
            <button
              type="button"
              className="admin-secondary"
              onClick={() => {
                setExportError("");
                setExportOpen(true);
              }}
            >
              <DownloadSimple size={17} />
              {copy(locale, "安全导出 CSV", "Secure CSV export")}
            </button>
          </div>
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

      {exportOpen && (
        <Dialog
          title={copy(locale, "安全导出审计记录", "Secure audit export")}
          closeLabel={copy(locale, "关闭审计导出", "Close audit export")}
          onClose={closeExport}
        >
          <form className="audit-export-form" onSubmit={submitExport}>
            <div className="audit-export-impact" role="note">
              <ShieldCheck size={20} aria-hidden="true" />
              <span>
                <strong>{copy(
                  locale,
                  `当前筛选匹配 ${summary.totalAvailable} 条，单次上限 ${exportLimit} 条`,
                  `${summary.totalAvailable} records match; the per-export limit is ${exportLimit}`,
                )}</strong>
                {copy(
                  locale,
                  "仅导出界面可见的安全字段白名单。文件下载后将离开系统控制范围，操作不可撤销，并会写入一条新的审计事件。",
                  "Only the UI-safe field allowlist is exported. The downloaded file leaves system control, cannot be recalled, and creates a new audit event.",
                )}
              </span>
            </div>
            <p className="audit-export-auth-note">
              {sitesRuntime
                ? copy(
                    locale,
                    "Sites 身份由 ChatGPT 平台在每次请求中验证；CloudBridge 不保存密码，也无法读取平台的密码或 TOTP 重新认证时间。",
                    "ChatGPT verifies the Sites identity on each request. CloudBridge stores no password and cannot read the platform's password or TOTP reauthentication time.",
                  )
                : copy(
                    locale,
                    "MySQL 后台要求五分钟内最近认证；如果已超时，请退出后重新登录再执行导出。",
                    "The MySQL administration runtime requires authentication within the last five minutes. If it expired, sign out and sign in again.",
                  )}
            </p>
            <label>
              <span>{copy(locale, "业务原因", "Business reason")}</span>
              <textarea
                value={exportReason}
                minLength={8}
                maxLength={500}
                required
                disabled={exportBusy}
                aria-invalid={Boolean(exportError)}
                onChange={(event) => {
                  setExportReason(event.target.value);
                  setExportError("");
                }}
                placeholder={copy(
                  locale,
                  "说明谁需要这份记录、用途和处理范围（至少 8 个字符）",
                  "State who needs the file, its purpose, and handling scope (at least 8 characters)",
                )}
              />
            </label>
            {summary.totalAvailable > exportLimit && (
              <p className="form-error" role="alert">
                <WarningCircle size={16} />
                {copy(
                  locale,
                  `当前筛选超过 ${exportLimit} 条，请先缩小筛选范围。`,
                  `The current filter exceeds ${exportLimit} records. Narrow the filter first.`,
                )}
              </p>
            )}
            {exportError && <p className="form-error" role="alert"><WarningCircle size={16} />{exportError}</p>}
            <div className="dialog-actions">
              <button type="button" onClick={closeExport} disabled={exportBusy}>
                {copy(locale, "取消", "Cancel")}
              </button>
              <button
                type="submit"
                className="admin-danger"
                disabled={
                  exportBusy
                  || normalizedExportReason.length < 8
                  || normalizedExportReason.length > 500
                  || summary.totalAvailable > exportLimit
                }
              >
                <DownloadSimple size={17} />
                {exportBusy
                  ? copy(locale, "服务器生成中…", "Generating…")
                  : copy(locale, "确认并下载", "Confirm and download")}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
