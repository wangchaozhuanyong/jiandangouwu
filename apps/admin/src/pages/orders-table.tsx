import {
  Eye,
  SlidersHorizontal,
  WarningCircle,
} from "@phosphor-icons/react";
import { useState } from "react";
import {
  revealOrderContact,
  updateOrderStatus,
  type AdminOrder,
  type Locale,
} from "../api";
import { invalidateAdminCache, useAdminStatus } from "../admin-experience";
import { formatDate, StatusPill, statusLabels } from "../admin-ui";
import { adminCopy } from "../i18n";

export function OrdersTable({
  orders,
  locale,
  compact = false,
  onChanged,
  onPreviewOrder,
}: {
  orders: AdminOrder[];
  locale: Locale;
  compact?: boolean;
  onChanged?: () => void;
  onPreviewOrder?: (order: AdminOrder) => void;
}) {
  const t = adminCopy[locale];
  const { notify } = useAdminStatus();
  const [editing, setEditing] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState("CONTACTED");
  const [reason, setReason] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const reveal = async (order: AdminOrder) => {
    if (busy || !window.confirm(t.revealConfirm as string)) return;
    setBusy(true);
    setActionError("");
    try {
      const value = await revealOrderContact(order.id);
      setRevealed((current) => ({ ...current, [order.id]: value.contact }));
      notify(locale === "zh" ? "联系方式已安全显示，操作已写入审计。" : "Contact revealed and audit event recorded.");
    } catch {
      setActionError(t.securityError as string);
      notify(t.securityError as string, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="data-table order-table" tabIndex={0} aria-label={locale === "zh" ? "订单数据表，可横向滚动" : "Orders table, horizontally scrollable"}>
      <div className="table-head"><span>{t.orderNumber as string}</span><span>{t.product as string}</span><span>{t.contact as string}</span><span>{t.amount as string}</span><span>{t.status as string}</span><span>{t.created as string}</span><span /></div>
      {orders.length === 0 && <div className="table-empty">{t.empty as string}</div>}
      {orders.map((order) => (
        <div className="table-row" key={order.id}>
          <code>{order.orderNumber}</code>
          <strong title={order.productNameSnapshot}>{order.productNameSnapshot}</strong>
          <button className="masked-contact" disabled={compact || busy} onClick={() => !compact && void reveal(order)}>{revealed[order.id] ?? order.maskedContact}</button>
          <span>{order.amount} {order.currencyCode}</span>
          <StatusPill status={order.status} locale={locale} />
          <small>{formatDate(order.createdAt, locale)}</small>
          {!compact && (
            <div className="row-actions">
              <button
                className="row-action"
                aria-label={locale === "zh" ? `预览订单工作台 ${order.orderNumber}` : `Preview order workbench ${order.orderNumber}`}
                onClick={() => onPreviewOrder?.(order)}
              >
                <Eye />
              </button>
              <button
                className="row-action"
                aria-label={`${t.changeStatus as string} ${order.orderNumber}`}
                aria-expanded={editing === order.id}
                onClick={() => setEditing(editing === order.id ? null : order.id)}
              >
                <SlidersHorizontal />
              </button>
            </div>
          )}
          {editing === order.id && (
            <form className="inline-order-editor" onSubmit={(event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setActionError("");
              void updateOrderStatus(order.id, nextStatus, reason)
                .then(() => {
                  invalidateAdminCache("orders", "dashboard");
                  setEditing(null);
                  setReason("");
                  notify(locale === "zh" ? "订单状态已更新。" : "Order status updated.");
                  onChanged?.();
                })
                .catch(() => {
                  setActionError(t.saveError as string);
                  notify(t.saveError as string, "error");
                })
                .finally(() => setBusy(false));
            }}>
              <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
                {["CONTACTED", "AWAITING_PAYMENT", "PAYMENT_PROCESSING", "PAID", "FULFILLING", "COMPLETED", "CANCELLED", "REFUND_PENDING", "REFUNDED", "DISPUTED"].map((status) => <option value={status} key={status}>{statusLabels[status]?.[locale] ?? status}</option>)}
              </select>
              <input value={reason} onChange={(event) => setReason(event.target.value)} minLength={4} placeholder={t.reason as string} required />
              <button className="admin-primary" disabled={busy}>{busy ? t.submitting as string : t.changeStatus as string}</button>
            </form>
          )}
        </div>
      ))}
      {actionError && <p className="table-action-error" role="alert"><WarningCircle />{actionError}</p>}
    </div>
  );
}
