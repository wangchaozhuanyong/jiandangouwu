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
  liveInventoryRiskCapabilityBody,
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
    title: { zh: "库存风险实时摘要", en: "Live inventory risk summary" },
    body: {
      zh: "工作台会实时查询全部在售商品，并按本次已保存阈值区分库存数据冲突、售罄和低库存；它不是通知投递或历史告警。",
      en: "The workspace queries every active product and uses the saved threshold to separate invalid stock, sold-out items, and low stock. This is not notification delivery or alert history.",
    },
    action: { zh: "查看商品", en: "View products" },
    icon: Cube,
  },
  NOTIFICATION_DELIVERY: {
    title: { zh: "通知投递异常", en: "Notification delivery incidents" },
    body: {
      zh: "Telegram 新订单通知保存发送、失败、重试和外部消息回执；实际投递仍取决于服务端密钥、真实连接验证和启用状态。",
      en: "Telegram new-order notifications store sends, failures, retries, and external message receipts. Actual delivery still depends on server secrets, real connection verification, and enabled state.",
    },
    action: { zh: "查看通知边界", en: "View notification boundary" },
    icon: Bell,
  },
  SECURITY_ALERT: {
    title: { zh: "自动安全告警", en: "Automated security alerts" },
    body: {
      zh: "高优先级安全审计信号会进入可去重、可重试并保存 Telegram 回执的告警队列；这仍不是威胁检测、SIEM 或自动账号处置。",
      en: "High-priority security audit signals enter a deduplicated, retryable alert queue with Telegram receipts. This is still not threat detection, SIEM, or automatic account response.",
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
  IMPLEMENTED_LIVE_QUERY: { zh: "实时查询", en: "Live query" },
  IMPLEMENTED_RETRY_QUEUE: { zh: "可重试队列", en: "Retry queue" },
  NOT_COLLECTED: { zh: "未采集", en: "Not collected" },
  NOT_IMPLEMENTED: { zh: "未开发", en: "Not implemented" },
};

const inventoryRiskCopy: Record<
  Overview["inventoryRisk"]["items"][number]["risk"],
  Record<Locale, string>
> = {
  INVALID_STOCK: { zh: "库存数据冲突", en: "Invalid stock data" },
  SOLD_OUT: { zh: "售罄", en: "Sold out" },
  LOW_STOCK: { zh: "低库存", en: "Low stock" },
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
          <article>
            <small>{copy(locale, "实时库存风险", "Live inventory risks")}</small>
            <strong>{snapshot.inventoryRisk.affectedProductCount}</strong>
            <span>
              {copy(
                locale,
                `售罄 ${snapshot.inventoryRisk.soldOutCount} · 低库存 ${snapshot.inventoryRisk.lowStockCount} · 数据冲突 ${snapshot.inventoryRisk.invalidStockCount}`,
                `Sold out ${snapshot.inventoryRisk.soldOutCount} · Low stock ${snapshot.inventoryRisk.lowStockCount} · Invalid ${snapshot.inventoryRisk.invalidStockCount}`,
              )}
            </span>
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
                  <p>
                    {capability.code === "LOW_STOCK_ALERT"
                      ? liveInventoryRiskCapabilityBody(
                          locale,
                          snapshot.inventoryRisk.threshold,
                        )
                      : content.body[locale]}
                  </p>
                </div>
                <span className={`dashboard-capability-state is-${capability.state.toLowerCase()}`}>
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
      <section className="admin-panel dashboard-inventory-panel">
        <div className="panel-heading">
          <div>
            <h2>{copy(locale, "库存风险队列", "Inventory risk queue")}</h2>
            <p>
              {copy(
                locale,
                `实时检查 ${snapshot.inventoryRisk.evaluatedProductCount} 个在售商品；最多展示优先级最高的 ${snapshot.inventoryRisk.sampleLimit} 项`,
                `Live query across ${snapshot.inventoryRisk.evaluatedProductCount} active products; showing up to ${snapshot.inventoryRisk.sampleLimit} highest-priority items`,
              )}
            </p>
          </div>
          <button
            className="admin-secondary"
            onClick={() => onNavigate("products")}
            type="button"
          >
            {copy(locale, "管理商品", "Manage products")}<CaretRight aria-hidden="true" size={15} />
          </button>
        </div>
        <p className="dashboard-inventory-note">
          <WarningCircle aria-hidden="true" size={18} />
          <span>
            {copy(
              locale,
              `这里是当前数据库快照：有限库存 0 为售罄，1–${snapshot.inventoryRisk.threshold} 为低库存；不会生成持久化告警、通知或历史记录。`,
              `This is a current database snapshot: finite stock at 0 is sold out and 1–${snapshot.inventoryRisk.threshold} is low stock. It does not create persistent alerts, notifications, or history.`,
            )}
          </span>
        </p>
        <div
          aria-label={copy(locale, "库存风险表，可横向滚动", "Inventory risk table, horizontally scrollable")}
          className="dashboard-inventory-table-wrap"
          tabIndex={0}
        >
          <table className="dashboard-inventory-table">
            <thead>
              <tr>
                <th scope="col">{copy(locale, "中文名称", "Chinese name")}</th>
                <th scope="col">{copy(locale, "英文名称", "English name")}</th>
                <th scope="col">{copy(locale, "库存", "Stock")}</th>
                <th scope="col">{copy(locale, "风险", "Risk")}</th>
                <th scope="col">{copy(locale, "更新时间", "Updated")}</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.inventoryRisk.items.map((item) => (
                <tr key={item.id}>
                  <td title={item.name.zh}>{item.name.zh || item.slug}</td>
                  <td title={item.name.en}>{item.name.en || item.slug}</td>
                  <td>{item.stockQuantity ?? "—"}</td>
                  <td>
                    <span className={`dashboard-inventory-risk is-${item.risk.toLowerCase()}`}>
                      {inventoryRiskCopy[item.risk][locale]}
                    </span>
                  </td>
                  <td><time dateTime={item.updatedAt}>{formatDate(item.updatedAt, locale)}</time></td>
                </tr>
              ))}
            </tbody>
          </table>
          {snapshot.inventoryRisk.items.length === 0 && (
            <div className="table-empty" role="status">
              {copy(
                locale,
                "当前实时查询没有发现库存风险。",
                "The current live query found no inventory risks.",
              )}
            </div>
          )}
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
