import {
  contactChannelTypes,
  orderStatuses,
  type AdminOrderDetail,
  type AdminOrderListItem,
  type AdminOrderScope,
  type ContactChannelType,
  type Locale,
  type OrderStatus,
} from "@cloudbridge/contracts";
import { CaretLeft, CaretRight, FunnelSimple, WarningCircle } from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  invalidateAdminCache,
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../admin-experience";
import { PanelState, RefreshNotice } from "../admin-ui";
import {
  getAdminOrderAssignees,
  getAdminOrders,
  type AdminOrderPage,
} from "../features/orders/api";
import {
  hasOrderFilters,
  OrderFilters,
  type OrderQueryState,
} from "../features/orders/order-filters";
import { OrderDetailDialog } from "../features/orders/order-detail-dialog";
import { OrdersTable } from "../features/orders/orders-table";

export const afterSalesStatuses = [
  "REFUND_PENDING",
  "REFUNDED",
  "DISPUTED",
] as const satisfies ReadonlyArray<OrderStatus>;

type OrdersPageScope = AdminOrderScope | "ALL";

const defaultQuery = (scope: OrdersPageScope): OrderQueryState => ({
  page: 1,
  pageSize: 30,
  ...(scope === "AFTER_SALES" ? { scope } : {}),
});
const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

export const readOrderQuery = (
  search: string,
  scope: OrdersPageScope = "ALL",
): OrderQueryState => {
  const params = new URLSearchParams(search);
  const pageValue = Number(params.get("page") ?? "1");
  const searchValue = params.get("search")?.trim() || undefined;
  const statusValue = params.get("status");
  const assigneeValue = params.get("assigneeId")?.trim() || undefined;
  const channelValue = params.get("contactChannel");
  const allowedStatuses: ReadonlyArray<OrderStatus> = scope === "AFTER_SALES"
    ? afterSalesStatuses
    : orderStatuses;
  return {
    page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1,
    pageSize: 30,
    search: searchValue,
    scope: scope === "AFTER_SALES" ? scope : undefined,
    status: statusValue && allowedStatuses.includes(statusValue as OrderStatus)
      ? statusValue as OrderStatus
      : undefined,
    assigneeId: assigneeValue,
    contactChannel: channelValue && contactChannelTypes.includes(channelValue as ContactChannelType)
      ? channelValue as ContactChannelType
      : undefined,
  };
};

export const orderQuerySearch = (query: OrderQueryState): string => {
  const params = new URLSearchParams();
  if (query.page > 1) params.set("page", String(query.page));
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.status) params.set("status", query.status);
  if (query.assigneeId) params.set("assigneeId", query.assigneeId);
  if (query.contactChannel) params.set("contactChannel", query.contactChannel);
  return params.toString();
};

const orderMatchesQuery = (order: AdminOrderListItem, query: OrderQueryState): boolean => {
  const needle = query.search?.trim().toLocaleLowerCase();
  return (query.scope !== "AFTER_SALES" || afterSalesStatuses.includes(
    order.status as (typeof afterSalesStatuses)[number],
  ))
    && (!query.status || order.status === query.status)
    && (!query.assigneeId
      || (query.assigneeId === "UNASSIGNED"
        ? !order.assignedTo
        : order.assignedTo?.id === query.assigneeId))
    && (!query.contactChannel || order.contactChannel === query.contactChannel)
    && (!needle
      || order.orderNumber.toLocaleLowerCase().includes(needle)
      || order.productNameSnapshot.toLocaleLowerCase().includes(needle)
      || order.maskedContact.toLocaleLowerCase().includes(needle));
};

