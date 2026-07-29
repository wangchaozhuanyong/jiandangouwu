import type {
  AdminOrderAssignee,
  AdminOrderDetail,
  Locale,
  OrderStatus,
} from "@cloudbridge/contracts";
import {
  Coins,
  Package,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAdminPageDirty, useAdminStatus, useCachedAdminResource, useSlowAdminRequest } from "../../admin-experience";
import {
  Dialog,
  formatDate,
  PanelState,
  RefreshNotice,
  StatusPill,
  statusLabels,
  useUnsavedChanges,
} from "../../admin-ui";
import { ApiError } from "../../api";
import {
  assignAdminOrder,
  getAdminOrderDetail,
  updateAdminOrderStatus,
} from "./api";
import { OrderTimeline } from "./order-timeline";
import { SensitiveContactPanel } from "./sensitive-contact-panel";

const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;
const sensitiveStatuses = new Set<OrderStatus>([
  "PAYMENT_PROCESSING",
  "PAID",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
  "DISPUTED",
]);

const requestErrorMessage = (error: unknown, locale: Locale): string => {
  if (!navigator.onLine) return copy(locale, "当前处于离线状态，草稿已保留。", "You are offline. The draft is preserved.");
  if (error instanceof ApiError && error.status === 403) {
    return copy(locale, "当前账号没有执行此订单操作的权限。", "This account cannot perform this order action.");
  }
  if (error instanceof ApiError && error.status === 404) {
    return copy(locale, "订单已不存在，请关闭详情并刷新列表。", "This order no longer exists. Close the detail and refresh the list.");
  }
  return copy(locale, "服务器未确认本次订单操作，草稿已保留。", "The server did not confirm this order action. The draft is preserved.");
};

