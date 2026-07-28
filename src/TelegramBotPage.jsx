import { useState } from "react";
import {
  ArrowRight,
  ArrowsClockwise,
  Check,
  CheckCircle,
  Clock,
  LockKey,
  PaperPlaneTilt,
  Receipt,
  ShieldCheck,
  TelegramLogo,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";

const tabs = [
  { id: "setup", zh: "连接与事件", en: "Connection & events" },
  { id: "template", zh: "消息模板", en: "Message template" },
  { id: "delivery", zh: "发送记录", en: "Delivery history" },
];

const eventOptions = [
  {
    id: "newOrder",
    zh: "新订单已创建",
    en: "New order created",
    descriptionZh: "订单进入“待人工处理”后立即进入通知队列。",
    descriptionEn: "Queue a notification when an order enters Manual handling.",
  },
  {
    id: "payment",
    zh: "付款状态变化",
    en: "Payment status changed",
    descriptionZh: "在线支付启用后才会产生此事件。",
    descriptionEn: "This event is available only after online payments are enabled.",
  },
  {
    id: "refund",
    zh: "退款或争议",
    en: "Refund or dispute",
    descriptionZh: "高风险状态只推送摘要，不包含资金凭据。",
    descriptionEn: "High-risk events include a summary only, never payment credentials.",
  },
];

const deliveryRows = [
  {
    id: "EVT-ORDER-8K3P9M",
    order: "CB-260727-8K3P9M",
    event: { zh: "新订单", en: "New order" },
    time: "14:32:08",
    status: "sent",
    attempts: 1,
  },
  {
    id: "EVT-ORDER-4Q8J2A",
    order: "CB-260727-4Q8J2A",
    event: { zh: "新订单", en: "New order" },
    time: "14:18:41",
    status: "queued",
    attempts: 0,
  },
  {
    id: "EVT-ORDER-7M2R5B",
    order: "CB-260727-7M2R5B",
    event: { zh: "新订单", en: "New order" },
    time: "13:54:16",
    status: "failed",
    attempts: 3,
  },
];

function StatusBadge({ status, lang }) {
  const content = {
    sent: { zh: "模拟已发送", en: "Simulated sent", Glyph: CheckCircle },
    queued: { zh: "模拟排队中", en: "Simulated queued", Glyph: Clock },
    failed: { zh: "模拟失败", en: "Simulated failed", Glyph: XCircle },
  }[status];
  const Glyph = content.Glyph;
  return (
    <span className={`telegram-delivery-status is-${status}`}>
      <Glyph size={15} />
      {content[lang]}
    </span>
  );
}

function MessagePreview({ lang }) {
  const zh = lang === "zh";
  return (
    <section className="telegram-preview-card" aria-label={zh ? "Telegram 消息预览" : "Telegram message preview"}>
      <div className="telegram-preview-bar">
        <span><TelegramLogo size={20} weight="fill" /></span>
        <div>
          <strong>CloudBridge Orders Bot</strong>
          <small>{zh ? "管理群消息预览 · 不会真实发送" : "Admin group preview · Nothing is sent"}</small>
        </div>
        <em>{zh ? "模拟" : "SIMULATION"}</em>
      </div>
      <article className="telegram-message-bubble">
        <div className="telegram-message-title">
          <span><Receipt size={20} /></span>
          <div>
            <strong>{zh ? "新订单待人工处理" : "New order needs manual handling"}</strong>
            <small>ORDER_CREATED · 14:32</small>
          </div>
        </div>
        <dl>
          <div><dt>{zh ? "订单号" : "Order"}</dt><dd>CB-260727-8K3P9M</dd></div>
          <div><dt>{zh ? "商品" : "Product"}</dt><dd>OpenAI Codex</dd></div>
          <div><dt>{zh ? "金额" : "Amount"}</dt><dd>RM 89.00 · MYR</dd></div>
          <div><dt>{zh ? "联系方式" : "Contact"}</dt><dd>WhatsApp · +60 •••• 0281</dd></div>
          <div><dt>{zh ? "状态" : "Status"}</dt><dd>{zh ? "待人工处理" : "Manual handling"}</dd></div>
        </dl>
        <a href="#/admin/orders">
          {zh ? "在后台打开订单" : "Open order in admin"}
          <ArrowRight size={16} />
        </a>
        <p><LockKey size={15} />{zh ? "完整联系方式仅能在后台重新认证后查看。" : "Full contact details require re-authentication in admin."}</p>
      </article>
    </section>
  );
}

export default function TelegramBotPage({ lang, onSensitiveAction }) {
  const zh = lang === "zh";
  const [activeTab, setActiveTab] = useState("setup");
  const [connection, setConnection] = useState("disconnected");
  const [testResult, setTestResult] = useState("idle");
  const [testScenario, setTestScenario] = useState("success");
  const [retryStatus, setRetryStatus] = useState("failed");
  const [events, setEvents] = useState({
    newOrder: true,
    payment: false,
    refund: true,
  });

  const requestConnection = () => {
    onSensitiveAction?.({
      title: zh ? "确认 Telegram 机器人连接配置" : "Confirm Telegram bot connection",
      description: zh
        ? "这是高权限集成操作。完成重新认证后，只会把页面切换到“模拟已连接”，不会保存 Token 或请求 Telegram。"
        : "This is a privileged integration action. Re-authentication only changes this page to Simulated connected; no token is stored and Telegram is not contacted.",
      requireReason: true,
      onConfirm: () => setConnection("connected"),
    });
  };

  const runSimulation = () => {
    setTestResult(testScenario === "success" ? "success" : "failed");
  };

  const retryFailedDelivery = () => {
    setRetryStatus("sent");
  };

  return (
    <div className="telegram-bot-page">
      <section className="telegram-bot-summary admin-panel">
        <span className="telegram-bot-mark"><TelegramLogo size={31} weight="fill" /></span>
        <div className="telegram-bot-summary__copy">
          <div className="telegram-bot-kicker">
            <span className={`telegram-connection-state is-${connection}`}>
              <i />
              {connection === "connected"
                ? (zh ? "模拟已连接" : "Simulated connected")
                : (zh ? "未连接" : "Not connected")}
            </span>
            <span>{zh ? "仅本地设计预览" : "Local design preview only"}</span>
          </div>
          <strong>{zh ? "新订单自动推送到管理群" : "Send new orders to the admin group"}</strong>
          <p>{zh ? "管理员收到脱敏订单摘要后，可直接打开后台领取和处理订单。" : "Admins receive a masked order summary and can open the admin console to claim it."}</p>
        </div>
        <div className="telegram-bot-summary__actions">
          <button type="button" className="admin-secondary" onClick={() => setActiveTab("template")}>
            {zh ? "预览消息" : "Preview message"}
          </button>
          <button type="button" className="admin-primary" onClick={requestConnection}>
            <ShieldCheck size={17} />
            {connection === "connected" ? (zh ? "重新验证配置" : "Re-verify setup") : (zh ? "设计连接流程" : "Review connection flow")}
          </button>
        </div>
      </section>

      <div className="telegram-bot-tabs" role="tablist" aria-label={zh ? "Telegram 机器人设计模块" : "Telegram bot design sections"}>
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "is-active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab[lang]}
          </button>
        ))}
      </div>

      {activeTab === "setup" && (
        <div className="telegram-setup-grid" role="tabpanel">
          <section className="admin-panel telegram-config-panel">
            <div className="telegram-section-heading">
              <div><h2>{zh ? "连接配置" : "Connection setup"}</h2><p>{zh ? "这里只展示未来配置结构，不提供 Token 输入框。" : "This shows the future configuration structure without a token field."}</p></div>
              <span>{zh ? "需重新认证" : "Re-auth required"}</span>
            </div>
            <div className="telegram-config-list">
              <article>
                <span><TelegramLogo size={21} /></span>
                <div><small>{zh ? "机器人凭据" : "Bot credential"}</small><strong>{zh ? "未配置" : "Not configured"}</strong><p>{zh ? "未来仅由服务端从 Secrets Manager 读取" : "Future server-side access through Secrets Manager only"}</p></div>
                <em>{zh ? "不展示完整值" : "Value never shown"}</em>
              </article>
              <article>
                <span><PaperPlaneTilt size={21} /></span>
                <div><small>{zh ? "目标会话" : "Destination"}</small><strong>{zh ? "CloudBridge 订单管理群" : "CloudBridge Orders Admin"}</strong><p>Chat ID · •••• 4821</p></div>
                <em>{zh ? "管理群" : "Admin group"}</em>
              </article>
              <article>
                <span><ShieldCheck size={21} /></span>
                <div><small>{zh ? "权限范围" : "Permission scope"}</small><strong>{zh ? "仅发送消息" : "Send messages only"}</strong><p>{zh ? "不读取群历史、不接收客户消息" : "No group history or customer messages"}</p></div>
                <em>{zh ? "最小权限" : "Least privilege"}</em>
              </article>
            </div>
            <div className="telegram-security-callout">
              <LockKey size={19} />
              <div><strong>{zh ? "Token 永远不进入前端" : "The token never enters the frontend"}</strong><p>{zh ? "正式开发时，Bot Token 只能存在服务端机密存储中；浏览器、日志、消息模板和审计详情都不能出现完整值。" : "In production, the Bot Token belongs only in server-side secret storage and must never appear in the browser, logs, templates, or audit details."}</p></div>
            </div>
          </section>

          <section className="admin-panel telegram-events-panel">
            <div className="telegram-section-heading">
              <div><h2>{zh ? "推送事件" : "Notification events"}</h2><p>{zh ? "开关只改变本地预览状态。" : "Toggles change local preview state only."}</p></div>
              <span>{zh ? "3 个事件" : "3 events"}</span>
            </div>
            <div className="telegram-event-list">
              {eventOptions.map((event) => (
                <article key={event.id}>
                  <div><strong>{event[lang]}</strong><p>{zh ? event.descriptionZh : event.descriptionEn}</p></div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={events[event.id]}
                    aria-label={`${event[lang]} · ${events[event.id] ? (zh ? "已开启" : "On") : (zh ? "已关闭" : "Off")}`}
                    className={`switch ${events[event.id] ? "is-on" : ""}`}
                    onClick={() => setEvents((current) => ({ ...current, [event.id]: !current[event.id] }))}
                  >
                    <i />
                  </button>
                </article>
              ))}
            </div>
            <div className="telegram-test-box">
              <div>
                <strong>{zh ? "模拟测试消息" : "Simulated test message"}</strong>
                <p>{zh ? "选择结果后运行，页面不会发起网络请求。" : "Choose an outcome and run it without any network request."}</p>
              </div>
              <label>
                <span>{zh ? "模拟结果" : "Mock result"}</span>
                <select value={testScenario} onChange={(event) => setTestScenario(event.target.value)}>
                  <option value="success">{zh ? "成功" : "Success"}</option>
                  <option value="failed">{zh ? "失败" : "Failure"}</option>
                </select>
              </label>
              <button type="button" className="admin-primary" onClick={runSimulation}>
                <PaperPlaneTilt size={17} />
                {zh ? "运行模拟测试" : "Run simulation"}
              </button>
              {testResult !== "idle" && (
                <div className={`telegram-test-result is-${testResult}`} role="status">
                  {testResult === "success" ? <CheckCircle size={18} /> : <WarningCircle size={18} />}
                  <span>
                    <strong>{testResult === "success" ? (zh ? "模拟发送成功" : "Simulated send succeeded") : (zh ? "模拟发送失败" : "Simulated send failed")}</strong>
                    <small>{testResult === "success" ? (zh ? "未连接 Telegram，未产生真实消息。" : "Telegram was not contacted and no message was sent.") : (zh ? "预览：请求超时，将进入指数退避重试。" : "Preview: request timed out and would enter exponential backoff.")}</small>
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === "template" && (
        <div className="telegram-template-grid" role="tabpanel">
          <section className="admin-panel telegram-template-panel">
            <div className="telegram-section-heading">
              <div><h2>{zh ? "新订单消息模板" : "New-order message template"}</h2><p>{zh ? "字段顺序固定，避免员工遗漏订单号、金额和处理状态。" : "The field order is fixed so staff can scan the order, amount, and handling state."}</p></div>
              <span>{zh ? "中文模板" : "Chinese template"}</span>
            </div>
            <div className="telegram-template-fields">
              {[
                [zh ? "标题" : "Title", zh ? "新订单待人工处理" : "New order needs manual handling"],
                [zh ? "订单字段" : "Order fields", "{order_id} · {product_name} · {amount} {currency}"],
                [zh ? "联系字段" : "Contact field", "{contact_channel} · {masked_contact}"],
                [zh ? "后台入口" : "Admin link", "{admin_order_url}"],
              ].map(([label, value]) => (
                <label key={label}><span>{label}</span><input value={value} readOnly /></label>
              ))}
            </div>
            <div className="telegram-variable-list">
              <strong>{zh ? "允许使用的变量" : "Allowed variables"}</strong>
              <div>{["{order_id}", "{product_name}", "{amount}", "{currency}", "{contact_channel}", "{masked_contact}", "{created_at}", "{admin_order_url}"].map((variable) => <code key={variable}>{variable}</code>)}</div>
            </div>
            <div className="telegram-template-warning">
              <WarningCircle size={18} />
              <p>{zh ? "禁止变量：完整联系方式、客户内部备注、付款凭据、登录信息、Token 和任何未完成脱敏的个人数据。" : "Forbidden variables: full contact details, internal customer notes, payment credentials, login data, tokens, and any unmasked personal data."}</p>
            </div>
          </section>
          <MessagePreview lang={lang} />
        </div>
      )}

      {activeTab === "delivery" && (
        <section className="admin-panel telegram-delivery-panel" role="tabpanel">
          <div className="telegram-delivery-summary">
            <div><small>{zh ? "连接证据" : "Connection evidence"}</small><strong>{zh ? "未配置 · 本地模拟" : "Not configured · Local simulation"}</strong><span>{zh ? "更新：刚刚" : "Updated: just now"}</span></div>
            <div><small>{zh ? "最近 24 小时" : "Last 24 hours"}</small><strong>18</strong><span>{zh ? "模拟事件" : "simulated events"}</span></div>
            <div><small>{zh ? "待重试" : "Awaiting retry"}</small><strong>{retryStatus === "sent" ? "0" : "1"}</strong><span>{zh ? "模拟失败记录" : "simulated failure"}</span></div>
          </div>
          <div className="telegram-delivery-heading">
            <div><h2>{zh ? "发送记录与重试" : "Delivery history and retry"}</h2><p>{zh ? "正式实现必须保存 Telegram 返回结果、幂等键和追踪 ID。" : "Production must persist Telegram results, idempotency keys, and trace IDs."}</p></div>
            <button type="button" className="admin-secondary"><ArrowsClockwise size={17} />{zh ? "刷新模拟数据" : "Refresh mock data"}</button>
          </div>
          <div className="telegram-delivery-table" role="table" aria-label={zh ? "Telegram 发送记录" : "Telegram delivery history"}>
            <div className="telegram-delivery-row is-head" role="row">
              <span role="columnheader">{zh ? "事件" : "Event"}</span>
              <span role="columnheader">{zh ? "事件编号" : "Event ID"}</span>
              <span role="columnheader">{zh ? "订单" : "Order"}</span>
              <span role="columnheader">{zh ? "时间" : "Time"}</span>
              <span role="columnheader">{zh ? "尝试" : "Attempts"}</span>
              <span role="columnheader">{zh ? "状态" : "Status"}</span>
              <span role="columnheader">{zh ? "操作" : "Action"}</span>
            </div>
            {deliveryRows.map((row) => {
              const status = row.status === "failed" ? retryStatus : row.status;
              return (
                <div className="telegram-delivery-row" role="row" key={row.id}>
                  <span role="cell">{row.event[lang]}</span>
                  <span role="cell" title={row.id}>{row.id}</span>
                  <span role="cell">{row.order}</span>
                  <span role="cell">{row.time}</span>
                  <span role="cell">{status === "sent" && row.status === "failed" ? row.attempts + 1 : row.attempts}</span>
                  <span role="cell"><StatusBadge status={status} lang={lang} /></span>
                  <span role="cell">
                    {row.status === "failed" ? (
                      <button type="button" disabled={retryStatus === "sent"} onClick={retryFailedDelivery}>
                        {retryStatus === "sent" ? <Check size={16} /> : <ArrowsClockwise size={16} />}
                        {retryStatus === "sent" ? (zh ? "模拟已恢复" : "Simulated recovered") : (zh ? "模拟重试" : "Simulate retry")}
                      </button>
                    ) : <em>—</em>}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="telegram-delivery-footnote">
            <ShieldCheck size={17} />
            <span>{zh ? "审计建议：记录操作者、订单、事件 ID、目标群末尾标识、尝试次数、结果、设备和追踪 ID。" : "Audit recommendation: record operator, order, event ID, masked group ID, attempts, result, device, and trace ID."}</span>
          </div>
        </section>
      )}
    </div>
  );
}
