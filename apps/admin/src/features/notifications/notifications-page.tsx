import {
  type AdminTelegramNewOrderSettings,
  type Locale,
  type TelegramNewOrderFieldCode,
} from "@cloudbridge/contracts";
import {
  ArrowsClockwise,
  Bell,
  CheckCircle,
  ClockCounterClockwise,
  Key,
  PaperPlaneTilt,
  ShieldWarning,
  TelegramLogo,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useMemo,
} from "react";
import {
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../../admin-experience";
import {
  formatDate,
  PanelState,
  RefreshNotice,
} from "../../admin-ui";
import { ApiError } from "../../api";
import { getTelegramNewOrderSettings } from "./api";
import {
  buildNotificationReadiness,
  type NotificationReadinessGateCode,
} from "./model";

const copy = (locale: Locale, zh: string, en: string): string =>
  locale === "zh" ? zh : en;

const fieldLabels: Record<TelegramNewOrderFieldCode, Record<Locale, string>> = {
  ORDER_NUMBER: { zh: "订单号", en: "Order number" },
  PRODUCT: { zh: "商品", en: "Product" },
  AMOUNT: { zh: "金额", en: "Amount" },
  CURRENCY: { zh: "币种", en: "Currency" },
  STATUS: { zh: "订单状态", en: "Order status" },
  CREATED_AT: { zh: "创建时间", en: "Created at" },
  CONTACT_CHANNEL: { zh: "联系渠道", en: "Contact channel" },
  MASKED_CONTACT: { zh: "脱敏联系方式", en: "Masked contact" },
};

const gateCopy: Record<
  NotificationReadinessGateCode,
  {
    title: Record<Locale, string>;
    body: Record<Locale, string>;
  }
> = {
  DELIVERY_RUNTIME: {
    title: { zh: "投递运行时", en: "Delivery runtime" },
    body: {
      zh: "尚未连接 Telegram Bot 与订单事件。",
      en: "The Telegram bot and order event are not connected.",
    },
  },
  BOT_CREDENTIAL: {
    title: { zh: "服务端凭据", en: "Server credential" },
    body: {
      zh: "Bot Token 尚未在服务端配置。",
      en: "No bot token is configured on the server.",
    },
  },
  EXTERNAL_VERIFICATION: {
    title: { zh: "外部投递核验", en: "External verification" },
    body: {
      zh: "尚无来自 Telegram 的真实投递回执。",
      en: "No real Telegram delivery receipt is available.",
    },
  },
  DELIVERY_EVENT_STORE: {
    title: { zh: "投递事件存储", en: "Delivery event store" },
    body: {
      zh: "尚未开发投递记录、已读状态与失败结果存储。",
      en: "Delivery records, read states, and failure results are not implemented.",
    },
  },
  RETRY_QUEUE: {
    title: { zh: "幂等与重试队列", en: "Idempotency and retry queue" },
    body: {
      zh: "尚未开发自动重试、去重与最终失败处理。",
      en: "Retry, deduplication, and terminal failure handling are not implemented.",
    },
  },
};

export default function NotificationsPage({
  canRead,
  locale,
  onOpenTelegram,
}: {
  canRead: boolean;
  locale: Locale;
  onOpenTelegram: () => void;
}) {
  const loader = useCallback(
    (signal: AbortSignal) => canRead
      ? getTelegramNewOrderSettings(signal)
      : Promise.reject(new ApiError("Forbidden", 403, "FORBIDDEN")),
    [canRead],
  );
  const resource = useCachedAdminResource<AdminTelegramNewOrderSettings>(
    canRead ? "telegram-new-order-settings" : "notification-readiness:forbidden",
    loader,
  );
  const slow = useSlowAdminRequest(resource.state);
  const readiness = useMemo(
    () => resource.data ? buildNotificationReadiness(resource.data) : null,
    [resource.data],
  );
  const settingsUpdated = readiness
    && readiness.route.version === 0
    && Date.parse(readiness.route.updatedAt) <= 0
    ? copy(locale, "从未保存", "Never saved")
    : readiness
      ? formatDate(readiness.route.updatedAt, locale)
      : "";

  const retry = () => {
    void resource.reload();
  };

  return (
    <section className="notification-page">
      <div className="notification-truth-note" role="note">
        <WarningCircle size={20} aria-hidden="true" />
        <span>
          <strong>{copy(locale, "通知投递尚未接通", "Notification delivery is not connected")}</strong>
          {copy(
            locale,
            "本页只读取平台数据库中已保存的 Telegram 新订单配置与真实接通状态；没有投递记录时显示“未采集”，不会用 0 或虚构通知冒充结果。",
            "This page only reads the saved platform-database Telegram new-order configuration and its real connection state. Missing delivery records are shown as “not collected,” never as zero or fabricated notifications.",
          )}
        </span>
      </div>

      {!canRead ? (
        <section className="admin-panel">
          <PanelState state="forbidden" locale={locale} retry={() => undefined} kind="cards" />
        </section>
      ) : !readiness ? (
        <section className="admin-panel">
          <PanelState state={resource.state} locale={locale} retry={retry} kind="cards" />
        </section>
      ) : (
        <>
          <div className="notification-summary">
            <NotificationStat
              icon={TelegramLogo}
              label={copy(locale, "已保存路由", "Saved route")}
              value="Telegram"
              detail="ORDER_CREATED"
            />
            <NotificationStat
              icon={PaperPlaneTilt}
              label={copy(locale, "实际投递", "Actual delivery")}
              value={copy(locale, "未接通", "Not connected")}
              detail={readiness.route.connectionState}
              tone="warning"
            />
            <NotificationStat
              icon={Key}
              label={copy(locale, "服务端凭据", "Server credential")}
              value={copy(locale, "未配置", "Not configured")}
              detail={copy(locale, "Token configured · 否", "Token configured · No")}
              tone="warning"
            />
            <NotificationStat
              icon={ClockCounterClockwise}
              label={copy(locale, "投递证据", "Delivery evidence")}
              value={copy(locale, "未采集", "Not collected")}
              detail={readiness.deliveryEvidenceState}
              tone="neutral"
            />
          </div>

          <div className="notification-toolbar">
            <p>
              <Bell size={17} aria-hidden="true" />
              {copy(
                locale,
                "配置页负责保存未来启用意向；本页负责判断真实上线门槛。",
                "The configuration page stores future intent; this page evaluates real launch gates.",
              )}
            </p>
            <button className="admin-secondary" onClick={retry} type="button">
              <ArrowsClockwise size={17} aria-hidden="true" />
              {copy(locale, "刷新状态", "Refresh status")}
            </button>
            <button className="admin-primary" onClick={onOpenTelegram} type="button">
              <TelegramLogo size={17} aria-hidden="true" />
              {copy(locale, "打开 Telegram 配置", "Open Telegram configuration")}
            </button>
          </div>

          <RefreshNotice
            state={resource.state}
            locale={locale}
            retry={retry}
            slow={slow}
          />

          <div className="notification-readiness-layout" aria-busy={resource.state === "refreshing"}>
            <section className="admin-panel notification-route">
              <div className="notification-panel-heading">
                <div>
                  <small>{copy(locale, "真实配置快照", "LIVE CONFIGURATION SNAPSHOT")}</small>
                  <h2>{copy(locale, "Telegram 新订单路由", "Telegram new-order route")}</h2>
                  <p>{copy(locale, "读取现有设置，不发送消息。", "Reads the existing settings without sending a message.")}</p>
                </div>
                <span className="notification-state is-blocked">
                  {readiness.route.connectionState}
                </span>
              </div>

              <dl className="notification-route-facts">
                <div>
                  <dt>{copy(locale, "事件", "Event")}</dt>
                  <dd><code>{readiness.route.eventType}</code></dd>
                </div>
                <div>
                  <dt>{copy(locale, "未来启用意向", "Future activation intent")}</dt>
                  <dd>{readiness.route.requestedEnabled ? copy(locale, "已请求", "Requested") : copy(locale, "未请求", "Not requested")}</dd>
                </div>
                <div>
                  <dt>{copy(locale, "实际启用", "Effective delivery")}</dt>
                  <dd>{copy(locale, "否", "No")}</dd>
                </div>
                <div>
                  <dt>{copy(locale, "外部核验", "External verification")}</dt>
                  <dd>{copy(locale, "否", "No")}</dd>
                </div>
                <div>
                  <dt>{copy(locale, "接收组显示名称", "Recipient display label")}</dt>
                  <dd>{readiness.route.recipientGroupLabel || copy(locale, "未填写", "Not entered")}</dd>
                </div>
                <div>
                  <dt>{copy(locale, "配置版本", "Configuration version")}</dt>
                  <dd><code>v{readiness.route.version}</code></dd>
                </div>
              </dl>

              <div className="notification-allowlist">
                <div>
                  <strong>{copy(locale, "脱敏字段白名单", "Masked field allowlist")}</strong>
                  <small>
                    {readiness.route.includedFields.length} / {Object.keys(fieldLabels).length}
                  </small>
                </div>
                {readiness.route.includedFields.length > 0 ? (
                  <ul>
                    {readiness.route.includedFields.map((field) => (
                      <li key={field}>
                        <CheckCircle size={15} aria-hidden="true" />
                        <span>{fieldLabels[field][locale]}</span>
                        <code>{field}</code>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{copy(locale, "尚未选择任何字段。", "No fields selected.")}</p>
                )}
              </div>

              <p className="notification-updated">
                {copy(locale, "设置更新时间", "Settings updated")} · {settingsUpdated}
              </p>
            </section>

            <section className="admin-panel notification-gates">
              <div className="notification-panel-heading">
                <div>
                  <small>{copy(locale, "上线门槛", "LAUNCH GATES")}</small>
                  <h2>{copy(locale, "仍需完成的通知基础设施", "Notification infrastructure still required")}</h2>
                  <p>{copy(locale, "阻塞项与尚未开发项分开显示。", "Blocked and not-implemented items remain distinct.")}</p>
                </div>
              </div>
              <ol>
                {readiness.gates.map((gate) => (
                  <li key={gate.code}>
                    <span className={`notification-gate-icon is-${gate.state === "BLOCKED" ? "blocked" : "missing"}`}>
                      {gate.state === "BLOCKED"
                        ? <ShieldWarning size={18} aria-hidden="true" />
                        : <ClockCounterClockwise size={18} aria-hidden="true" />}
                    </span>
                    <div>
                      <strong>{gateCopy[gate.code].title[locale]}</strong>
                      <p>{gateCopy[gate.code].body[locale]}</p>
                    </div>
                    <span className={`notification-state is-${gate.state === "BLOCKED" ? "blocked" : "missing"}`}>
                      {gate.state === "BLOCKED"
                        ? copy(locale, "阻塞", "Blocked")
                        : copy(locale, "未开发", "Not implemented")}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <section className="admin-panel notification-evidence">
            <span><ClockCounterClockwise size={23} aria-hidden="true" /></span>
            <div>
              <small>{readiness.deliveryEvidenceState}</small>
              <h2>{copy(locale, "当前没有可核验的投递历史", "No verifiable delivery history is available")}</h2>
              <p>
                {copy(
                  locale,
                  "系统尚未建立投递事件存储，因此不能展示发送时间、接收结果、未读数量、失败次数或重试状态。这些数据是未采集，不是零。",
                  "No delivery event store exists yet, so sent time, recipient result, unread count, failure count, and retry state cannot be shown. These values are not collected, not zero.",
                )}
              </p>
            </div>
          </section>
        </>
      )}
    </section>
  );
}

function NotificationStat({
  icon: Icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: typeof Bell;
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "warning" | "neutral";
}) {
  return (
    <article className={`notification-stat is-${tone}`}>
      <span><Icon size={21} aria-hidden="true" /></span>
      <small>{label}</small>
      <strong>{value}</strong>
      <em>{detail}</em>
    </article>
  );
}
