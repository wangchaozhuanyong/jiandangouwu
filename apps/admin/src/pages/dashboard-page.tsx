import {
  ChartLineUp,
  CheckCircle,
  Cube,
  Eye,
  ListChecks,
  Receipt,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import { getOverview, type AdminUser, type Locale, type Overview } from "../api";
import { useCachedAdminResource, useSlowAdminRequest } from "../admin-experience";
import { PanelState, RefreshNotice } from "../admin-ui";
import { DesignWorkflowDialog } from "../design-workflows";
import { adminCopy } from "../i18n";
import { OrdersTable } from "./orders-table";

export default function DashboardPage({ locale, user }: { locale: Locale; user: AdminUser }) {
  const t = adminCopy[locale];
  const loader = useCallback((signal: AbortSignal) => getOverview(signal), []);
  const { data, state, reload } = useCachedAdminResource<Overview>("dashboard", loader);
  const slow = useSlowAdminRequest(state);
  const [insightsOpen, setInsightsOpen] = useState(false);

  if (!data) return <PanelState state={state} locale={locale} retry={() => void reload()} kind="dashboard" />;
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
        <span><ChartLineUp /> {t.live as string}</span>
      </section>
      <div className="metric-grid">
        {metrics.map(([label, value, Icon]) => <article key={label}><span><Icon /></span><div><small>{label}</small><strong>{value}</strong></div></article>)}
      </div>
      <section className="admin-panel">
        <div className="panel-heading"><h2>{t.latestOrders as string}</h2></div>
        <OrdersTable orders={data.latestOrders} locale={locale} compact />
      </section>
      <section className="admin-panel design-dashboard-queue">
        <div className="panel-heading">
          <div>
            <h2>{locale === "zh" ? "运营提醒设计" : "Operations alert design"}</h2>
            <p>{locale === "zh" ? "临期任务集中发现并下钻" : "Discover and drill into time-sensitive work"}</p>
          </div>
          <button className="admin-primary" onClick={() => setInsightsOpen(true)}>
            <Eye />{locale === "zh" ? "打开完整流程" : "Open full flow"}
          </button>
        </div>
        <div className="design-dashboard-signals">
          {[
            { label: locale === "zh" ? "临期订单" : "Expiring orders", value: "2", meta: locale === "zh" ? "15 分钟内" : "within 15 min", Icon: Receipt },
            { label: locale === "zh" ? "低库存" : "Low inventory", value: "3", meta: locale === "zh" ? "需要补充" : "needs attention", Icon: Cube },
            { label: locale === "zh" ? "通知失败" : "Failed notifications", value: "1", meta: locale === "zh" ? "等待重试" : "awaiting retry", Icon: WarningCircle },
          ].map(({ label, value, meta, Icon }) => (
            <article key={label}>
              <span><Icon /></span>
              <div><small>{label}</small><strong>{value}</strong><em>{meta}</em></div>
            </article>
          ))}
        </div>
        <p className="design-inline-disclaimer">
          <Eye />{locale === "zh" ? "本区域为工作台下钻交互设计，不代表提醒服务已经接通。" : "This area previews workspace drill-down interactions and does not indicate a connected alert service."}
        </p>
      </section>
      {insightsOpen && (
        <DesignWorkflowDialog
          id="dashboard-insights"
          locale={locale}
          onClose={() => setInsightsOpen(false)}
        />
      )}
    </>
  );
}
