import {
  type AdminManualPaymentEvent,
  type Locale,
  type ManualPaymentEventType,
} from "@cloudbridge/contracts";
import {
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useCachedAdminResource, useSlowAdminRequest } from "../../admin-experience";
import { PanelState, RefreshNotice } from "../../admin-ui";
import {
  getAdminOrderAssignees,
} from "../orders/api";
import { OrderDetailDialog } from "../orders/order-detail-dialog";
import {
  getManualPaymentEvents,
  type ManualPaymentEventPage,
} from "./api";
import {
  hasManualPaymentFilters,
  manualPaymentEventTypes,
  ManualPaymentFilters,
  type ManualPaymentQueryState,
} from "./filters";
import { ManualPaymentsTable } from "./table";

const defaultQuery: ManualPaymentQueryState = { page: 1, pageSize: 30 };
const currencyPattern = /^[A-Z]{3,4}$/u;
const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

export const readManualPaymentQuery = (search: string): ManualPaymentQueryState => {
  const params = new URLSearchParams(search);
  const page = Number(params.get("page") ?? "1");
  const eventType = params.get("eventType");
  const currencyCode = params.get("currencyCode")?.trim().toUpperCase();
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: 30,
    search: params.get("search")?.trim() || undefined,
    eventType: eventType && manualPaymentEventTypes.includes(eventType as ManualPaymentEventType)
      ? eventType as ManualPaymentEventType
      : undefined,
    currencyCode: currencyCode && currencyPattern.test(currencyCode) ? currencyCode : undefined,
    actorId: params.get("actorId")?.trim() || undefined,
    assigneeId: params.get("assigneeId")?.trim() || undefined,
  };
};

export const manualPaymentQuerySearch = (query: ManualPaymentQueryState): string => {
  const params = new URLSearchParams();
  if (query.page > 1) params.set("page", String(query.page));
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.eventType) params.set("eventType", query.eventType);
  if (query.currencyCode?.trim()) params.set("currencyCode", query.currencyCode.trim().toUpperCase());
  if (query.actorId) params.set("actorId", query.actorId);
  if (query.assigneeId) params.set("assigneeId", query.assigneeId);
  return params.toString();
};

