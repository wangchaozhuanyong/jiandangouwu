import { Eye } from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import { getOrders, type AdminOrder, type Locale } from "../api";
import { useCachedAdminResource, useSlowAdminRequest } from "../admin-experience";
import { DesignWorkflowDialog } from "../design-workflows";
import { PanelState, RefreshNotice } from "../admin-ui";
import { OrdersTable } from "./orders-table";

export default function OrdersPage({ locale }: { locale: Locale }) {
  const loader = useCallback((signal: AbortSignal) => getOrders(signal), []);
  const { data, state, reload } = useCachedAdminResource<AdminOrder[]>("orders", loader);
  const slow = useSlowAdminRequest(state);
  const [previewOrder, setPreviewOrder] = useState<AdminOrder | null>(null);

  if (!data) return <section className="admin-panel"><PanelState state={state} locale={locale} retry={() => void reload()} /></section>;
  return (
    <>
      <div className="design-preview-note" role="note">
        <Eye size={17} />
        <span>
          <strong>{locale === "zh" ? "订单详情工作台设计入口" : "Order workbench design entry"}</strong>
          {locale === "zh"
            ? "订单列表与状态更新仍连接本地服务器；每行眼睛按钮打开的详情、分配、备注和售后流程仅作界面设计预览。"
            : "The list and status updates remain connected locally. The eye button opens design-only details, assignment, notes, and after-sales flows."}
        </span>
      </div>
      <section className="admin-panel">
        <RefreshNotice state={state} locale={locale} retry={() => void reload()} slow={slow} />
        {data.length === 0 ? (
          <PanelState state="empty" locale={locale} retry={() => void reload()} />
        ) : (
          <OrdersTable
            orders={data}
            locale={locale}
            onChanged={() => void reload()}
            onPreviewOrder={setPreviewOrder}
          />
        )}
      </section>
      {previewOrder && (
        <DesignWorkflowDialog
          id="order-workbench"
          locale={locale}
          contextLabel={previewOrder.orderNumber}
          onClose={() => setPreviewOrder(null)}
        />
      )}
    </>
  );
}
