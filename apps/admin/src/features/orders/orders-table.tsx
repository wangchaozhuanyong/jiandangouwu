import type {
  AdminOrderListItem,
  Locale,
  ManualPaymentStage,
  OrderStatus,
} from "@cloudbridge/contracts";
import { Eye } from "@phosphor-icons/react";
import { formatDate, StatusPill } from "../../admin-ui";

const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

const paymentStageLabels: Record<ManualPaymentStage, Record<Locale, string>> = {
  NOT_RECORDED: { zh: "未人工记录", en: "Not recorded" },
  EXTERNAL_PROCESSING_UNVERIFIED: { zh: "外部处理中·未核验", en: "External processing · unverified" },
  MANUALLY_RECORDED_PAID: { zh: "人工记录已付款", en: "Manually recorded paid" },
  REFUND_REVIEW: { zh: "退款复核", en: "Refund review" },
  MANUALLY_RECORDED_REFUNDED: { zh: "人工记录已退款", en: "Manually recorded refunded" },
  DISPUTE_REVIEW: { zh: "争议复核", en: "Dispute review" },
  CANCELLED: { zh: "已取消", en: "Cancelled" },
};

const fallbackPaymentStage = (status: OrderStatus): ManualPaymentStage => {
  if (status === "PAYMENT_PROCESSING") return "EXTERNAL_PROCESSING_UNVERIFIED";
  if (status === "PAID" || status === "FULFILLING" || status === "COMPLETED") return "MANUALLY_RECORDED_PAID";
  if (status === "REFUND_PENDING") return "REFUND_REVIEW";
  if (status === "REFUNDED") return "MANUALLY_RECORDED_REFUNDED";
  if (status === "DISPUTED") return "DISPUTE_REVIEW";
  if (status === "CANCELLED") return "CANCELLED";
  return "NOT_RECORDED";
};

export function OrdersTable({
  compact = false,
  locale,
  onOpenOrder,
  orders,
}: {
  compact?: boolean;
  locale: Locale;
  onOpenOrder?: (order: AdminOrderListItem) => void;
  orders: AdminOrderListItem[];
}) {
  return (
    <div
      className={`data-table order-table${compact ? " is-compact" : ""}`}
      tabIndex={0}
      aria-label={copy(locale, "订单数据表，可横向滚动", "Orders table, horizontally scrollable")}
    >
      <table className="order-record-table">
        <thead>
          <tr>
            <th scope="col">{copy(locale, "订单号", "Order")}</th>
            <th scope="col">{copy(locale, "创建时间", "Created")}</th>
            <th scope="col">{copy(locale, "商品", "Product")}</th>
            <th scope="col">{copy(locale, "金额", "Amount")}</th>
            <th scope="col">{copy(locale, "币种", "Currency")}</th>
            <th scope="col">{copy(locale, "参考金额", "Reference amount")}</th>
            <th scope="col">{copy(locale, "参考币种", "Reference currency")}</th>
            <th scope="col">{copy(locale, "渠道", "Channel")}</th>
            <th scope="col">{copy(locale, "脱敏账号", "Masked account")}</th>
            <th scope="col">{copy(locale, "订单状态", "Order status")}</th>
            <th scope="col">{copy(locale, "人工付款记录阶段", "Manual payment record")}</th>
            <th scope="col">{copy(locale, "负责人", "Owner")}</th>
            <th scope="col">{copy(locale, "预留到期", "Reserved until")}</th>
            <th scope="col">{copy(locale, "操作", "Action")}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const paymentStage = order.paymentStage ?? fallbackPaymentStage(order.status);
            return (
              <tr key={order.id}>
                <td><code>{order.orderNumber}</code></td>
                <td><time dateTime={order.createdAt}>{formatDate(order.createdAt, locale)}</time></td>
                <td className="order-product-cell" title={order.productNameSnapshot}>{order.productNameSnapshot}</td>
                <td>{order.amount.amount}</td>
                <td><code>{order.amount.currency}</code></td>
                <td>{order.referenceAmount?.amount ?? "—"}</td>
                <td><code>{order.referenceAmount?.currency ?? "—"}</code></td>
                <td><code>{order.contactChannel}</code></td>
                <td className="order-contact-cell" title={order.maskedContact}>{order.maskedContact}</td>
                <td><StatusPill status={order.status} locale={locale} /></td>
                <td>
                  <span className={`manual-payment-stage is-${paymentStage.toLocaleLowerCase()}`}>
                    {paymentStageLabels[paymentStage][locale]}
                  </span>
                </td>
                <td>{order.assignedTo?.displayName ?? copy(locale, "未分配", "Unassigned")}</td>
                <td><time dateTime={order.reservedUntil}>{formatDate(order.reservedUntil, locale)}</time></td>
                <td>
                  {onOpenOrder ? (
                    <button
                      className="row-action"
                      aria-label={copy(locale, `查看订单 ${order.orderNumber}`, `View order ${order.orderNumber}`)}
                      onClick={() => onOpenOrder(order)}
                    >
                      <Eye aria-hidden="true" />
                    </button>
                  ) : <span aria-hidden="true">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
