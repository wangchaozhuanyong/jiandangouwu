import {
  ArrowsClockwise,
  Bell,
  ChartLineUp,
  CheckCircle,
  Cube,
  CaretRight,
  ListChecks,
  Receipt,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback } from "react";
import { getOverview, type AdminUser, type Locale, type Overview } from "../api";
import { useCachedAdminResource, useSlowAdminRequest } from "../admin-experience";
import type { Page } from "../admin-model";
import { formatDate, PanelState, RefreshNotice } from "../admin-ui";
import {
  buildDashboardSnapshot,
  type DashboardCapabilityCode,
  type DashboardCapabilityState,
} from "../features/dashboard/model";
import { adminCopy } from "../i18n";
import { OrdersTable } from "./orders-table";

const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

const capabilityCopy: Record<
  DashboardCapabilityCode,
  {
    title: Record<Locale, string>;
    body: Record<Locale, string>;
    action: Record<Locale, string>;
    icon: typeof Receipt;
  }
> = {
  RESERVATION_EXPIRY: {
    title: { zh: "库存预留到期返库", en: "Reservation expiry release" },
    body: {
      zh: "有限库存订单会记录预留状态；商品、下单、工作台或订单访问时，系统先取消到期的待确认订单并幂等返库。",
      en: "Finite-stock orders persist reservation state. Product, checkout, workspace, and order access reconcile expired pending orders and release stock idempotently.",
    },
    action: { zh: "查看订单", en: "View orders" },
    icon: Receipt,
  },
  LOW_STOCK_ALERT: {
    title: { zh: "低库存提醒", en: "Low-stock alerts" },
    body: {
      zh: "商品库存可以真实维护，但工作台接口尚未聚合阈值或提醒记录。",
      en: "Product stock is maintained in the platform database, but the workspace API does not aggregate thresholds or alert records.",
    },
    action: { zh: "查看商品", en: "View products" },
    icon: Cube,
  },
  NOTIFICATION_DELIVERY: {
    title: { zh: "通知投递异常", en: "Notification delivery incidents" },
    body: {
      zh: "系统尚未保存发送、失败、重试或外部回执，因此不能显示失败数量。",
      en: "Send, failure, retry, and external receipt events are not stored, so no failure count can be shown.",
    },
    action: { zh: "查看通知边界", en: "View notification boundary" },
    icon: Bell,
  },
  SECURITY_ALERT: {
    title: { zh: "自动安全告警", en: "Automated security alerts" },
    body: {
      zh: "安全事件页是审计记录的固定规则投影，不是威胁检测或自动告警服务。",
      en: "Security events are a fixed audit projection, not threat detection or an automated alerting service.",
    },
    action: { zh: "查看安全事件", en: "View security events" },
    icon: ShieldCheck,
  },
};

const capabilityStateCopy: Record<
  DashboardCapabilityState,
  Record<Locale, string>
> = {
  IMPLEMENTED_REQUEST_DRIVEN: { zh: "按访问运行", en: "On-access" },
  NOT_COLLECTED: { zh: "未采集", en: "Not collected" },
  NOT_IMPLEMENTED: { zh: "未开发", en: "Not implemented" },
};