export function OrderDetailDialog({
  assignees,
  canRevealContact,
  canWrite,
  locale,
  onClose,
  onSaved,
  orderId,
  orderNumber,
}: {
  assignees: AdminOrderAssignee[] | null;
  canRevealContact: boolean;
  canWrite: boolean;
  locale: Locale;
  onClose: () => void;
  onSaved: (order: AdminOrderDetail) => void;
  orderId: string;
  orderNumber: string;
}) {
  const loader = useCallback(
    (signal: AbortSignal) => getAdminOrderDetail(orderId, signal),
    [orderId],
  );
  const {
    commit,
    data,
    error: loadError,
    reload,
    state,
  } = useCachedAdminResource<AdminOrderDetail>(`orders:detail:${orderId}`, loader);
  const slow = useSlowAdminRequest(state);
  const { notify } = useAdminStatus();
  const initialized = useRef(false);
  const [statusDraft, setStatusDraft] = useState<OrderStatus | "">("");
  const [statusReason, setStatusReason] = useState("");
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [assigneeReason, setAssigneeReason] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [assigneeBusy, setAssigneeBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;
    setAssigneeDraft(data.assignedTo?.id ?? "");
  }, [data]);

  const dirty = Boolean(
    statusDraft
    || statusReason
    || assigneeReason
    || (data && assigneeDraft !== (data.assignedTo?.id ?? "")),
  );
  useUnsavedChanges(dirty);
  useAdminPageDirty(dirty);

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm(copy(locale, "订单详情中有未提交的草稿，确定关闭吗？", "Order details contain an unsaved draft. Close anyway?"))) return;
    onClose();
  }, [dirty, locale, onClose]);

  const refreshAfterConflict = async () => {
    setConflict(true);
    const latest = await reload();
    if (latest) onSaved(latest);
  };

  const saveStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!data || !statusDraft || statusBusy) return;
    if (!data.allowedTransitions.includes(statusDraft)) {
      setActionError(copy(
        locale,
        "服务器最新版本已不允许这个状态流转，请重新选择合法状态。",
        "The latest server version no longer allows this transition. Choose an allowed status.",
      ));
      return;
    }
    const reason = statusReason.trim();
    if (reason.length < 8) {
      setActionError(copy(locale, "状态变更原因去除首尾空格后至少需要 8 个字符。", "Status reason must contain at least 8 characters after trimming."));
      return;
    }
    if (sensitiveStatuses.has(statusDraft) && !window.confirm(copy(
      locale,
      `将订单 ${data.orderNumber} 从“${statusLabels[data.status]?.zh ?? data.status}”改为“${statusLabels[statusDraft]?.zh ?? statusDraft}”。这只记录人工处理状态，不会执行扣款、收款或退款等外部资金动作。确定提交吗？`,
      `Change ${data.orderNumber} from “${statusLabels[data.status]?.en ?? data.status}” to “${statusLabels[statusDraft]?.en ?? statusDraft}”? This records a manual state only and will not charge, collect, or refund external funds.`,
    ))) return;

    setStatusBusy(true);
    setActionError("");
    setConflict(false);
    try {
      const saved = await updateAdminOrderStatus(data.id, {
        expectedStatus: data.status,
        expectedUpdatedAt: data.updatedAt,
        status: statusDraft,
        reason,
      });
      commit(saved);
      onSaved(saved);
      setStatusDraft("");
      setStatusReason("");
      notify(copy(locale, "订单状态已由服务器确认更新。", "The server confirmed the order status update."));
      void reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setActionError(copy(locale, "订单已被其他管理员更新；已重新读取最新详情，你的状态草稿仍保留。", "Another administrator updated this order. The latest detail was loaded and your status draft is preserved."));
        await refreshAfterConflict();
      } else {
        setActionError(requestErrorMessage(error, locale));
      }
    } finally {
      setStatusBusy(false);
    }
  };

  const saveAssignee = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!data || assigneeBusy || assigneeDraft === (data.assignedTo?.id ?? "")) return;
    const reason = assigneeReason.trim();
    if (reason.length < 8) {
      setActionError(copy(locale, "分配原因去除首尾空格后至少需要 8 个字符。", "Assignment reason must contain at least 8 characters after trimming."));
      return;
    }

    setAssigneeBusy(true);
    setActionError("");
    setConflict(false);
    try {
      const saved = await assignAdminOrder(data.id, {
        assigneeId: assigneeDraft || null,
        expectedAssigneeId: data.assignedTo?.id ?? null,
        expectedUpdatedAt: data.updatedAt,
        reason,
      });
      commit(saved);
      onSaved(saved);
      setAssigneeDraft(saved.assignedTo?.id ?? "");
      setAssigneeReason("");
      notify(copy(locale, "订单负责人已由服务器确认更新。", "The server confirmed the order owner update."));
      void reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setActionError(copy(locale, "负责人已被其他管理员修改；已重新读取最新详情，你的分配草稿仍保留。", "Another administrator changed the owner. The latest detail was loaded and your assignment draft is preserved."));
        await refreshAfterConflict();
      } else {
        setActionError(requestErrorMessage(error, locale));
      }
    } finally {
      setAssigneeBusy(false);
    }
  };

  const missingOrder = loadError instanceof ApiError && loadError.status === 404;
  const forbidden = loadError instanceof ApiError && loadError.status === 403;

  return (
    <Dialog
      wide
      title={`${copy(locale, "订单详情", "Order details")} · ${orderNumber}`}
      closeLabel={copy(locale, "关闭订单详情", "Close order details")}
      onClose={requestClose}
    >
      <div className="order-detail-dialog">
        {!data ? (
          missingOrder || forbidden ? (
            <div className="panel-state is-error" role="alert">
              <WarningCircle aria-hidden="true" />
              <p>
                {missingOrder
                  ? copy(locale, "订单已不存在，请关闭详情并刷新列表。", "This order no longer exists. Close the detail and refresh the list.")
                  : copy(locale, "当前账号没有查看此订单详情的权限。", "This account cannot view this order detail.")}
              </p>
            </div>
          ) : (
            <PanelState state={state} locale={locale} retry={() => void reload()} />
          )
        ) : (
          <>
            <RefreshNotice state={state} locale={locale} retry={() => void reload()} slow={slow} />
            {conflict && (
              <p className="order-conflict-notice" role="status">
                <WarningCircle aria-hidden="true" />
                {copy(locale, "正在显示服务器最新版本，未提交草稿仍保留在表单中。", "The latest server version is shown while your unsubmitted draft remains in the form.")}
              </p>
            )}
            <header className="order-detail-summary">
              <div>
                <small>{data.orderNumber}</small>
                <h2>{data.productNameSnapshot}</h2>
                <span>{copy(locale, "更新于", "Updated")} {formatDate(data.updatedAt, locale)}</span>
              </div>
              <StatusPill status={data.status} locale={locale} />
            </header>

            <div className="order-detail-grid">
              <section className="order-detail-section">
                <div className="order-detail-section-heading">
                  <Package aria-hidden="true" />
                  <h3>{copy(locale, "订单与商品快照", "Order and product snapshot")}</h3>
                </div>
                <dl className="order-detail-facts">
                  <div><dt>{copy(locale, "商品 ID", "Product ID")}</dt><dd><code>{data.productId}</code></dd></div>
                  <div><dt>{copy(locale, "商品版本", "Product version")}</dt><dd>{data.productVersion}</dd></div>
                  <div><dt>{copy(locale, "创建时间", "Created")}</dt><dd>{formatDate(data.createdAt, locale)}</dd></div>
                  <div><dt>{copy(locale, "预留到期", "Reserved until")}</dt><dd>{formatDate(data.reservedUntil, locale)}</dd></div>
                  <div><dt>{copy(locale, "政策版本", "Policy version")}</dt><dd><code>{data.acceptedPolicyVersion}</code></dd></div>
                  <div><dt>{copy(locale, "付款模式", "Payment mode")}</dt><dd>{copy(locale, "人工记录", "Manual record")}</dd></div>
                </dl>
              </section>

              <section className="order-detail-section">
                <div className="order-detail-section-heading">
                  <Coins aria-hidden="true" />
                  <h3>{copy(locale, "金额快照", "Amount snapshot")}</h3>
                </div>
                <dl className="order-detail-facts">
                  <div><dt>{copy(locale, "订单金额", "Order amount")}</dt><dd>{data.amount.amount}</dd></div>
                  <div><dt>{copy(locale, "订单币种", "Order currency")}</dt><dd><code>{data.amount.currency}</code></dd></div>
                  <div><dt>{copy(locale, "参考金额", "Reference amount")}</dt><dd>{data.referenceAmount?.amount ?? "—"}</dd></div>
                  <div><dt>{copy(locale, "参考币种", "Reference currency")}</dt><dd><code>{data.referenceAmount?.currency ?? "—"}</code></dd></div>
                  <div><dt>{copy(locale, "汇率快照", "Rate snapshot")}</dt><dd><code>{data.exchangeRateSnapshot}</code></dd></div>
                </dl>
                <p className="manual-payment-warning">
                  {copy(locale, "付款阶段仅代表管理员人工记录，不代表支付机构已扣款、收款或退款。", "Payment stages are manual admin records and do not prove that a provider charged, collected, or refunded funds.")}
                </p>
              </section>
            </div>

            <section className="order-detail-section">
              <div className="order-detail-section-heading">
                <UserCircle aria-hidden="true" />
                <h3>{copy(locale, "负责人和状态处理", "Owner and status operations")}</h3>
              </div>
              <div className="order-operation-grid">
                <div className="order-current-owner">
                  <span>{copy(locale, "当前负责人", "Current owner")}</span>
                  <strong>{data.assignedTo?.displayName ?? copy(locale, "未分配", "Unassigned")}</strong>
                </div>
                {canWrite ? (
                  <>
                    <form onSubmit={saveAssignee}>
                      <label>
                        <span>{copy(locale, "分配负责人", "Assign owner")}</span>
                        <select
                          value={assigneeDraft}
                          disabled={!assignees || assigneeBusy}
                          onChange={(event) => setAssigneeDraft(event.target.value)}
                        >
                          <option value="">{copy(locale, "未分配", "Unassigned")}</option>
                          {data.assignedTo && !assignees?.some((item) => item.id === data.assignedTo?.id) && (
                            <option value={data.assignedTo.id}>{data.assignedTo.displayName}</option>
                          )}
                          {assignees?.map((assignee) => (
                            <option value={assignee.id} key={assignee.id}>{assignee.displayName}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>{copy(locale, "分配原因", "Assignment reason")}</span>
                        <input
                          value={assigneeReason}
                          onChange={(event) => setAssigneeReason(event.target.value)}
                          minLength={8}
                          maxLength={500}
                          required
                        />
                      </label>
                      <button
                        className="admin-secondary"
                        disabled={
                          assigneeBusy
                          || !assignees
                          || assigneeDraft === (data.assignedTo?.id ?? "")
                          || assigneeReason.trim().length < 8
                        }
                      >
                        {assigneeBusy ? copy(locale, "正在保存", "Saving") : copy(locale, "保存负责人", "Save owner")}
                      </button>
                    </form>
                    <form onSubmit={saveStatus}>
                      <label>
                        <span>{copy(locale, "下一状态", "Next status")}</span>
                        <select
                          value={statusDraft}
                          disabled={statusBusy || data.allowedTransitions.length === 0}
                          onChange={(event) => setStatusDraft(event.target.value as OrderStatus | "")}
                        >
                          <option value="">{copy(locale, "请选择合法状态", "Choose an allowed status")}</option>
                          {statusDraft && !data.allowedTransitions.includes(statusDraft) && (
                            <option value={statusDraft}>
                              {statusLabels[statusDraft]?.[locale] ?? statusDraft}
                              {copy(locale, "（旧草稿）", " (stale draft)")}
                            </option>
                          )}
                          {data.allowedTransitions.map((status) => (
                            <option value={status} key={status}>{statusLabels[status]?.[locale] ?? status}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>{copy(locale, "状态变更原因", "Status change reason")}</span>
                        <input
                          value={statusReason}
                          onChange={(event) => setStatusReason(event.target.value)}
                          minLength={8}
                          maxLength={500}
                          required
                        />
                      </label>
                      <button
                        className="admin-primary"
                        disabled={
                          statusBusy
                          || !statusDraft
                          || !data.allowedTransitions.includes(statusDraft)
                          || statusReason.trim().length < 8
                        }
                      >
                        {statusBusy ? copy(locale, "正在保存", "Saving") : copy(locale, "更新状态", "Update status")}
                      </button>
                    </form>
                  </>
                ) : (
                  <p className="order-readonly-note">
                    {copy(locale, "当前账号可查看订单，但没有分配负责人或更新状态的权限。", "This account can view orders but cannot assign owners or update status.")}
                  </p>
                )}
              </div>
              {data.allowedTransitions.length === 0 && (
                <p className="order-terminal-note">{copy(locale, "当前状态没有可用的后续流转。", "No further transitions are available from the current state.")}</p>
              )}
              {actionError && <p className="form-error" role="alert"><WarningCircle aria-hidden="true" />{actionError}</p>}
            </section>

            {canRevealContact ? (
              <SensitiveContactPanel
                channel={data.contactChannel}
                locale={locale}
                maskedContact={data.maskedContact}
                orderId={data.id}
                orderNumber={data.orderNumber}
              />
            ) : (
              <section className="order-detail-section">
                <div className="order-detail-section-heading">
                  <UserCircle aria-hidden="true" />
                  <h3>{copy(locale, "联系方式", "Contact")}</h3>
                </div>
                <dl className="order-contact-summary">
                  <div><dt>{copy(locale, "渠道", "Channel")}</dt><dd>{data.contactChannel}</dd></div>
                  <div><dt>{copy(locale, "脱敏账号", "Masked account")}</dt><dd>{data.maskedContact}</dd></div>
                </dl>
              </section>
            )}

            <OrderTimeline events={data.statusHistory} locale={locale} />
          </>
        )}
      </div>
    </Dialog>
  );
}
