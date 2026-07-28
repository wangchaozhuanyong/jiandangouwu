import { Eye } from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import { getAudit, type AuditEvent, type Locale } from "../api";
import { useCachedAdminResource, useSlowAdminRequest } from "../admin-experience";
import { DesignWorkflowDialog } from "../design-workflows";
import {
  formatDate,
  PanelState,
  RefreshNotice,
  StatusPill,
} from "../admin-ui";
import { adminCopy } from "../i18n";

const actionLabels: Record<string, Record<Locale, string>> = {
  "auth.setup.complete": { zh: "创建首位管理员", en: "First admin created" },
  "auth.login.password": { zh: "密码登录", en: "Password sign in" },
  "auth.login.totp": { zh: "双重验证登录", en: "Two-factor sign in" },
  "auth.login.failed": { zh: "登录失败", en: "Sign-in failed" },
  "auth.totp.enabled": { zh: "开启双重验证", en: "Two-factor authentication enabled" },
  "auth.totp.disabled": { zh: "关闭双重验证", en: "Two-factor authentication disabled" },
  "category.create": { zh: "新增分类", en: "Category created" },
  "category.update": { zh: "更新分类", en: "Category updated" },
  "product.create": { zh: "新增商品", en: "Product created" },
  "product.update": { zh: "更新商品", en: "Product updated" },
  "order.status.update": { zh: "更新订单状态", en: "Order status updated" },
  "order.contact.reveal": { zh: "查看订单联系方式", en: "Order contact revealed" },
  "currency.rate.update": { zh: "更新汇率", en: "Rate updated" },
};

export default function AuditPage({ locale }: { locale: Locale }) {
  const t = adminCopy[locale];
  const loader = useCallback((signal: AbortSignal) => getAudit(signal), []);
  const { data, state, reload } = useCachedAdminResource<AuditEvent[]>("audit", loader);
  const slow = useSlowAdminRequest(state);
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <>
      <div className="design-preview-note" role="note">
        <Eye size={17} />
        <span>
          <strong>{locale === "zh" ? "审计详情与导出设计" : "Audit detail and export design"}</strong>
          {locale === "zh" ? "现有日志列表读取真实本地审计数据；筛选、前后差异和导出流程仅作设计预览。" : "The current list reads real local audit data. Filters, before/after diff, and export are design previews."}
        </span>
        <button className="admin-secondary design-note-action" onClick={() => setDetailOpen(true)}>
          {locale === "zh" ? "打开流程" : "Open flow"}
        </button>
      </div>
      <section className="admin-panel">
        <RefreshNotice state={state} locale={locale} retry={() => void reload()} slow={slow} />
        {!data ? <PanelState state={state} locale={locale} retry={() => void reload()} /> : (
          <div className="data-table audit-table" tabIndex={0} aria-label={locale === "zh" ? "审计日志表，可横向滚动" : "Audit table, horizontally scrollable"}>
          <div className="table-head"><span>{t.action as string}</span><span>{t.actor as string}</span><span>{t.target as string}</span><span>{t.result as string}</span><span>{t.created as string}</span></div>
          {data.length === 0 && <div className="table-empty">{t.empty as string}</div>}
          {data.map((item) => (
            <div className="table-row" key={item.id}>
              <strong title={actionLabels[item.action]?.[locale] ?? item.action}>{actionLabels[item.action]?.[locale] ?? item.action}</strong>
              <span>{item.actor?.displayName ?? (locale === "zh" ? "系统" : "System")}</span>
              <code>{item.targetType}{item.targetId ? ` / ${item.targetId.slice(0, 8)}` : ""}</code>
              <StatusPill status={item.result} locale={locale} />
              <small>{formatDate(item.createdAt, locale)}</small>
            </div>
          ))}
          </div>
        )}
      </section>
      {detailOpen && <DesignWorkflowDialog id="logs" locale={locale} onClose={() => setDetailOpen(false)} />}
    </>
  );
}