export default function DashboardPage({
  locale,
  onNavigate,
  user,
}: {
  locale: Locale;
  onNavigate: (page: Page) => void;
  user: AdminUser;
}) {
  const t = adminCopy[locale];
  const loader = useCallback((signal: AbortSignal) => getOverview(signal), []);
  const { data, state, reload } = useCachedAdminResource<Overview>("dashboard", loader);
  const slow = useSlowAdminRequest(state);

  if (!data) return <PanelState state={state} locale={locale} retry={() => void reload()} kind="dashboard" />;
  const snapshot = buildDashboardSnapshot(data);
  const metrics = [
    [t.totalProducts as string, data.metrics.productCount, Cube],
    [t.activeProducts as string, data.metrics.activeProducts, CheckCircle],
    [t.openOrders as string, data.metrics.openOrders, Receipt],
    [t.categoryCount as string, data.metrics.categoryCount, ListChecks],
  ] as const;

  return (
    <>
      <RefreshNotice state={state} locale={locale} retry={() => void reload()} slow={slow} />
      <section className="welcome-panel">
        <div><p>{t.hello as string}，{user.displayName}</p><h2>{t.overviewNote as string}</h2></div>
        <span><ChartLineUp /> {copy(locale, "平台数据库数据", "Platform database data")}</span>
      </section>
      <div className="metric-grid">
        {metrics.map(([label, value, Icon]) => <article key={label}><span><Icon /></span><div><small>{label}</small><strong>{value}</strong></div></article>)}
      </div>
      <section className="admin-panel dashboard-boundary-panel">
        <div className="panel-heading">
          <div>
            <h2>{copy(locale, "运营信号边界", "Operations signal boundary")}</h2>
            <p>{copy(locale, "真实汇总与尚未具备证据的提醒分开呈现", "Real aggregates are separated from alerts that have no evidence yet")}</p>
          </div>
          <button
            className="admin-secondary"
            disabled={state === "refreshing"}
            onClick={() => void reload()}
            type="button"
          >
            <ArrowsClockwise
              aria-hidden="true"
              className={state === "refreshing" ? "spin" : ""}
              size={17}
            />
            {copy(locale, "刷新真实数据", "Refresh real data")}
          </button>
        </div>
        <div className="dashboard-source-strip">
          <article>
            <small>{copy(locale, "未启用商品", "Inactive products")}</small>
            <strong>{snapshot.inactiveProductCount}</strong>
            <span>{copy(locale, "由商品总数减去启用数", "Total products minus active products")}</span>
          </article>
          <article>
            <small>{copy(locale, "最近订单样本", "Recent order sample")}</small>
            <strong>{snapshot.latestOrderCount}</strong>
            <span>{copy(locale, "接口最多返回 6 条，不是订单总数", "The API returns up to 6; this is not the order total")}</span>
          </article>
          <article>
            <small>{copy(locale, "最近订单时间", "Latest order time")}</small>
            <strong className="is-time">
              {snapshot.latestOrderAt
                ? formatDate(snapshot.latestOrderAt, locale)
                : copy(locale, "暂无订单", "No orders yet")}
            </strong>
            <span>{copy(locale, "来自当前已加载的订单样本", "From the currently loaded order sample")}</span>
          </article>
        </div>
        <p className="dashboard-truth-note">
          <WarningCircle aria-hidden="true" size={18} />
          <span>
            {copy(
              locale,
              "下列能力按真实实现和证据显示；缺少运行证据时仍标记“未采集”或“未开发”，不会用 0 或演示数字伪装为健康状态。",
              "Capabilities show their actual implementation and evidence state. Missing runtime evidence remains Not collected or Not implemented; zeroes and demo counts are never used as health claims.",
            )}
          </span>
        </p>
        <div className="dashboard-capability-list">
          {snapshot.capabilities.map((capability) => {
            const content = capabilityCopy[capability.code];
            const Icon = content.icon;
            return (
              <article key={capability.code}>
                <span className="dashboard-capability-icon"><Icon aria-hidden="true" size={19} /></span>
                <div>
                  <strong>{content.title[locale]}</strong>
                  <p>{content.body[locale]}</p>
                </div>
                <span className={`dashboard-capability-state is-${capability.state.toLocaleLowerCase()}`}>
                  {capabilityStateCopy[capability.state][locale]}
                </span>
                <button
                  className="admin-secondary"
                  onClick={() => onNavigate(capability.ownerPage)}
                  type="button"
                >
                  {content.action[locale]}<CaretRight aria-hidden="true" size={15} />
                </button>
              </article>
            );
          })}
        </div>
      </section>
      <section className="admin-panel">
        <div className="panel-heading"><h2>{t.latestOrders as string}</h2></div>
        {data.latestOrders.length > 0
          ? <OrdersTable orders={data.latestOrders} locale={locale} compact />
          : (
            <div className="table-empty" role="status">
              {copy(locale, "当前没有最近订单。", "There are no recent orders.")}
            </div>
          )}
      </section>
    </>
  );
}
