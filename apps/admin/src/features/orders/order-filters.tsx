import {
  contactChannelTypes,
  orderStatuses,
  type AdminOrderAssignee,
  type AdminOrderListQuery,
  type ContactChannelType,
  type Locale,
  type OrderStatus,
} from "@cloudbridge/contracts";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { statusLabels } from "../../admin-ui";

export type OrderQueryState = AdminOrderListQuery & {
  page: number;
  pageSize: number;
};

const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

export const hasOrderFilters = (query: AdminOrderListQuery): boolean => Boolean(
  query.search?.trim()
  || query.status
  || query.assigneeId
  || query.contactChannel,
);

export function OrderFilters({
  assignees,
  busy,
  locale,
  onChange,
  onClear,
  query,
  statuses = orderStatuses,
  statusLabel,
}: {
  assignees: AdminOrderAssignee[] | null;
  busy: boolean;
  locale: Locale;
  onChange: (query: OrderQueryState, historyMode?: "push" | "replace") => void;
  onClear: () => void;
  query: OrderQueryState;
  statuses?: ReadonlyArray<OrderStatus>;
  statusLabel?: string;
}) {
  const [search, setSearch] = useState(query.search ?? "");

  useEffect(() => {
    setSearch(query.search ?? "");
  }, [query.search]);

  const update = (patch: Partial<OrderQueryState>) => {
    onChange({ ...query, ...patch, page: 1 });
  };

  return (
    <form
      className="order-filters"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        update({ search: search.trim() || undefined });
      }}
    >
      <label className="order-search-field">
        <span>{copy(locale, "搜索订单", "Search orders")}</span>
        <div>
          <MagnifyingGlass aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={160}
            placeholder={copy(locale, "订单号、商品或脱敏账号", "Order, product, or masked account")}
          />
        </div>
      </label>
      <label>
        <span>{statusLabel ?? copy(locale, "订单状态", "Order status")}</span>
        <select
          value={query.status ?? ""}
          onChange={(event) => update({
            status: (event.target.value || undefined) as OrderStatus | undefined,
          })}
        >
          <option value="">
            {statuses === orderStatuses
              ? copy(locale, "全部状态", "All statuses")
              : copy(locale, "全部售后状态", "All after-sales statuses")}
          </option>
          {statuses.map((status) => (
            <option value={status} key={status}>{statusLabels[status]?.[locale] ?? status}</option>
          ))}
        </select>
      </label>
      <label>
        <span>{copy(locale, "负责人", "Owner")}</span>
        <select
          value={query.assigneeId ?? ""}
          disabled={!assignees}
          onChange={(event) => update({ assigneeId: event.target.value || undefined })}
        >
          <option value="">{copy(locale, "全部负责人", "All owners")}</option>
          <option value="UNASSIGNED">{copy(locale, "未分配", "Unassigned")}</option>
          {assignees?.map((assignee) => (
            <option value={assignee.id} key={assignee.id}>{assignee.displayName}</option>
          ))}
        </select>
      </label>
      <label>
        <span>{copy(locale, "联系渠道", "Contact channel")}</span>
        <select
          value={query.contactChannel ?? ""}
          onChange={(event) => update({
            contactChannel: (event.target.value || undefined) as ContactChannelType | undefined,
          })}
        >
          <option value="">{copy(locale, "全部渠道", "All channels")}</option>
          {contactChannelTypes.map((channel) => <option value={channel} key={channel}>{channel}</option>)}
        </select>
      </label>
      <div className="order-filter-actions">
        <button className="admin-primary" type="submit" disabled={busy}>
          <MagnifyingGlass />{copy(locale, "搜索", "Search")}
        </button>
        {hasOrderFilters(query) && (
          <button className="admin-secondary" type="button" onClick={onClear}>
            <X />{copy(locale, "清空筛选", "Clear filters")}
          </button>
        )}
      </div>
    </form>
  );
}
