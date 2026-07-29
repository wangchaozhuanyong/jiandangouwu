import type {
  AdminManualPaymentEvent,
  Locale,
  ManualPaymentEventType,
} from "@cloudbridge/contracts";
import { Eye } from "@phosphor-icons/react";
import { formatDate } from "../../admin-ui";

const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

const eventLabels: Record<ManualPaymentEventType, Record<Locale, string>> = {
  MANUALLY_RECORDED_PAID: { zh: "人工记录已付款", en: "Manually recorded paid" },
  REFUND_REVIEW_STARTED: { zh: "退款复核", en: "Refund review" },
  MANUALLY_RECORDED_REFUNDED: { zh: "人工记录已退款", en: "Manually recorded refunded" },
  DISPUTE_REVIEW_STARTED: { zh: "争议复核", en: "Dispute review" },
};

export function ManualPaymentsTable({
  events,
  locale,
  onOpenOrder,
}: {
  events: AdminManualPaymentEvent[];
  locale: Locale;
  onOpenOrder: (event: AdminManualPaymentEvent) => void;
}) {
  return (
    <div
      className="data-table manual-payments-table"
      tabIndex={0}
      aria-label={copy(locale, "人工收款记录表，可横向滚动", "Manual payment records table, horizontally scrollable")}
    >
      <table className="manual-payment-record-table">
        <thead>
          <tr>
            <th scope="col">{copy(locale, "事件 ID", "Event ID")}</th>
            <th scope="col">{copy(locale, "记录时间", "Recorded")}</th>
            <th scope="col">{copy(locale, "订单号", "Order")}</th>
            <th scope="col">{copy(locale, "商品", "Product")}</th>
            <th scope="col">{copy(locale, "记录类型", "Record type")}</th>
            <th scope="col">{copy(locale, "金额", "Amount")}</th>
            <th scope="col">{copy(locale, "币种", "Currency")}</th>
            <th scope="col">{copy(locale, "参考金额", "Reference amount")}</th>
            <th scope="col">{copy(locale, "参考币种", "Reference currency")}</th>
            <th scope="col">{copy(locale, "汇率快照", "Rate snapshot")}</th>
            <th scope="col">{copy(locale, "操作者", "Actor")}</th>
            <th scope="col">{copy(locale, "原因", "Reason")}</th>
            <th scope="col">{copy(locale, "当前负责人", "Current owner")}</th>
            <th scope="col">{copy(locale, "外部核验", "External verification")}</th>
            <th scope="col">{copy(locale, "操作", "Action")}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.statusHistoryId}>
              <td><code>{event.statusHistoryId}</code></td>
              <td><time dateTime={event.recordedAt}>{formatDate(event.recordedAt, locale)}</time></td>
              <td><code>{event.orderNumber}</code></td>
              <td className="manual-payment-product" title={event.productNameSnapshot}>{event.productNameSnapshot}</td>
              <td><span className={`manual-payment-event-type is-${event.eventType.toLocaleLowerCase()}`}>{eventLabels[event.eventType][locale]}</span></td>
              <td>{event.orderAmount.amount}</td>
              <td>{event.orderAmount.currency}</td>
              <td>{event.referenceAmount?.amount ?? "—"}</td>
              <td>{event.referenceAmount?.currency ?? "—"}</td>
              <td><code>{event.exchangeRateSnapshot}</code></td>
              <td>{event.actor?.displayName ?? copy(locale, "系统", "System")}</td>
              <td className="manual-payment-reason" title={event.reason ?? ""}>{event.reason ?? "—"}</td>
              <td>{event.currentAssignee?.displayName ?? copy(locale, "未分配", "Unassigned")}</td>
              <td>
                <span className={`external-verification is-${event.externalActionVerified ? "verified" : "unverified"}`}>
                  {event.externalActionVerified
                    ? copy(locale, "已核验", "Verified")
                    : copy(locale, "未核验", "Unverified")}
                </span>
              </td>
              <td>
                <button
                  className="row-action"
                  type="button"
                  aria-label={copy(locale, `查看订单 ${event.orderNumber}`, `View order ${event.orderNumber}`)}
                  onClick={() => onOpenOrder(event)}
                >
                  <Eye aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
