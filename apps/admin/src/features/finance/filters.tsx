import {
  manualPaymentEventTypes,
  AdminManualPaymentEventListQuery,
  AdminOrderAssignee,
  type Locale,
  type ManualPaymentEventType,
} from "@cloudbridge/contracts";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

export { manualPaymentEventTypes };

export type ManualPaymentQueryState = AdminManualPaymentEventListQuery & {
  page: number;
  pageSize: number;
};

const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

const eventLabels: Record<ManualPaymentEventType, Record<Locale, string>> = {
  MANUALLY_RECORDED_PAID: { zh: "人工记录已付款", en: "Manually recorded paid" },
  REFUND_REVIEW_STARTED: { zh: "退款复核", en: "Refund review" },
  MANUALLY_RECORDED_REFUNDED: { zh: "人工记录已退款", en: "Manually recorded refunded" },
  DISPUTE_REVIEW_STARTED: { zh: "争议复核", en: "Dispute review" },
};

export const hasManualPaymentFilters = (query: AdminManualPaymentEventListQuery): boolean => Boolean(
  query.search?.trim()
  || query.eventType
  || query.currencyCode?.trim()
  || query.actorId
  || query.assigneeId,
);

export function ManualPaymentFilters({
  assignees,
  busy,
  locale,
  onChange,
  onClear,
  query,
}: {
  assignees: AdminOrderAssignee[] | null;
  busy: boolean;
  locale: Locale;
  onChange: (query: ManualPaymentQueryState, historyMode?: "push" | "replace") => void;
  onClear: () => void;
  query: ManualPaymentQueryState;
}) {
  const [search, setSearch] = useState(query.search ?? "");
  const [currencyCode, setCurrencyCode] = useState(query.currencyCode ?? "");

  useEffect(() => setSearch(query.search ?? ""), [query.search]);
  useEffect(() => setCurrencyCode(query.currencyCode ?? ""), [query.currencyCode]);

  const update = (patch: Partial<ManualPaymentQueryState>) => {
    onChange({ ...query, ...patch, page: 1 });
  };

  return (
    <form
      className="manual-payment-filters"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        update({
          search: search.trim() || undefined,
          currencyCode: currencyCode.trim().toUpperCase() || undefined,
        });
      }}
    >
      <label className="manual-payment-search">
        <span>{copy(locale, "搜索记录", "Search records")}</span>
        <div>
          <MagnifyingGlass aria-hidden="true" />
          <input
            maxLength={160}
            placeholder={copy(locale, "事件 ID、订单号或商品", "Event ID, order, or product")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </label>
      <label>
        <span>{copy(locale, "记录类型", "Record type")}</span>
        <select
          value={query.eventType ?? ""}
          onChange={(event) => update({
            eventType: (event.target.value || undefined) as ManualPaymentEventType | undefined,
          })}
        >
          <option value="">{copy(locale, "全部记录类型", "All record types")}</option>
          {manualPaymentEventTypes.map((eventType) => (
            <option value={eventType} key={eventType}>{eventLabels[eventType][locale]}</option>
          ))}
        </select>
      </label>
      <label>
        <span>{copy(locale, "币种", "Currency")}</span>
        <input
          inputMode="text"
          maxLength={4}
          pattern="[A-Za-z]{3,4}"
          placeholder="CNY"
          value={currencyCode}
          onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())}
        />
      </label>
      <label>
        <span>{copy(locale, "操作者", "Actor")}</span>
        <select
          disabled={!assignees}
          value={query.actorId ?? ""}
          onChange={(event) => update({ actorId: event.target.value || undefined })}
        >
          <option value="">{copy(locale, "全部操作者", "All actors")}</option>
          {assignees?.map((assignee) => (
            <option value={assignee.id} key={assignee.id}>{assignee.displayName}</option>
          ))}
        </select>
      </label>
      <label>
        <span>{copy(locale, "当前负责人", "Current owner")}</span>
        <select
          disabled={!assignees}
          value={query.assigneeId ?? ""}
          onChange={(event) => update({ assigneeId: event.target.value || undefined })}
        >
          <option value="">{copy(locale, "全部负责人", "All owners")}</option>
          <option value="UNASSIGNED">{copy(locale, "未分配", "Unassigned")}</option>
          {assignees?.map((assignee) => (
            <option value={assignee.id} key={assignee.id}>{assignee.displayName}</option>
          ))}
        </select>
      </label>
      <div className="manual-payment-filter-actions">
        <button className="admin-primary" disabled={busy} type="submit">
          <MagnifyingGlass aria-hidden="true" />{copy(locale, "查询", "Search")}
        </button>
        {hasManualPaymentFilters(query) && (
          <button className="admin-secondary" type="button" onClick={onClear}>
            <X aria-hidden="true" />{copy(locale, "清空筛选", "Clear filters")}
          </button>
        )}
      </div>
    </form>
  );
}