export default function ManualPaymentsPage({
  canRevealContact,
  canWrite,
  locale,
}: {
  canRevealContact: boolean;
  canWrite: boolean;
  locale: Locale;
}) {
  const [query, setQuery] = useState<ManualPaymentQueryState>(
    () => readManualPaymentQuery(window.location.search),
  );
  const [selected, setSelected] = useState<AdminManualPaymentEvent | null>(null);
  const querySearch = useMemo(() => manualPaymentQuerySearch(query), [query]);
  const loader = useCallback(
    (signal: AbortSignal) => getManualPaymentEvents(query, signal),
    [query],
  );
  const {
    data,
    reload,
    state,
  } = useCachedAdminResource<ManualPaymentEventPage>(
    `manual-payment-events:${querySearch || "all"}`,
    loader,
  );
  const assigneeLoader = useCallback((signal: AbortSignal) => getAdminOrderAssignees(signal), []);
  const {
    data: assignees,
    reload: reloadAssignees,
    state: assigneeState,
  } = useCachedAdminResource("orders:assignees", assigneeLoader);
  const slow = useSlowAdminRequest(state);

  useEffect(() => {
    const onPopState = () => setQuery(readManualPaymentQuery(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const updateQuery = (next: ManualPaymentQueryState, historyMode: "push" | "replace" = "push") => {
    const search = manualPaymentQuerySearch(next);
    const url = `${window.location.pathname}${search ? `?${search}` : ""}`;
    window.history[historyMode === "push" ? "pushState" : "replaceState"](
      { ...(window.history.state ?? {}), page: "payments" },
      "",
      url,
    );
    setQuery(next);
  };

  const listBusy = state === "initial-loading" || state === "refreshing";
  const pageCount = data?.meta.pageCount ?? 0;
  const filtered = hasManualPaymentFilters(query) || query.page > 1;

  return (
    <>
      <div className="finance-truth-note" role="note">
        <WarningCircle aria-hidden="true" />
        <span>
          <strong>{copy(locale, "人工收款状态历史", "Manual payment status history")}</strong>
          {copy(
            locale,
            "这里是只读的管理员人工状态记录，不是支付流水，不证明款项到账或退款完成；历史记录本身不能编辑或删除，不同币种不会合并为总额。",
            "This is read-only history of manual admin states, not a payment ledger, and does not prove receipt or refund. History entries cannot be edited or deleted, and totals are never combined across currencies.",
          )}
        </span>
      </div>
      <section className="admin-panel manual-payments-center">
        <ManualPaymentFilters
          assignees={assignees}
          busy={listBusy}
          locale={locale}
          onChange={updateQuery}
          onClear={() => updateQuery(defaultQuery)}
          query={query}
        />
        {assigneeState === "error" || assigneeState === "offline" ? (
          <p className="order-assignee-load-error" role="alert">
            <WarningCircle aria-hidden="true" />
            {copy(locale, "人员筛选未加载，其他筛选仍可使用。", "People filters did not load. Other filters remain available.")}
            <button type="button" onClick={() => void reloadAssignees()}>{copy(locale, "重试", "Retry")}</button>
          </p>
        ) : null}
        <RefreshNotice state={state} locale={locale} retry={() => void reload()} slow={slow} />
        {!data ? (
          <PanelState state={state} locale={locale} retry={() => void reload()} />
        ) : data.items.length === 0 ? (
          <div className="manual-payments-empty" role="status">
            <MagnifyingGlass aria-hidden="true" />
            <strong>
              {filtered
                ? copy(locale, "没有符合当前条件的人工记录", "No manual records match these filters")
                : copy(locale, "当前没有人工收款状态记录", "No manual payment status records")}
            </strong>
            <p>
              {filtered
                ? copy(locale, "请调整或清空筛选条件后重试。", "Adjust or clear the filters and try again.")
                : copy(locale, "订单进入人工付款、退款或争议状态后会显示在这里。", "Records appear when orders enter manual payment, refund, or dispute states.")}
            </p>
            {filtered && (
              <button className="admin-secondary" onClick={() => updateQuery(defaultQuery)}>
                {copy(locale, "返回全部记录", "Return to all records")}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="manual-payment-list-meta">
              <span>{copy(locale, `共 ${data.meta.total} 条记录`, `${data.meta.total} records`)}</span>
              <span>
                {copy(
                  locale,
                  `第 ${data.meta.page} / ${Math.max(1, data.meta.pageCount)} 页`,
                  `Page ${data.meta.page} of ${Math.max(1, data.meta.pageCount)}`,
                )}
              </span>
            </div>
            <ManualPaymentsTable events={data.items} locale={locale} onOpenOrder={setSelected} />
            <nav className="manual-payment-pagination" aria-label={copy(locale, "人工收款记录分页", "Manual payment record pagination")}>
              <button
                className="admin-secondary"
                disabled={query.page <= 1 || listBusy}
                onClick={() => updateQuery({ ...query, page: Math.max(1, query.page - 1) })}
              >
                <CaretLeft aria-hidden="true" />{copy(locale, "上一页", "Previous")}
              </button>
              <button
                className="admin-secondary"
                disabled={query.page >= pageCount || listBusy}
                onClick={() => updateQuery({ ...query, page: query.page + 1 })}
              >
                {copy(locale, "下一页", "Next")}<CaretRight aria-hidden="true" />
              </button>
            </nav>
          </>
        )}
      </section>
      {selected && (
        <OrderDetailDialog
          key={selected.orderId}
          assignees={assignees}
          canRevealContact={canRevealContact}
          canWrite={canWrite}
          locale={locale}
          onClose={() => setSelected(null)}
          onSaved={() => void reload()}
          orderId={selected.orderId}
          orderNumber={selected.orderNumber}
        />
      )}
    </>
  );
}
