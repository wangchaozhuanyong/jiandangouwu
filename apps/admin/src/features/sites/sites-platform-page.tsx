import {
  ArrowsClockwise,
  ChatCircleDots,
  CloudCheck,
  Database,
  HardDrives,
  Key,
  LockKey,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback } from "react";
import {
  getSitesReadiness,
  type Locale,
  type SitesReadiness,
} from "../../api";
import {
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../../admin-experience";
import {
  formatDate,
  PanelState,
  RefreshNotice,
} from "../../admin-ui";

type SitesPlatformPageKind = "backups" | "data-security" | "integrations" | "secrets";

const copy = (locale: Locale, zh: string, en: string) => locale === "zh" ? zh : en;

const pageCopy: Record<SitesPlatformPageKind, {
  title: Record<Locale, string>;
  body: Record<Locale, string>;
}> = {
  integrations: {
    title: { zh: "Sites 运行连接", en: "Sites runtime connections" },
    body: {
      zh: "这里只显示本次请求实际核验到的 Sites、D1、R2 和 ChatGPT 登录边界。",
      en: "Only Sites, D1, R2, and ChatGPT sign-in boundaries verified by this request are shown.",
    },
  },
  backups: {
    title: { zh: "数据保护与恢复边界", en: "Data protection and recovery boundary" },
    body: {
      zh: "业务数据已经迁移到 Sites D1。应用不伪造最近备份时间；平台备份策略和恢复操作需要在 Sites 管理端确认。",
      en: "Business data has moved to Sites D1. The app does not invent a latest-backup time; platform backup policy and restore operations must be confirmed in Sites administration.",
    },
  },
  secrets: {
    title: { zh: "运行密钥状态", en: "Runtime secret status" },
    body: {
      zh: "页面只确认订单联系方式加密密钥是否已配置，不读取或显示密钥内容。",
      en: "This page only confirms whether the order-contact encryption key is configured. It never reads or displays the secret.",
    },
  },
  "data-security": {
    title: { zh: "Sites 数据安全边界", en: "Sites data-security boundary" },
    body: {
      zh: "管理员身份由 ChatGPT 登录保护，结构化数据保存在 D1，媒体使用 R2，敏感联系方式在写入前加密。",
      en: "ChatGPT sign-in protects administrator identity, D1 stores structured data, R2 stores media, and sensitive contact details are encrypted before storage.",
    },
  },
};

export default function SitesPlatformPage({
  kind,
  locale,
}: {
  kind: SitesPlatformPageKind;
  locale: Locale;
}) {
  const loader = useCallback((signal: AbortSignal) => getSitesReadiness(signal), []);
  const resource = useCachedAdminResource<SitesReadiness>("sites-platform-readiness", loader);
  const slow = useSlowAdminRequest(resource.state);
  const content = pageCopy[kind];

  return (
    <section className="sites-platform-page">
      <div className="sites-platform-truth-note" role="note">
        <CloudCheck size={21} aria-hidden="true" />
        <span><strong>{content.title[locale]}</strong>{content.body[locale]}</span>
      </div>
      <section className="admin-panel sites-platform-panel">
        <RefreshNotice
          locale={locale}
          retry={() => void resource.reload()}
          slow={slow}
          state={resource.state}
        />
        {!resource.data ? (
          <PanelState
            kind="cards"
            locale={locale}
            retry={() => void resource.reload()}
            state={resource.state}
          />
        ) : (
          <>
            <div className="sites-platform-summary">
              <PlatformState icon={Database} label="Sites D1" ok value={copy(locale, "已连接", "Connected")} />
              <PlatformState
                icon={HardDrives}
                label="Sites R2"
                ok={resource.data.objectStorage === "bound"}
                value={resource.data.objectStorage === "bound" ? copy(locale, "已绑定", "Bound") : copy(locale, "缺少绑定", "Missing")}
              />
              <PlatformState
                icon={LockKey}
                label={copy(locale, "管理员登录", "Administrator sign-in")}
                ok={resource.data.chatgptAuthentication === "connected"}
                value="ChatGPT"
              />
              <PlatformState
                icon={Key}
                label={copy(locale, "联系方式加密", "Contact encryption")}
                ok={resource.data.dataEncryptionKey === "configured"}
                value={resource.data.dataEncryptionKey === "configured" ? copy(locale, "已配置", "Configured") : copy(locale, "未配置", "Not configured")}
              />
            </div>
            <div className="sites-platform-grid">
              <article>
                <span><ShieldCheck size={22} /></span>
                <div><small>{copy(locale, "当前管理员", "CURRENT ADMINISTRATOR")}</small><strong>{resource.data.administrator.displayName}</strong><p>{resource.data.administrator.email}</p></div>
              </article>
              <article>
                <span><ChatCircleDots size={22} /></span>
                <div>
                  <small>{copy(locale, "前台状态", "STOREFRONT STATE")}</small>
                  <strong>{resource.data.storefront.acceptOrders ? copy(locale, "允许下单", "Orders enabled") : copy(locale, "下单保持关闭", "Orders remain disabled")}</strong>
                  <p>{copy(locale, `已启用 ${resource.data.storefront.activeContactChannels} 个客服渠道`, `${resource.data.storefront.activeContactChannels} support channels enabled`)}</p>
                </div>
              </article>
            </div>
            {kind === "backups" && (
              <div className="sites-platform-warning" role="note">
                <WarningCircle size={18} />
                {copy(locale, "本站没有自行显示或伪造备份成功记录。正式开放订单前，应在 Sites 管理端确认 D1 的备份与恢复流程。", "This site does not display or invent backup-success records. Confirm the D1 backup and restore workflow in Sites administration before enabling orders.")}
              </div>
            )}
            <div className="sites-platform-toolbar">
              <span>{copy(locale, "核验时间", "Checked at")}：{formatDate(resource.data.checkedAt, locale)}</span>
              <button className="admin-primary" onClick={() => void resource.reload()} type="button">
                <ArrowsClockwise size={17} />{copy(locale, "重新核验", "Check again")}
              </button>
            </div>
          </>
        )}
      </section>
    </section>
  );
}

function PlatformState({
  icon: Icon,
  label,
  ok,
  value,
}: {
  icon: typeof Database;
  label: string;
  ok: boolean;
  value: string;
}) {
  return (
    <article className={ok ? "is-ready" : "is-warning"}>
      <span><Icon size={22} /></span>
      <div><small>{label}</small><strong>{value}</strong></div>
    </article>
  );
}
