import { useState } from "react";
import {
  ArrowRight,
  ArrowsClockwise,
  Check,
  CheckCircle,
  Clock,
  CloudArrowUp,
  Copy,
  CurrencyCircleDollar,
  Database,
  DeviceMobile,
  DownloadSimple,
  EnvelopeSimple,
  Eye,
  Key,
  ListMagnifyingGlass,
  LockKey,
  PlugsConnected,
  Pulse,
  Receipt,
  ShieldCheck,
  UserCircle,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";

const go = (path) => {
  window.location.hash = path;
};

function StatusBadge({ tone = "healthy", children }) {
  return <span className={`design-status is-${tone}`}><i />{children}</span>;
}

function PageToolbar({ summary, children }) {
  return <div className="admin-surface-toolbar design-page-toolbar"><span>{summary}</span>{children}</div>;
}

const providers = [
  { id: "stripe", name: "Stripe", coverage: "Cards · Apple Pay · Google Pay", state: "test", key: "•••• 4F8A", webhook: "healthy" },
  { id: "paypal", name: "PayPal", coverage: "PayPal Wallet · Cards", state: "disabled", key: "Not configured", webhook: "disabled" },
  { id: "airwallex", name: "Airwallex", coverage: "APAC methods · FX settlement", state: "disabled", key: "Not configured", webhook: "disabled" },
];

export function PaymentsPage({ lang, onSensitiveAction }) {
  const zh = lang === "zh";
  const [tab, setTab] = useState("providers");
  const [selected, setSelected] = useState("stripe");
  const activeProvider = providers.find((item) => item.id === selected);
  const requestLiveMode = () => onSensitiveAction({
    title: zh ? "启用正式支付需要重新验证" : "Live payments require re-verification",
    description: zh
      ? "此操作会影响客户端付款入口。验证后仍需二次确认，当前原型不会连接真实支付。"
      : "This affects the storefront payment entry. A second confirmation is still required and this prototype will not connect a real provider.",
    requireReason: true,
  });
  return (
    <>
      <section className="payment-control-hero">
        <div className="payment-control-icon"><LockKey size={25} /></div>
        <div><small>{zh ? "客户端收款状态" : "STOREFRONT PAYMENT STATE"}</small><h2>{zh ? "在线支付未启用" : "Online payment is disabled"}</h2><p>{zh ? "所有新订单进入“待人工处理”，客户端不会出现银行卡输入框。" : "New orders enter manual review. The storefront never renders card-entry fields."}</p></div>
        <StatusBadge tone="disabled">{zh ? "人工处理模式" : "Manual mode"}</StatusBadge>
        <button className="admin-primary" onClick={() => go("/payment/demo")}><Eye size={17} />{zh ? "预览客户端支付状态" : "Preview client states"}</button>
      </section>
      <PageToolbar summary={zh ? "1 个测试配置 · 0 个正式启用" : "1 test configuration · 0 live providers"}>
        <button className="toolbar-action" onClick={requestLiveMode}><ShieldCheck size={17} />{zh ? "正式启用流程" : "Live enable flow"}</button>
      </PageToolbar>
      <div className="design-tabs" role="tablist">
        {[["providers", zh ? "提供商" : "Providers"], ["methods", zh ? "国家与方式" : "Countries & methods"], ["webhooks", "Webhooks"]].map(([id, label]) => (
          <button type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>
        ))}
      </div>
      {tab === "providers" && (
        <div className="payment-provider-layout">
          <section className="admin-panel provider-list">
            {providers.map((provider) => (
              <button className={selected === provider.id ? "is-selected" : ""} onClick={() => setSelected(provider.id)} key={provider.id}>
                <span className="provider-mark"><CurrencyCircleDollar size={22} /></span>
                <div><strong>{provider.name}</strong><small>{provider.coverage}</small></div>
                <StatusBadge tone={provider.state === "test" ? "warning" : "disabled"}>{provider.state === "test" ? (zh ? "仅测试" : "Test only") : (zh ? "未启用" : "Disabled")}</StatusBadge>
                <ArrowRight size={16} />
              </button>
            ))}
          </section>
          <aside className="admin-panel provider-detail">
            <div className="provider-detail-heading"><span className="provider-mark large"><PlugsConnected size={25} /></span><div><small>{zh ? "当前配置" : "CURRENT CONFIGURATION"}</small><h2>{activeProvider.name}</h2></div></div>
            <dl>
              <div><dt>{zh ? "运行模式" : "Mode"}</dt><dd>{activeProvider.state === "test" ? (zh ? "测试环境" : "Sandbox") : (zh ? "未配置" : "Not configured")}</dd></div>
              <div><dt>{zh ? "密钥状态" : "Credential status"}</dt><dd>{activeProvider.key}</dd></div>
              <div><dt>Webhook</dt><dd>{activeProvider.webhook === "healthy" ? (zh ? "签名验证正常" : "Signature healthy") : (zh ? "未配置" : "Not configured")}</dd></div>
              <div><dt>{zh ? "客户端状态" : "Storefront"}</dt><dd>{zh ? "关闭" : "Off"}</dd></div>
            </dl>
            <div className="provider-security-note"><ShieldCheck size={18} /><span>{zh ? "密钥值只保存在 Secrets Manager。后台只显示状态与末尾标识。" : "Credential values stay in Secrets Manager. The console shows only status and a suffix."}</span></div>
            <div className="provider-actions"><button className="admin-secondary" onClick={() => onSensitiveAction({ title: zh ? "测试连接" : "Test connection", description: zh ? "验证密钥权限、Webhook 签名和测试环境连通性。" : "Validate credential permissions, webhook signatures, and sandbox connectivity." })}><Pulse size={17} />{zh ? "测试连接" : "Test connection"}</button><button className="admin-primary" onClick={requestLiveMode}><LockKey size={17} />{zh ? "申请正式启用" : "Request live mode"}</button></div>
          </aside>
        </div>
      )}
      {tab === "methods" && (
        <section className="admin-panel payment-mapping-table admin-data-scroll">
          <div className="mapping-header"><span>{zh ? "市场" : "Market"}</span><span>{zh ? "结算币种" : "Currency"}</span><span>{zh ? "支付方式" : "Methods"}</span><span>{zh ? "客户端" : "Storefront"}</span></div>
          {[
            ["Global", "USD", "Cards · Apple Pay · Google Pay"],
            [zh ? "东南亚" : "Southeast Asia", "MYR / SGD", "Cards · FPX · GrabPay"],
            [zh ? "欧洲经济区" : "EEA", "EUR / GBP", "Cards · 3DS"],
          ].map(([market, currency, methods]) => <div className="mapping-row" key={market}><strong>{market}</strong><span>{currency}</span><span>{methods}</span><StatusBadge tone="disabled">{zh ? "未启用" : "Off"}</StatusBadge></div>)}
          <div className="mapping-note"><WarningCircle size={18} /><span>{zh ? "只有提供商、币种、市场和支付方式同时启用时，客户端才显示对应入口。" : "The storefront shows a method only when provider, currency, market, and method are all enabled."}</span></div>
        </section>
      )}
      {tab === "webhooks" && <WebhookPanel lang={lang} onSensitiveAction={onSensitiveAction} />}
    </>
  );
}

function WebhookPanel({ lang, onSensitiveAction }) {
  const zh = lang === "zh";
  const events = [
    { id: "evt_01J9A7", type: "payment.succeeded", time: "14:36:12", state: "healthy", note: zh ? "已验证 · 首次处理" : "Verified · first delivery" },
    { id: "evt_01J9A4", type: "payment.pending", time: "14:31:08", state: "warning", note: zh ? "延迟 41 秒" : "Delayed 41 seconds" },
    { id: "evt_01J99Z", type: "refund.updated", time: "14:22:47", state: "healthy", note: zh ? "重复事件已忽略" : "Duplicate ignored" },
  ];
  return (
    <div className="webhook-layout">
      <section className="webhook-health admin-panel">
        <div><span className="integration-glyph"><Pulse size={23} /></span><div><small>STRIPE / SANDBOX</small><h2>{zh ? "签名验证正常" : "Signature verification healthy"}</h2><p>{zh ? "最近接收 2 分钟前 · P95 延迟 420ms" : "Last received 2 min ago · P95 latency 420ms"}</p></div><StatusBadge tone="healthy">{zh ? "正常" : "Healthy"}</StatusBadge></div>
        <dl><div><dt>{zh ? "端点" : "Endpoint"}</dt><dd>/webhooks/payments/stripe</dd></div><div><dt>{zh ? "签名密钥" : "Signing secret"}</dt><dd>•••• 8D2C</dd></div><div><dt>{zh ? "失败重试" : "Failed retries"}</dt><dd>0 / 24h</dd></div></dl>
        <button className="admin-secondary" onClick={() => onSensitiveAction({ title: zh ? "轮换 Webhook 密钥" : "Rotate webhook secret", description: zh ? "轮换后旧密钥会在短暂过渡期内保留，操作进入审计记录。" : "The previous secret remains during a short transition and the action is audited.", requireReason: true })}><ArrowsClockwise size={17} />{zh ? "轮换签名密钥" : "Rotate signing secret"}</button>
      </section>
      <section className="admin-panel webhook-events admin-data-scroll">
        <div className="panel-heading"><h2>{zh ? "最近事件" : "Recent events"}</h2><button><DownloadSimple size={16} />{zh ? "导出" : "Export"}</button></div>
        <div className="webhook-events__header"><span>{zh ? "事件" : "Event"}</span><span>{zh ? "事件编号" : "Event ID"}</span><span>{zh ? "结果" : "Result"}</span><span>{zh ? "时间" : "Time"}</span><span>{zh ? "操作" : "Action"}</span></div>
        {events.map((event) => <button key={event.id}><span className="event-type-cell"><span className={`event-node is-${event.state}`} /><strong title={event.type}>{event.type}</strong></span><code title={event.id}>{event.id}</code><span title={event.note}>{event.note}</span><time>{event.time}</time><ArrowRight size={16} /></button>)}
      </section>
    </div>
  );
}

export function ReconciliationPage({ lang }) {
  const zh = lang === "zh";
  const rows = [
    ["STL-0727-018", "Stripe", "USD 1,248.20", zh ? "完全匹配" : "Matched", "healthy"],
    ["STL-0727-017", "Stripe", "USD 894.10", zh ? "差额 USD 12.00" : "USD 12.00 variance", "warning"],
    ["MAN-0727-041", zh ? "人工处理" : "Manual", "MYR 287.00", zh ? "等待复核" : "Review pending", "disabled"],
  ];
  return (
    <>
      <PageToolbar summary={zh ? "最近结算：2 笔匹配 · 1 笔差异 · 1 笔人工复核" : "Latest settlement: 2 matched · 1 variance · 1 manual review"}>
        <button className="toolbar-action"><DownloadSimple size={17} />{zh ? "导出对账单" : "Export statement"}</button>
      </PageToolbar>
      <section className="reconciliation-metrics">
        <article><small>{zh ? "今日已结算" : "Settled today"}</small><strong>USD 2,142.30</strong><span>{zh ? "32 笔交易" : "32 transactions"}</span></article>
        <article><small>{zh ? "等待结算" : "Pending settlement"}</small><strong>USD 381.72</strong><span>{zh ? "8 笔交易" : "8 transactions"}</span></article>
        <article className="is-warning"><small>{zh ? "需要复核" : "Needs review"}</small><strong>1</strong><span>{zh ? "金额差异" : "Amount variance"}</span></article>
      </section>
      <section className="admin-panel reconciliation-table admin-data-scroll">
        <div className="mapping-header"><span>{zh ? "批次" : "Batch"}</span><span>{zh ? "来源" : "Source"}</span><span>{zh ? "金额" : "Amount"}</span><span>{zh ? "结果" : "Result"}</span><span>{zh ? "操作" : "Action"}</span></div>
        {rows.map(([id, source, amount, result, tone]) => <button className="mapping-row" key={id}><strong>{id}</strong><span>{source}</span><span>{amount}</span><StatusBadge tone={tone}>{result}</StatusBadge><ArrowRight size={16} /></button>)}
      </section>
    </>
  );
}

export function DisputesPage({ lang, onSensitiveAction }) {
  const zh = lang === "zh";
  const cases = [
    { id: "DSP-260727-0021", order: "CB-260726-N9D6KA", type: zh ? "未收到服务" : "Service not received", due: zh ? "剩余 4 天" : "4 days left", tone: "warning" },
    { id: "RFD-260727-0018", order: "CB-260727-P7M4CW", type: zh ? "部分退款" : "Partial refund", due: zh ? "等待财务审核" : "Finance review", tone: "disabled" },
  ];
  return (
    <>
      <PageToolbar summary={zh ? "1 个争议 · 1 个退款申请" : "1 dispute · 1 refund request"}>
        <button className="toolbar-action"><ListMagnifyingGlass size={17} />{zh ? "处理规则" : "Resolution rules"}</button>
      </PageToolbar>
      <div className="dispute-layout">
        <section className="admin-panel dispute-list admin-data-scroll">
          <div className="dispute-list__header"><span>{zh ? "案件编号" : "Case ID"}</span><span>{zh ? "订单号" : "Order ID"}</span><span>{zh ? "类型" : "Type"}</span><span>{zh ? "处理期限" : "Deadline"}</span><span>{zh ? "操作" : "Action"}</span></div>
          {cases.map((item) => <button key={item.id}><span className="dispute-id-cell"><span className="event-node is-warning" /><strong title={item.id}>{item.id}</strong></span><code title={item.order}>{item.order}</code><span title={item.type}>{item.type}</span><StatusBadge tone={item.tone}>{item.due}</StatusBadge><ArrowRight size={16} /></button>)}
        </section>
        <aside className="admin-panel dispute-guidance">
          <ShieldCheck size={25} />
          <small>{zh ? "敏感操作保护" : "SENSITIVE ACTION PROTECTION"}</small>
          <h2>{zh ? "退款与争议采用双人复核" : "Refunds and disputes use two-person review"}</h2>
          <p>{zh ? "创建退款、改变金额或提交争议证据前，需要重新验证并填写原因。" : "Creating a refund, changing an amount, or submitting dispute evidence requires re-verification and a reason."}</p>
          <button className="admin-primary" onClick={() => onSensitiveAction({ title: zh ? "批准退款需要重新验证" : "Refund approval requires re-verification", description: zh ? "审批人不能与申请人为同一员工。确认后会生成不可变审计事件。" : "The approver cannot be the requester. Confirmation creates an immutable audit event.", requireReason: true })}><LockKey size={17} />{zh ? "预览退款审批" : "Preview refund approval"}</button>
        </aside>
      </div>
    </>
  );
}

export function SecurityDesignPage({
  lang,
  googleAuthenticatorEnabled,
  onGoogleAuthenticatorToggle,
}) {
  const zh = lang === "zh";
  return (
    <>
      <section className={`google-auth-hero ${googleAuthenticatorEnabled ? "is-enabled" : "is-disabled"}`}>
        <span className="google-auth-hero__icon"><DeviceMobile size={28} weight="duotone" /></span>
        <div>
          <small>{zh ? "登录安全 · 唯一保留方式" : "SIGN-IN SECURITY · ONLY METHOD"}</small>
          <h2>Google Authenticator</h2>
          <p>{zh
            ? "管理员登录时输入验证器当前显示的 6 位动态码。页面不再展示其他二步验证或恢复方式。"
            : "Admins enter the current 6-digit authenticator code at sign-in. No other second-step or recovery method is shown."}</p>
        </div>
        <StatusBadge tone={googleAuthenticatorEnabled ? "healthy" : "disabled"}>
          {googleAuthenticatorEnabled ? (zh ? "已开启" : "Enabled") : (zh ? "已关闭" : "Disabled")}
        </StatusBadge>
        <button className="admin-primary" onClick={() => go("/admin/login")}><Eye size={17} />{zh ? "预览登录页" : "Preview sign in"}</button>
      </section>
      <div className="google-auth-layout">
        <section className="admin-panel google-auth-settings">
          <div className="google-auth-settings__heading">
            <span><ShieldCheck size={23} /></span>
            <div>
              <small>{zh ? "登录验证开关" : "SIGN-IN VERIFICATION SWITCH"}</small>
              <h2>{zh ? "要求 6 位动态码" : "Require a 6-digit code"}</h2>
            </div>
            <button
              className={`google-auth-switch ${googleAuthenticatorEnabled ? "is-on" : ""}`}
              type="button"
              role="switch"
              aria-checked={googleAuthenticatorEnabled}
              aria-label={zh ? "Google Authenticator 登录验证" : "Google Authenticator sign-in verification"}
              onClick={() => onGoogleAuthenticatorToggle(!googleAuthenticatorEnabled)}
            >
              <span />
            </button>
          </div>
          <p>{googleAuthenticatorEnabled
            ? (zh ? "开启后，管理员完成邮箱与密码输入后，会进入 Google Authenticator 6 位动态码页面。" : "When enabled, email and password are followed by the Google Authenticator 6-digit code screen.")
            : (zh ? "关闭后，登录设计将跳过动态码页面。本开关仅用于查看两种界面状态。" : "When disabled, the sign-in design skips the code screen. This switch only previews the two interface states.")}</p>
          <dl className="google-auth-policy">
            <div><dt>{zh ? "验证应用" : "Authenticator app"}</dt><dd>Google Authenticator</dd></div>
            <div><dt>{zh ? "动态码长度" : "Code length"}</dt><dd>{zh ? "6 位数字" : "6 digits"}</dd></div>
            <div><dt>{zh ? "开关位置" : "Control location"}</dt><dd>{zh ? "管理后台 / 安全中心" : "Admin / Security"}</dd></div>
          </dl>
          <div className="google-auth-demo-notice">
            <WarningCircle size={18} />
            <span>{zh
              ? "这是本地网页设计演示：开关刷新后重置，不修改服务器，不生成二维码，也不保存真实验证器密钥。"
              : "This is a local webpage design preview: the switch resets on refresh, changes no server setting, generates no QR code, and stores no authenticator secret."}</span>
          </div>
        </section>
        <aside className="admin-panel google-auth-code-preview" aria-label={zh ? "6 位动态码界面预览" : "6-digit code interface preview"}>
          <div className="google-auth-code-preview__top">
            <span className="google-auth-app-mark">G</span>
            <div><small>GOOGLE AUTHENTICATOR</small><strong>CloudBridge Admin</strong></div>
            <StatusBadge tone={googleAuthenticatorEnabled ? "healthy" : "disabled"}>
              {googleAuthenticatorEnabled ? (zh ? "验证中" : "Ready") : (zh ? "已暂停" : "Paused")}
            </StatusBadge>
          </div>
          <div className={`google-auth-digits ${googleAuthenticatorEnabled ? "" : "is-muted"}`} aria-hidden="true">
            {["1", "8", "4", "2", "7", "6"].map((digit, index) => <span key={`${digit}-${index}`}>{googleAuthenticatorEnabled ? digit : "–"}</span>)}
          </div>
          <div className="google-auth-code-preview__timing">
            <Clock size={17} />
            <span>{zh ? "6 位动态码输入预览" : "6-digit rotating code preview"}</span>
            <i><b /></i>
          </div>
          <small className="google-auth-preview-label">{zh ? "示例数字仅用于排版，不是真实验证码" : "Sample digits are visual placeholders, not a real code"}</small>
        </aside>
      </div>
    </>
  );
}

export function DataSecurityPage({ lang, onSensitiveAction }) {
  const zh = lang === "zh";
  const classifications = [
    [zh ? "公开内容" : "Public content", zh ? "商品、政策、轮播" : "Products, policies, hero", "healthy"],
    [zh ? "内部运营" : "Internal operations", zh ? "库存、分配、备注" : "Inventory, assignment, notes", "healthy"],
    [zh ? "个人信息" : "Personal data", zh ? "联系方式、IP、设备" : "Contacts, IP, device", "warning"],
    [zh ? "机密信息" : "Secrets", zh ? "密钥、Token、数据库凭据" : "Keys, tokens, DB credentials", "locked"],
  ];
  const retention = [
    [zh ? "未完成订单联系方式" : "Unfulfilled-order contacts", zh ? "订单关闭后 90 天" : "90 days after closure", zh ? "自动删除" : "Automatic deletion"],
    [zh ? "审计日志" : "Audit events", zh ? "400 天" : "400 days", zh ? "不可由普通管理员删除" : "Protected from standard admins"],
    [zh ? "支付参考记录" : "Payment references", zh ? "法务要求期限" : "Legal retention period", zh ? "不保存银行卡数据" : "No card data stored"],
  ];
  return (
    <>
      <PageToolbar summary={zh ? "4 个数据等级 · 3 项保留规则 · 2 个待处理请求" : "4 data classes · 3 retention rules · 2 pending requests"}>
        <button className="toolbar-action" onClick={() => onSensitiveAction({ title: zh ? "导出个人数据需要重新验证" : "Personal-data export requires re-verification", description: zh ? "导出文件将加密并设置自动过期，操作记录到审计日志。" : "The export is encrypted, expires automatically, and is written to the audit trail.", requireReason: true })}><DownloadSimple size={17} />{zh ? "受控导出" : "Controlled export"}</button>
      </PageToolbar>
      <section className="data-classification-grid">
        {classifications.map(([title, description, tone]) => <article key={title}><span className={`data-class-icon is-${tone}`}>{tone === "locked" ? <LockKey size={22} /> : <Database size={22} />}</span><div><small>{zh ? "数据等级" : "DATA CLASS"}</small><h2>{title}</h2><p>{description}</p></div><StatusBadge tone={tone === "locked" ? "warning" : tone}>{tone === "locked" ? (zh ? "严格限制" : "Restricted") : tone === "warning" ? (zh ? "需最小化" : "Minimize") : (zh ? "已定义" : "Defined")}</StatusBadge></article>)}
      </section>
      <div className="data-governance-layout">
        <section className="admin-panel retention-table admin-data-scroll">
          <div className="panel-heading"><h2>{zh ? "保留与删除规则" : "Retention and deletion"}</h2><button>{zh ? "查看规则历史" : "View history"}</button></div>
          <div className="retention-table__header"><span>{zh ? "数据类型" : "Data type"}</span><span>{zh ? "保留期限" : "Retention"}</span><span>{zh ? "删除规则" : "Deletion rule"}</span></div>
          {retention.map(([data, period, policy]) => <div key={data}><strong>{data}</strong><span>{period}</span><small>{policy}</small></div>)}
        </section>
        <aside className="admin-panel privacy-requests">
          <div className="panel-heading"><h2>{zh ? "隐私请求" : "Privacy requests"}</h2><StatusBadge tone="warning">2</StatusBadge></div>
          <button><span><Eye size={18} /></span><div><strong>{zh ? "访问与导出请求" : "Access and export request"}</strong><small>PRV-260727-014 · {zh ? "剩余 12 天" : "12 days left"}</small></div><ArrowRight size={16} /></button>
          <button><span><WarningCircle size={18} /></span><div><strong>{zh ? "删除请求待复核" : "Deletion request review"}</strong><small>PRV-260726-011 · {zh ? "存在未关闭订单" : "Open order exists"}</small></div><ArrowRight size={16} /></button>
        </aside>
      </div>
      <section className="architecture-strip admin-panel">
        <div><small>{zh ? "托管基础设施设计" : "MANAGED INFRASTRUCTURE DESIGN"}</small><h2>{zh ? "数据流与信任边界" : "Data flow and trust boundaries"}</h2></div>
        <div className="architecture-flow" aria-label={zh ? "AWS 架构流程" : "AWS architecture flow"}>
          {["CloudFront / WAF", "ALB", "ECS / Fargate", "RDS MySQL Multi-AZ"].map((item, index) => <span key={item}><strong>{item}</strong><small>{index === 0 ? "EDGE" : index === 1 ? "ROUTING" : index === 2 ? "PRIVATE APP" : "ENCRYPTED DATA"}</small></span>)}
        </div>
        <p>{zh ? "ElastiCache 管理会话与限流，私有 S3 保存媒体，KMS 与 Secrets Manager 保护密钥，SQS 承接异步任务，CloudWatch / GuardDuty 提供告警。" : "ElastiCache supports sessions and rate limits, private S3 stores media, KMS and Secrets Manager protect secrets, SQS handles asynchronous work, and CloudWatch / GuardDuty provide alerts."}</p>
      </section>
    </>
  );
}

export function BackupsPage({ lang, onSensitiveAction }) {
  const zh = lang === "zh";
  const restorePoints = [
    [zh ? "自动时间点" : "Automated restore point", "2026-07-27 14:40 UTC", zh ? "可恢复" : "Restorable", "healthy"],
    [zh ? "每日快照" : "Daily snapshot", "2026-07-27 04:00 UTC", zh ? "已验证" : "Verified", "healthy"],
    [zh ? "月度归档" : "Monthly archive", "2026-07-01 04:00 UTC", zh ? "跨区域副本" : "Cross-region copy", "healthy"],
  ];
  return (
    <>
      <section className="backup-objectives">
        <article><small>RPO</small><strong>≤ 5 min</strong><span>{zh ? "最大数据丢失目标" : "Maximum data-loss objective"}</span></article>
        <article><small>RTO</small><strong>≤ 60 min</strong><span>{zh ? "核心服务恢复目标" : "Core-service recovery objective"}</span></article>
        <article><small>{zh ? "最近演练" : "LAST DRILL"}</small><strong>{zh ? "通过" : "Passed"}</strong><span>2026-07-20 · 42 min</span></article>
      </section>
      <div className="backup-layout">
        <section className="admin-panel restore-points admin-data-scroll">
          <div className="panel-heading"><h2>{zh ? "恢复点" : "Restore points"}</h2><button><ArrowsClockwise size={16} />{zh ? "刷新" : "Refresh"}</button></div>
          <div className="restore-points__header"><span>{zh ? "恢复点" : "Restore point"}</span><span>{zh ? "创建时间" : "Created at"}</span><span>{zh ? "状态" : "Status"}</span><span>{zh ? "操作" : "Action"}</span></div>
          {restorePoints.map(([name, time, state, tone]) => <button key={name}><span className="restore-point-name"><span className="integration-glyph"><Database size={20} /></span><strong title={name}>{name}</strong></span><time>{time}</time><StatusBadge tone={tone}>{state}</StatusBadge><ArrowRight size={16} /></button>)}
        </section>
        <aside className="admin-panel recovery-drill">
          <small>{zh ? "恢复演练" : "RECOVERY DRILL"}</small><h2>{zh ? "从备份到业务验证" : "From backup to business validation"}</h2>
          <div className="recovery-steps">
            {[zh ? "创建隔离恢复环境" : "Create isolated recovery environment", zh ? "恢复数据库与对象清单" : "Restore database and object manifest", zh ? "验证订单与权限完整性" : "Validate orders and access integrity", zh ? "销毁演练环境并归档证据" : "Destroy drill environment and archive evidence"].map((step, index) => <span key={step}><i>{index + 1}</i><strong>{step}</strong><CheckCircle size={17} /></span>)}
          </div>
          <button className="admin-primary" onClick={() => onSensitiveAction({ title: zh ? "启动恢复演练" : "Start recovery drill", description: zh ? "演练只创建隔离环境，不覆盖当前数据；仍需要双人审批。" : "The drill creates an isolated environment and never overwrites current data; two-person approval is still required.", requireReason: true })}><ShieldCheck size={17} />{zh ? "申请恢复演练" : "Request recovery drill"}</button>
        </aside>
      </div>
    </>
  );
}

export function SecretsPage({ lang, onSensitiveAction }) {
  const zh = lang === "zh";
  const secrets = [
    ["RDS application user", "AWS Secrets Manager", "•••• 9C4F", zh ? "13 天后轮换" : "Rotates in 13 days", "healthy"],
    ["Stripe sandbox key", "AWS Secrets Manager", "•••• 4F8A", zh ? "测试环境" : "Sandbox only", "healthy"],
    ["Webhook signing secret", "AWS Secrets Manager", "•••• 8D2C", zh ? "42 天后轮换" : "Rotates in 42 days", "warning"],
    ["KMS data key", "AWS KMS", "key/•••• 61BE", zh ? "托管轮换" : "Managed rotation", "healthy"],
  ];
  return (
    <>
      <PageToolbar summary={zh ? "4 个机密引用 · 0 个明文值 · 1 个轮换提醒" : "4 secret references · 0 plaintext values · 1 rotation reminder"}>
        <button className="toolbar-action" onClick={() => onSensitiveAction({ title: zh ? "创建机密引用" : "Create secret reference", description: zh ? "后台只保存 Secrets Manager 引用，不接收或显示完整机密值。" : "The console stores only a Secrets Manager reference and never accepts or displays the full secret." })}><Key size={17} />{zh ? "新增引用" : "New reference"}</button>
      </PageToolbar>
      <section className="admin-panel secrets-table admin-data-scroll">
        <div className="mapping-header"><span>{zh ? "名称" : "Name"}</span><span>{zh ? "存储位置" : "Store"}</span><span>{zh ? "标识" : "Identifier"}</span><span>{zh ? "轮换状态" : "Rotation"}</span><span>{zh ? "操作" : "Action"}</span></div>
        {secrets.map(([name, store, suffix, rotation, tone]) => <div className="mapping-row" key={name}><strong>{name}</strong><span>{store}</span><code>{suffix}</code><StatusBadge tone={tone}>{rotation}</StatusBadge><button aria-label={zh ? `复制 ${name} 引用` : `Copy ${name} reference`}><Copy size={16} /></button></div>)}
      </section>
      <div className="secret-boundary-note"><LockKey size={20} /><div><strong>{zh ? "此页面永远不显示机密值" : "This page never displays secret values"}</strong><p>{zh ? "查看状态、末尾标识、使用范围和轮换记录即可完成日常运维。真正的读取权限由 IAM 与 KMS 控制。" : "Status, suffix, usage scope, and rotation history are sufficient for operations. IAM and KMS control actual read access."}</p></div></div>
    </>
  );
}

export function SecurityEventsPage({ lang }) {
  const zh = lang === "zh";
  const [filter, setFilter] = useState("all");
  const events = [
    { type: "signin", title: zh ? "跨地区登录需要复核" : "Cross-region sign-in needs review", meta: "Windows Desktop · Singapore · 203.0.113.28", time: "14:22", tone: "warning" },
    { type: "access", title: zh ? "客户联系方式已揭示" : "Customer contact revealed", meta: "CB-260727-8K3P9M · Lin Cheng · reason recorded", time: "14:18", tone: "healthy" },
    { type: "payment", title: zh ? "支付正式模式变更被拒绝" : "Live-payment change denied", meta: "Role: Content editor · TRACE-CB-SEC-8841", time: "13:47", tone: "warning" },
    { type: "webhook", title: zh ? "重复 Webhook 已忽略" : "Duplicate webhook ignored", meta: "evt_01J99Z · idempotency key matched", time: "13:31", tone: "healthy" },
  ];
  const visible = filter === "all" ? events : events.filter((event) => event.type === filter);
  return (
    <>
      <PageToolbar summary={zh ? "过去 24 小时：2 个待复核 · 18 个已验证事件" : "Last 24 hours: 2 pending review · 18 verified events"}>
        <button className="toolbar-action"><DownloadSimple size={17} />{zh ? "导出审计证据" : "Export audit evidence"}</button>
      </PageToolbar>
      <div className="security-event-filters">
        {[["all", zh ? "全部事件" : "All events"], ["signin", zh ? "登录" : "Sign-in"], ["access", zh ? "数据访问" : "Data access"], ["payment", zh ? "支付" : "Payment"], ["webhook", "Webhook"]].map(([id, label]) => <button className={filter === id ? "is-active" : ""} onClick={() => setFilter(id)} key={id}>{label}</button>)}
      </div>
      <section className="admin-panel security-event-list admin-data-scroll">
        <div className="security-event-list__header"><span>{zh ? "事件" : "Event"}</span><span>{zh ? "证据" : "Evidence"}</span><span>{zh ? "时间" : "Time"}</span><span>{zh ? "状态" : "Status"}</span><span>{zh ? "操作" : "Action"}</span></div>
        {visible.map((event) => <button key={`${event.type}-${event.time}`}><span className="event-title-cell"><span className={`event-node is-${event.tone}`} /><strong title={event.title}>{event.title}</strong></span><span title={event.meta}>{event.meta}</span><time>{event.time}</time><StatusBadge tone={event.tone}>{event.tone === "warning" ? (zh ? "待复核" : "Review") : (zh ? "已验证" : "Verified")}</StatusBadge><ArrowRight size={16} /></button>)}
      </section>
    </>
  );
}