export default function OrdersPage({
  canRevealContact,
  canWrite,
  locale,
  scope = "ALL",
}: {
  canRevealContact: boolean;
  canWrite: boolean;
  locale: Locale;
  scope?: OrdersPageScope;
}) {
  const [query, setQuery] = useState<OrderQueryState>(() => readOrderQuery(window.location.search, scope));
  const [selectedOrder, setSelectedOrder] = useState<Pick<AdminOrderListItem, "id" | "orderNumber"> | null>(null);
  const querySearch = useMemo(() => orderQuerySearch(query), [query]);
  const loader = useCallback(
    (signal: AbortSignal) => getAdminOrders(query, signal),
    [query],
  );
  const {
    commit,
    data,
    reload,
    state,
  } = useCachedAdminResource<AdminOrderPage>(
    `orders:list:${scope.toLocaleLowerCase()}:${querySearch || "all"}`,
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
    const onPopState = () => setQuery(readOrderQuery(window.location.search, scope));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [scope]);

  const updateQuery = (next: OrderQueryState, historyMode: "push" | "replace" = "push") => {
    const search = orderQuerySearch(next);
    const url = `${window.location.pathname}${search ? `?${search}` : ""}`;
    window.history[historyMode === "push" ? "pushState" : "replaceState"](
      {
        ...(window.history.state ?? {}),
        page: scope === "AFTER_SALES" ? "disputes" : "orders",
      },
      "",
      url,
    );
    setQuery(next);
  };

  const saveIntoList = (saved: AdminOrderDetail) => {
    if (!data) return;
    const existing = data.items.find((item) => item.id === saved.id);
    const matches = orderMatchesQuery(saved, query);
    const items = matches
      ? existing
        ? data.items.map((item) => item.id === saved.id ? saved : item)
        : [saved, ...data.items]
      : data.items.filter((item) => item.id !== saved.id);
    const totalDelta = existing && !matches ? -1 : !existing && matches ? 1 : 0;
    commit({
      items,
      meta: {
        ...data.meta,
        total: Math.max(0, data.meta.total + totalDelta),
      },
    });
    invalidateAdminCache("dashboard");
    void reload();
  };

  const filtered = hasOrderFilters(query);
  const scopedEmpty = filtered || query.page > 1;
  const listBusy = state === "refreshing" || state === "initial-loading";
  const pageCount = data?.meta.pageCount ?? 0;
  const availableStatuses: ReadonlyArray<OrderStatus> = scope === "AFTER_SALES"
    ? afterSalesStatuses
    : orderStatuses;

  return (
    <>
      <section className="admin-panel order-center">
        <OrderFilters
          assignees={assignees}
          busy={listBusy}
          locale={locale}
          onChange={updateQuery}
          onClear={() => updateQuery(defaultQuery(scope))}
          query={query}
          statuses={availableStatuses}
          statusLabel={scope === "AFTER_SALES"
            ? copy(locale, "售后状态", "After-sales status")
            : undefined}
        />
        {assigneeState === "error" || assigneeState === "offline" ? (
          <p className="order-assignee-load-error" role="alert">
            <WarningCircle aria-hidden="true" />
            {copy(locale, "负责人列表未加载，其他订单筛选仍可使用。", "Owner options did not load. Other order filters remain available.")}
            <button type="button" onClick={() => void reloadAssignees()}>{copy(locale, "重试", "Retry")}</button>
          </p>
        ) : null}
        <RefreshNotice state={state} locale={locale} retry={() => void reload()} slow={slow} />
        {!data ? (
          <PanelState state={state} locale={locale} retry={() => void reload()} />
        ) : data.items.length === 0 ? (
          <div className="order-empty-state" role="status">
            <FunnelSimple aria-hidden="true" />
            <strong>
              {scopedEmpty
                ? copy(locale, "没有符合当前筛选的订单", "No orders match these filters")
                : scope === "AFTER_SALES"
                  ? copy(locale, "当前没有人工售后订单", "No manual after-sales orders")
                : copy(locale, "当前还没有订单", "No orders yet")}
            </strong>
            <p>
              {scopedEmpty
                ? copy(locale, "清空或调整筛选条件后再试。", "Clear or adjust the filters and try again.")
                : scope === "AFTER_SALES"
                  ? copy(locale, "退款复核、人工退款记录和争议订单会显示在这里。", "Refund reviews, manual refund records, and disputed orders will appear here.")
                : copy(locale, "客户提交的人工订单会显示在这里。", "Customer-submitted manual orders will appear here.")}
            </p>
            {scopedEmpty && (
              <button className="admin-secondary" onClick={() => updateQuery(defaultQuery(scope))}>
                {scope === "AFTER_SALES"
                  ? copy(locale, "返回全部售后订单", "Return to all after-sales orders")
                  : copy(locale, "返回全部订单", "Return to all orders")}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="order-list-meta">
              <span>{copy(locale, `共 ${data.meta.total} 条订单`, `${data.meta.total} orders`)}</span>
              <span>{copy(locale, `第 ${data.meta.page} / ${Math.max(1, data.meta.pageCount)} 页`, `Page ${data.meta.page} of ${Math.max(1, data.meta.pageCount)}`)}</span>
            </div>
            <OrdersTable
              orders={data.items}
              locale={locale}
              onOpenOrder={(order) => setSelectedOrder({ id: order.id, orderNumber: order.orderNumber })}
            />
            <nav className="order-pagination" aria-label={copy(locale, "订单分页", "Order pagination")}>
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
      {selectedOrder && (
        <OrderDetailDialog
          key={selectedOrder.id}
          assignees={assignees}
          canRevealContact={canRevealContact}
          canWrite={canWrite}
          locale={locale}
          onClose={() => setSelectedOrder(null)}
          onSaved={saveIntoList}
          orderId={selectedOrder.id}
          orderNumber={selectedOrder.orderNumber}
        />
      )}
    </>
  );
}
