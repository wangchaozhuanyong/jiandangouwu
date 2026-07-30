import type { Locale } from "./api";
import type { Page } from "./admin-model";

type LocalizedHelp = Record<Locale, string>;

export const adminPageHelp = {
  dashboard: {
    zh: "汇总 Sites D1 中的商品、人工订单和库存风险信号。这里用于运营判断，不替代支付机构、银行或外部交付凭证。",
    en: "Summarizes catalog, manual-order, and inventory-risk signals from Sites D1. It supports operations decisions but does not replace payment-provider, bank, or external fulfillment evidence.",
  },
  orders: {
    zh: "查询人工订单并处理负责人、状态和联系方式。敏感联系方式需要相应权限、业务原因和审计记录。",
    en: "Find manual orders and manage ownership, status, and contact details. Revealing sensitive contact data requires permission, a business reason, and an audit record.",
  },
  disputes: {
    zh: "集中查看退款与争议相关订单并进入订单详情继续处理。当前不会调用支付机构或自动执行退款。",
    en: "Reviews orders related to refunds and disputes and continues handling them in order details. It does not call a payment provider or issue automatic refunds.",
  },
  products: {
    zh: "管理客户端商品的双语内容、分类、价格、库存、状态和排序。保存后的变化会影响后续客户端展示与新订单。",
    en: "Manages storefront product copy, category, price, stock, status, and order. Saved changes affect later storefront reads and new orders.",
  },
  categories: {
    zh: "管理客户端分类的双语名称、状态和顺序。分类状态与排序会影响商品筛选，但不会自动重排商品本身。",
    en: "Manages bilingual category names, status, and order. Category state and order affect storefront filters but do not automatically reorder products.",
  },
  banners: {
    zh: "管理首页轮播的双语内容、图片、显示状态和顺序。图片必须来自当前允许的媒体路径。",
    en: "Manages bilingual hero content, images, visibility, and order. Images must use an approved media path.",
  },
  media: {
    zh: "管理 Sites R2 中的媒体对象及其商品、轮播引用。替换和删除前会检查引用关系并记录审计。",
    en: "Manages media objects in Sites R2 and their product or hero references. Replacement and deletion check references and write audit records.",
  },
  translations: {
    zh: "集中检查商品、分类、轮播、客服渠道和网站设置的双语完整性。保存仍回到内容所属模块及其权限边界。",
    en: "Reviews bilingual completeness across products, categories, heroes, contact channels, and site settings. Saves remain within the owning module and its permissions.",
  },
  contacts: {
    zh: "管理客户端可用的客服渠道、公开账号、安全跳转地址、服务时间和顺序。只有配置完整并启用的渠道才能用于客服与下单。",
    en: "Manages storefront contact channels, public accounts, approved targets, service hours, and order. Only complete, active channels can support contact and ordering.",
  },
  notifications: {
    zh: "汇总通知能力、真实配置和上线门槛。未连接、未验证或缺少外部回执时不会显示为已上线。",
    en: "Summarizes notification capabilities, live configuration, and launch gates. Missing connections, verification, or external receipts are never shown as live.",
  },
  "telegram-bot": {
    zh: "配置新订单 Telegram 管理群通知、真实连接测试、脱敏预览和投递重试。只有服务端验证成功后才能有效启用。",
    en: "Configures Telegram new-order notifications, real connection tests, masked previews, and delivery retries. It can take effect only after server verification succeeds.",
  },
  currencies: {
    zh: "查看币种、当前汇率、历史记录和自动同步状态。汇率变化影响后续价格换算，不修改已创建订单的金额快照。",
    en: "Reviews currencies, current rates, history, and automatic sync state. Rate changes affect later conversions but do not change existing order snapshots.",
  },
  payments: {
    zh: "查看人工收款相关的内部订单事件。当前没有在线支付、自动扣款或银行到账核验能力。",
    en: "Reviews internal order events related to manual payments. Online payment, automatic charging, and bank-settlement verification are not available.",
  },
  reconciliation: {
    zh: "核对内部订单状态历史与现有证据边界。没有外部支付回执时不能据此宣称资金已经结算。",
    en: "Reconciles internal order-status history and the current evidence boundary. It cannot prove settlement without external payment receipts.",
  },
  team: {
    zh: "查看由 Sites 与 ChatGPT 管理的后台成员身份和状态。管理员邀请与跨账号会话当前尚未提供。",
    en: "Reviews administrator identities and states managed by Sites and ChatGPT. Administrator invitations and cross-account sessions are not available.",
  },
  roles: {
    zh: "查看当前后台角色与权限范围。页面不会绕过 Sites 托管身份，也不会在没有服务端确认时宣称权限已修改。",
    en: "Reviews current administrator roles and permissions. It does not bypass Sites-managed identity or claim permission changes without server confirmation.",
  },
  security: {
    zh: "查看当前 ChatGPT 管理身份和登录安全边界。密码与双重验证由 ChatGPT 管理，不在本站保存。",
    en: "Reviews the current ChatGPT administrator identity and sign-in boundary. Passwords and two-step verification are managed by ChatGPT, not stored here.",
  },
  "security-events": {
    zh: "筛选与安全相关的审计事件，并管理高优先级信号的 Telegram 告警、真实回执和失败重试。这里仍不执行威胁检测或自动账号处置。",
    en: "Filters security-related audit events and manages Telegram alerts, real receipts, and retries for high-priority signals. It still performs no threat detection or automatic account response.",
  },
  "data-security": {
    zh: "查看数据加密、访问边界、保留清理预览、隐私请求和密钥轮换状态。不可逆清理仍保持关闭并需要人工核验。",
    en: "Reviews encryption, access boundaries, retention previews, privacy requests, and key rotation. Irreversible cleanup remains disabled and requires manual verification.",
  },
  secrets: {
    zh: "检查 Sites 生产密钥和运行绑定是否就绪。页面只显示配置状态，不读取或展示密钥明文。",
    en: "Checks whether Sites production secrets and runtime bindings are ready. It shows configuration state without reading or exposing secret values.",
  },
  logs: {
    zh: "查询、筛选和导出后台审计记录。导出敏感范围时需要业务原因、确认文字和相应权限。",
    en: "Searches, filters, and exports administrator audit records. Sensitive exports require a business reason, confirmation text, and permission.",
  },
  backups: {
    zh: "管理加密 D1 备份、逻辑校验、隔离恢复演练及备份失败/卡住告警。演练不会覆盖当前生产 D1，也不等于已经完成切换。",
    en: "Manages encrypted D1 backups, logical verification, isolated recovery drills, and failed or stale backup alerts. A drill does not overwrite production D1 or prove a completed cutover.",
  },
  integrations: {
    zh: "查看 Sites D1、R2、ChatGPT 身份及外部集成的真实连接状态。未配置或未验证的集成会明确显示为不可用。",
    en: "Reviews live connection state for Sites D1, R2, ChatGPT identity, and external integrations. Unconfigured or unverified integrations remain explicitly unavailable.",
  },
  settings: {
    zh: "管理客户端站点名称、默认语言、接单与客服入口、库存风险阈值、SEO 和政策版本。保存后在服务器确认并被下次读取时生效。",
    en: "Manages storefront identity, default language, ordering and support access, inventory-risk threshold, SEO, and policy version. Changes apply after server confirmation and the next read.",
  },
} satisfies Record<Page, LocalizedHelp>;

export function helpTriggerLabel(locale: Locale, subject: string): string {
  return locale === "zh" ? `查看${subject}说明` : `About ${subject}`;
}
