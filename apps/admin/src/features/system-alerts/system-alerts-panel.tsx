import {
  ArrowsClockwise,
  BellRinging,
  CheckCircle,
  PaperPlaneTilt,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import {
  useAdminStatus,
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../../admin-experience";
import {
  formatDate,
  PanelState,
  RefreshNotice,
} from "../../admin-ui";
import { ApiError, type Locale } from "../../api";
import {
  getSystemAlertDeliveries,
  retrySystemAlertDelivery,
  testSystemAlertDelivery,
  type SystemAlertDeliveryItem,
  type SystemAlertSource,
} from "./api";

const copy = (locale: Locale, zh: string, en: string): string =>
  locale === "zh" ? zh : en;

export function SystemAlertsPanel({
  canWrite,
  locale,
  source,
}: {
  canWrite: boolean;
  locale: Locale;
  source: SystemAlertSource;
}) {
  const loader = useCallback(
    (signal: AbortSignal) => getSystemAlertDeliveries(source, signal),
    [source],
  );
  const resource = useCachedAdminResource(
    `system-alerts:${source}`,
    loader,
  );
  const slow = useSlowAdminRequest(resource.state);
  const { notify } = useAdminStatus();
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const readyReason = reason.trim().length >= 8;
  const data = resource.data;

  const commitDelivery = (delivery: SystemAlertDeliveryItem) => {
    if (!resource.data) return;
    resource.commit({
      ...resource.data,
      items: [
        delivery,
        ...resource.data.items.filter((item) => item.id !== delivery.id),
      ],
    });
  };

  const testChannel = async () => {
    if (!canWrite || !readyReason || busyId) return;
    setBusyId("test");
    setError("");
    try {
      const delivery = await testSystemAlertDelivery(source, reason.trim());
      commitDelivery(delivery);
      const delivered = delivery.status === "DELIVERED";
      const message = delivered
        ? copy(
            locale,
            "Telegram 测试告警已取得真实消息回执。",
            "The Telegram test alert received a real message receipt.",
          )
        : copy(
            locale,
            "测试告警已入队，尚未取得外部回执。",
            "The test alert was queued without an external receipt.",
          );
      notify(message, delivered ? "success" : "error");
      void resource.reload();
    } catch (requestError) {
      const message = alertErrorMessage(requestError, locale);
      setError(message);
      notify(message, "error");
    } finally {
      setBusyId("");
    }
  };

  const retry = async (id: string) => {
    if (!canWrite || !readyReason || busyId) return;
    setBusyId(id);
    setError("");
    try {
      const delivery = await retrySystemAlertDelivery(id, reason.trim());
      commitDelivery(delivery);
      const delivered = delivery.status === "DELIVERED";
      const message = delivered
        ? copy(locale, "告警重试已取得真实 Telegram 回执。", "The alert retry received a real Telegram receipt.")
        : copy(locale, "告警已重新入队，尚未取得外部回执。", "The alert was queued again without an external receipt.");
      notify(message, delivered ? "success" : "error");
      void resource.reload();
    } catch (requestError) {
      const message = alertErrorMessage(requestError, locale);
      setError(message);
      notify(message, "error");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="admin-panel system-alerts-panel">
      <RefreshNotice
        locale={locale}
        retry={() => void resource.reload()}
        slow={slow}
        state={resource.state}
      />
      {!data ? (
        <PanelState
          kind="cards"
          locale={locale}
          retry={() => void resource.reload()}
          state={resource.state}
        />
      ) : (
        <>
          <div className="system-alerts-heading">
            <div>
              <span><BellRinging size={21} aria-hidden="true" /></span>
              <div>
                <small>{copy(locale, "自动告警投递", "Automated alert delivery")}</small>
                <h2>
                  {source === "SECURITY"
                    ? copy(locale, "安全信号告警", "Security signal alerts")
                    : copy(locale, "备份异常告警", "Backup exception alerts")}
                </h2>
              </div>
            </div>
            <button
              type="button"
              className="admin-secondary"
              onClick={() => void resource.reload()}
            >
              <ArrowsClockwise
                className={resource.state === "refreshing" ? "spin" : ""}
                size={17}
              />
              {copy(locale, "刷新", "Refresh")}
            </button>
          </div>

          <div className={`system-alerts-readiness is-${data.readiness.connectionState.toLocaleLowerCase()}`}>
            {data.readiness.connectionState === "CONNECTED"
              ? <CheckCircle size={19} aria-hidden="true" />
              : <WarningCircle size={19} aria-hidden="true" />}
            <div>
              <strong>{connectionLabel(data.readiness.connectionState, locale)}</strong>
              <p>
                {copy(
                  locale,
                  `群组：${data.readiness.recipientGroupLabel || "—"}；待处理 ${data.readiness.pendingCount}，失败 ${data.readiness.failedCount}，已送达 ${data.readiness.deliveredCount}。`,
                  `Group: ${data.readiness.recipientGroupLabel || "—"}; ${data.readiness.pendingCount} pending, ${data.readiness.failedCount} failed, ${data.readiness.deliveredCount} delivered.`,
                )}
              </p>
            </div>
          </div>

          <div className="system-alerts-actions">
            <label>
              <span>{copy(locale, "测试或重试原因", "Test or retry reason")}</span>
              <input
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                placeholder={copy(locale, "至少 8 个字符，并写入审计记录", "At least 8 characters; stored in the audit log")}
              />
            </label>
            <button
              type="button"
              className="admin-primary"
              disabled={!canWrite || !readyReason || Boolean(busyId)}
              onClick={() => void testChannel()}
            >
              <PaperPlaneTilt size={17} aria-hidden="true" />
              {busyId === "test"
                ? copy(locale, "发送中…", "Sending…")
                : copy(locale, "发送测试告警", "Send test alert")}
            </button>
          </div>
          {!canWrite && (
            <p className="system-alerts-permission">
              {copy(
                locale,
                "当前账号可查看告警投递记录，但不能发送测试消息或重试失败记录。",
                "This account can view alert deliveries but cannot send tests or retry failures.",
              )}
            </p>
          )}
          {error && <p className="form-error system-alerts-error" role="alert"><WarningCircle />{error}</p>}

          <div
            className="system-alerts-table-wrap"
            tabIndex={0}
            aria-label={copy(locale, "系统告警投递表，可横向滚动", "System alert delivery table, horizontally scrollable")}
          >
            <table className="system-alerts-table">
              <thead>
                <tr>
                  <th>{copy(locale, "创建时间", "Created")}</th>
                  <th>{copy(locale, "告警", "Alert")}</th>
                  <th>{copy(locale, "级别", "Severity")}</th>
                  <th>{copy(locale, "状态", "Status")}</th>
                  <th>{copy(locale, "尝试", "Attempts")}</th>
                  <th>{copy(locale, "外部回执", "External receipt")}</th>
                  <th>{copy(locale, "错误码", "Error code")}</th>
                  <th>{copy(locale, "操作", "Action")}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      {copy(locale, "尚无该范围的真实告警投递记录。", "No live alert deliveries exist for this scope.")}
                    </td>
                  </tr>
                ) : data.items.map((item) => (
                  <tr key={item.id}>
                    <td><time dateTime={item.createdAt}>{formatDate(item.createdAt, locale)}</time></td>
                    <td title={item.summary[locale]}><strong>{item.title[locale]}</strong></td>
                    <td>{item.severity === "HIGH" ? copy(locale, "高", "High") : copy(locale, "中", "Medium")}</td>
                    <td><AlertStatus item={item} locale={locale} /></td>
                    <td>{item.attemptCount}</td>
                    <td><code title={item.telegramMessageId ?? ""}>{item.telegramMessageId ?? "—"}</code></td>
                    <td><code title={item.errorCode ?? ""}>{item.errorCode ?? "—"}</code></td>
                    <td>
                      <button
                        type="button"
                        className="admin-secondary"
                        disabled={
                          !canWrite
                          || !readyReason
                          || Boolean(busyId)
                          || item.status !== "FAILED"
                        }
                        onClick={() => void retry(item.id)}
                      >
                        {busyId === item.id
                          ? copy(locale, "重试中…", "Retrying…")
                          : copy(locale, "重试", "Retry")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function AlertStatus({
  item,
  locale,
}: {
  item: SystemAlertDeliveryItem;
  locale: Locale;
}) {
  const label = item.status === "DELIVERED"
    ? copy(locale, "已送达", "Delivered")
    : item.status === "FAILED"
      ? copy(locale, "已终止", "Failed")
      : item.status === "RETRY_SCHEDULED"
        ? copy(locale, "等待重试", "Retry scheduled")
        : copy(locale, "待发送", "Pending");
  return (
    <span className={`system-alert-status is-${item.status.toLocaleLowerCase()}`}>
      {label}
    </span>
  );
}

function connectionLabel(
  state: "MISSING_SECRETS" | "UNVERIFIED" | "DISABLED" | "CONNECTED",
  locale: Locale,
): string {
  if (state === "CONNECTED") {
    return copy(locale, "Telegram 告警通道已验证并启用", "Telegram alert channel verified and enabled");
  }
  if (state === "DISABLED") {
    return copy(locale, "Telegram 已验证，但通知开关未启用", "Telegram is verified, but delivery is disabled");
  }
  if (state === "UNVERIFIED") {
    return copy(locale, "Telegram 密钥存在，但尚未通过真实连接测试", "Telegram secrets exist, but no real connection test has passed");
  }
  return copy(locale, "Telegram 服务端密钥尚未配置", "Telegram server secrets are not configured");
}

function alertErrorMessage(error: unknown, locale: Locale): string {
  if (error instanceof ApiError && error.code === "TELEGRAM_DELIVERY_NOT_ENABLED") {
    return copy(
      locale,
      "Telegram 必须先在“新订单机器人”页面完成真实连接测试并有效启用。",
      "Telegram must pass a real connection test and be enabled on the new-order bot page first.",
    );
  }
  if (error instanceof ApiError && error.status === 403) {
    return copy(locale, "当前账号没有执行此告警操作的权限。", "This account cannot perform this alert operation.");
  }
  return copy(locale, "服务器没有确认告警操作完成，请刷新记录后重试。", "The server did not confirm the alert operation. Refresh the records and try again.");
}
