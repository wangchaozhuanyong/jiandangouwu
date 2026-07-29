import {
  Archive,
  ArrowRight,
  ArrowsClockwise,
  Bell,
  CaretRight,
  ChatsCircle,
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
  FileText,
  Globe,
  HardDrives,
  Image as ImageIcon,
  Key,
  ListMagnifyingGlass,
  LockKey,
  MagnifyingGlass,
  PencilSimple,
  PlugsConnected,
  Pulse,
  QrCode,
  Receipt,
  ShieldCheck,
  SlidersHorizontal,
  TelegramLogo,
  Translate,
  UploadSimple,
  UserPlus,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { Locale } from "../api";
import type { Page } from "../admin-model";
import { DesignWorkflowDialog } from "../design-workflows";

type PreviewAction = (label: string) => void;
type IconComponent = typeof Receipt;

const text = (locale: Locale, zh: string, en: string) => locale === "zh" ? zh : en;

const mediaAssets = [
  "/assets/hero-main.webp",
  "/assets/hero-codex.webp",
  "/assets/hero-gemini.webp",
  "/assets/hero-currency.webp",
  "/assets/product-codex.webp",
  "/assets/product-claude.webp",
  "/assets/product-gemini.webp",
  "/assets/product-midjourney.webp",
];

function StatusTag({
  tone = "neutral",
  children,
}: {
  tone?: "success" | "warning" | "danger" | "neutral" | "locked";
  children: React.ReactNode;
}) {
  return <span className={`design-status is-${tone}`}><i />{children}</span>;
}

function PreviewToolbar({
  summary,
  action,
  icon: Icon,
  onAction,
}: {
  summary: string;
  action: string;
  icon: IconComponent;
  onAction: () => void;
}) {
  return (
    <div className="design-toolbar">
      <span>{summary}</span>
      <button className="admin-primary" onClick={onAction}><Icon size={17} />{action}</button>
    </div>
  );
}

function PreviewStat({
  icon: Icon,
  label,
  value,
  meta,
  tone = "blue",
}: {
  icon: IconComponent;
  label: string;
  value: string;
  meta: string;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  return (
    <article className={`design-stat is-${tone}`}>
      <span><Icon size={20} /></span>
      <div><small>{label}</small><strong>{value}</strong><em>{meta}</em></div>
    </article>
  );
}

export default function DesignPreviewPage({ page, locale }: { page: Page; locale: Locale }) {
  const [feedback, setFeedback] = useState("");
  const [workflowLabel, setWorkflowLabel] = useState("");
  useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(""), 2400);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const preview: PreviewAction = (label) => {
    setWorkflowLabel(label);
  };

  let content: React.ReactNode = null;
  if (page === "disputes") content = <DisputesDesign locale={locale} preview={preview} />;
  else if (page === "media") content = <MediaDesign locale={locale} preview={preview} />;
  else if (page === "translations") content = <TranslationsDesign locale={locale} preview={preview} />;
  else if (page === "notifications") content = <NotificationsDesign locale={locale} preview={preview} />;
  else if (page === "payments") content = <PaymentsDesign locale={locale} preview={preview} />;
  else if (page === "reconciliation") content = <ReconciliationDesign locale={locale} preview={preview} />;
  else if (page === "team") content = <TeamDesign locale={locale} preview={preview} />;
  else if (page === "roles") content = <RolesDesign locale={locale} preview={preview} />;
  else if (page === "security-events") content = <SecurityEventsDesign locale={locale} preview={preview} />;
  else if (page === "data-security") content = <DataSecurityDesign locale={locale} preview={preview} />;
  else if (page === "secrets") content = <SecretsDesign locale={locale} preview={preview} />;
  else if (page === "backups") content = <BackupsDesign locale={locale} preview={preview} />;
  else if (page === "integrations") content = <IntegrationsDesign locale={locale} preview={preview} />;

  return (
    <>
      <div className="design-preview-note" role="note">
        <Eye size={17} />
        <span>
          <strong>{text(locale, "界面设计预览", "Interface design preview")}</strong>
          {text(locale, "使用模拟数据展示完整布局与交互状态，暂不修改服务器数据。", "Mock data demonstrates the complete layout and interaction states. Server data is unchanged.")}
        </span>
      </div>
      {content}
      <div className={`design-preview-feedback${feedback ? " is-visible" : ""}`} role="status" aria-live="polite">
        <CheckCircle size={17} />{feedback}
      </div>
      {workflowLabel && (
        <DesignWorkflowDialog
          id={page}
          locale={locale}
          contextLabel={workflowLabel}
          onClose={() => setWorkflowLabel("")}
          onPreviewed={setFeedback}
        />
      )}
    </>
  );
}

function DisputesDesign({ locale, preview }: { locale: Locale; preview: PreviewAction }) {
  const [selected, setSelected] = useState(0);
  const cases = [
    ["DSP-260727-0021", "CB-260726-N9D6KA", text(locale, "未收到服务", "Service not received"), text(locale, "剩余 4 天", "4 days left")],
    ["RFD-260727-0018", "CB-260727-P7M4CW", text(locale, "部分退款", "Partial refund"), text(locale, "等待财务复核", "Finance review")],
    ["DSP-260725-0014", "CB-260725-H2Q8LX", text(locale, "重复扣款", "Duplicate charge"), text(locale, "证据已提交", "Evidence submitted")],
  ];
  const current = cases[selected]!;
  return (
    <>
      <PreviewToolbar summary={text(locale, "2 个争议 · 1 个退款申请", "2 disputes · 1 refund request")} action={text(locale, "处理规则", "Resolution rules")} icon={ListMagnifyingGlass} onAction={() => preview(text(locale, "处理规则", "Resolution rules"))} />
      <div className="design-stats">
        <PreviewStat icon={WarningCircle} label={text(locale, "待处理案件", "Open cases")} value="3" meta={text(locale, "1 项临近期限", "1 nearing deadline")} tone="amber" />
        <PreviewStat icon={CurrencyCircleDollar} label={text(locale, "申请退款金额", "Refund requested")} value="MYR 368.00" meta={text(locale, "本月 4 笔", "4 this month")} />
        <PreviewStat icon={Clock} label={text(locale, "平均处理时长", "Average resolution")} value="18.4h" meta={text(locale, "较上月快 2.1 小时", "2.1h faster MoM")} tone="green" />
      </div>
      <div className="design-split">
        <section className="admin-panel design-list-panel">
          <div className="design-list-heading"><span>{text(locale, "案件", "Case")}</span><span>{text(locale, "类型与期限", "Type & deadline")}</span></div>
          {cases.map((item, index) => (
            <button className={selected === index ? "is-selected" : ""} onClick={() => setSelected(index)} key={item[0]}>
              <span className="design-list-icon is-warning"><WarningCircle size={19} /></span>
              <div><strong>{item[0]}</strong><small>{item[1]}</small></div>
              <div><strong>{item[2]}</strong><small>{item[3]}</small></div>
              <CaretRight size={16} />
            </button>
          ))}
        </section>
        <aside className="admin-panel design-detail-panel">
          <span className="design-detail-icon is-warning"><ShieldCheck size={24} /></span>
          <small>{current[0]} · {current[1]}</small>
          <h2>{current[2]}</h2>
          <p>{text(locale, "客户提交的材料、沟通记录和退款金额集中在此处复核。敏感决定采用双人确认。", "Review customer evidence, communication history, and refund value in one place. Sensitive decisions use two-person approval.")}</p>
          <dl>
            <div><dt>{text(locale, "处理期限", "Deadline")}</dt><dd>{current[3]}</dd></div>
            <div><dt>{text(locale, "当前负责人", "Owner")}</dt><dd>Lin Cheng</dd></div>
            <div><dt>{text(locale, "复核方式", "Review")}</dt><dd>{text(locale, "双人确认", "Two-person approval")}</dd></div>
          </dl>
          <button className="admin-primary" onClick={() => preview(text(locale, "打开案件工作台", "Open case workspace"))}><LockKey size={17} />{text(locale, "打开案件工作台", "Open case workspace")}</button>
        </aside>
      </div>
    </>
  );
}

function MediaDesign({ locale, preview }: { locale: Locale; preview: PreviewAction }) {
  const [filter, setFilter] = useState<"all" | "hero" | "product">("all");
  const visible = mediaAssets.filter((_, index) => filter === "all" || (filter === "hero" ? index < 4 : index >= 4));
  return (
    <>
      <PreviewToolbar summary={text(locale, "12 个资源 · WebP · 全部已优化", "12 assets · WebP · all optimized")} action={text(locale, "上传资源", "Upload asset")} icon={UploadSimple} onAction={() => preview(text(locale, "上传资源", "Upload asset"))} />
      <div className="design-filterbar">
        {(["all", "hero", "product"] as const).map((item) => <button className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)} key={item}>{item === "all" ? text(locale, "全部", "All") : item === "hero" ? text(locale, "首页轮播", "Hero") : text(locale, "商品图片", "Products")}</button>)}
        <label><MagnifyingGlass size={16} /><input placeholder={text(locale, "搜索文件名或使用位置", "Search file or placement")} /></label>
      </div>
      <div className="design-media-grid">
        {visible.map((src, index) => (
          <article className="admin-panel" key={src}>
            <img src={src} alt={text(locale, "CloudBridge 媒体资源预览", "CloudBridge media asset preview")} />
            <div><strong>{src.split("/").at(-1)}</strong><small>{src.includes("hero") ? "1920 × 1080 · HERO" : "1200 × 1200 · PRODUCT"}</small><StatusTag tone="success">{text(locale, "使用中", "In use")}</StatusTag></div>
            <button aria-label={text(locale, "预览资源", "Preview asset")} onClick={() => preview(text(locale, "资源预览", "Asset preview"))}><Eye size={17} /></button>
          </article>
        ))}
      </div>
    </>
  );
}

function TranslationsDesign({ locale, preview }: { locale: Locale; preview: PreviewAction }) {
  const [selected, setSelected] = useState(0);
  const tasks = [
    ["Claude Pro", text(locale, "商品介绍", "Product description"), "Mia Tan"],
    [text(locale, "售后退款政策", "Refund policy"), text(locale, "政策正文", "Policy body"), text(locale, "未分配", "Unassigned")],
    [text(locale, "首页第 4 张轮播", "Hero story 04"), text(locale, "图片替代说明", "Image alt text"), "Mia Tan"],
  ];
  return (
    <>
      <PreviewToolbar summary={text(locale, "中文完整 · 英文 86%", "Chinese complete · English 86%")} action={text(locale, "扫描缺失内容", "Scan missing copy")} icon={ArrowsClockwise} onAction={() => preview(text(locale, "扫描缺失内容", "Scan missing copy"))} />
      <section className="design-language-progress">
        <div><span>{text(locale, "中文", "Chinese")}</span><strong>100%</strong><i><b style={{ width: "100%" }} /></i><small>{text(locale, "全部内容完整", "All content complete")}</small></div>
        <div><span>{text(locale, "英文", "English")}</span><strong>86%</strong><i><b style={{ width: "86%" }} /></i><small>{text(locale, "3 项需要完善", "3 items need work")}</small></div>
      </section>
      <div className="design-split">
        <section className="admin-panel design-list-panel">
          <div className="design-list-heading"><span>{text(locale, "内容", "Content")}</span><span>{text(locale, "缺失字段", "Missing field")}</span></div>
          {tasks.map((item, index) => (
            <button className={selected === index ? "is-selected" : ""} onClick={() => setSelected(index)} key={item[0]}>
              <span className="design-list-icon"><Translate size={19} /></span>
              <div><strong>{item[0]}</strong><small>{text(locale, "英文内容", "English content")}</small></div>
              <div><strong>{item[1]}</strong><small>{item[2]}</small></div>
              <CaretRight size={16} />
            </button>
          ))}
        </section>
        <aside className="admin-panel design-detail-panel">
          <span className="design-detail-icon"><Translate size={24} /></span>
          <small>{text(locale, "英文 · 待完善", "English · incomplete")}</small>
          <h2>{tasks[selected]![0]}</h2>
          <p>{text(locale, `缺少${tasks[selected]![1]}。完成后英文完整度将自动更新。`, `${tasks[selected]![1]} is missing. English completeness updates after saving.`)}</p>
          <dl><div><dt>{text(locale, "负责人", "Owner")}</dt><dd>{tasks[selected]![2]}</dd></div><div><dt>{text(locale, "回退规则", "Fallback")}</dt><dd>{text(locale, "隐藏未翻译内容", "Hide untranslated copy")}</dd></div></dl>
          <button className="admin-primary" onClick={() => preview(text(locale, "打开翻译编辑器", "Open translation editor"))}><PencilSimple size={17} />{text(locale, "打开编辑", "Open editor")}</button>
        </aside>
      </div>
    </>
  );
}

function NotificationsDesign({ locale, preview }: { locale: Locale; preview: PreviewAction }) {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [selected, setSelected] = useState(0);
  const items = [
    [text(locale, "新订单等待领取", "New order awaiting assignment"), "CB-260727-8K3P9M · OpenAI Codex · RM 89.00", Receipt, "new"],
    [text(locale, "Claude Pro 库存较低", "Claude Pro inventory is low"), text(locale, "可用库存仅余 3 件", "Only 3 units remain"), WarningCircle, "warning"],
    [text(locale, "邮件通知发送失败", "Email notification failed"), text(locale, "系统将在 5 分钟后重试", "Retry scheduled in 5 minutes"), EnvelopeSimple, "danger"],
    [text(locale, "法币汇率更新完成", "Fiat rates updated"), text(locale, "23 个币种均处于有效期", "23 currencies remain valid"), ArrowsClockwise, "success"],
  ] as const;
  const visible = filter === "unread" ? items.slice(0, 2) : items;
  const current = items[selected] ?? items[0];
  const CurrentIcon = current[2];
  return (
    <div className="design-notification-workbench">
      <section className="admin-panel design-notification-list">
        <div className="design-notification-tabs"><button className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>{text(locale, "全部", "All")}</button><button className={filter === "unread" ? "is-active" : ""} onClick={() => setFilter("unread")}>{text(locale, "未读 2", "Unread 2")}</button><button onClick={() => preview(text(locale, "全部已读", "Mark all read"))}><Check size={16} />{text(locale, "全部已读", "Mark read")}</button></div>
        {visible.map((item) => {
          const Icon = item[2];
          const index = items.indexOf(item);
          return <button className={selected === index ? "is-selected" : ""} onClick={() => setSelected(index)} key={item[0]}><span className={`design-list-icon is-${item[3]}`}><Icon size={19} /></span><div><strong>{item[0]}</strong><p>{item[1]}</p><small>{index === 0 ? text(locale, "刚刚", "Just now") : `${index * 12} ${text(locale, "分钟前", "min ago")}`}</small></div><CaretRight size={16} /></button>;
        })}
      </section>
      <aside className="admin-panel design-detail-panel">
        <span className={`design-detail-icon is-${current[3]}`}><CurrentIcon size={24} /></span>
        <small>TRACE-CB-NTF-{String(selected + 1).padStart(2, "0")}</small>
        <h2>{current[0]}</h2>
        <p>{text(locale, "通知正文、来源、关联记录与处理状态在同一详情面板中完成阅读和判断。", "Read the message, source, related record, and resolution state in one detail panel.")}</p>
        <dl><div><dt>{text(locale, "状态", "Status")}</dt><dd>{selected < 2 ? text(locale, "未读", "Unread") : text(locale, "已读", "Read")}</dd></div><div><dt>{text(locale, "渠道", "Channel")}</dt><dd>{text(locale, "站内通知", "In-app notification")}</dd></div></dl>
        <div className="design-detail-actions"><button onClick={() => preview(text(locale, "查看相关记录", "Open related record"))}>{text(locale, "相关记录", "Related record")}</button><button className="admin-primary" onClick={() => preview(text(locale, "标记已处理", "Mark resolved"))}><Check size={16} />{text(locale, "标记已处理", "Mark resolved")}</button></div>
      </aside>
    </div>
  );
}

function PaymentsDesign({ locale, preview }: { locale: Locale; preview: PreviewAction }) {
  const [selected, setSelected] = useState(0);
  const providers = [
    ["Stripe", text(locale, "银行卡 · Apple Pay · Google Pay", "Cards · Apple Pay · Google Pay"), text(locale, "仅测试", "Sandbox")],
    ["PayPal", text(locale, "PayPal 钱包 · 银行卡", "PayPal Wallet · Cards"), text(locale, "未配置", "Not configured")],
    ["Airwallex", text(locale, "亚太支付方式 · 外汇结算", "APAC methods · FX settlement"), text(locale, "未配置", "Not configured")],
  ];
  return (
    <>
      <section className="design-connection-hero admin-panel">
        <span><LockKey size={28} /></span>
        <div><small>{text(locale, "客户端收款状态", "STOREFRONT PAYMENT STATE")}</small><h2>{text(locale, "在线支付未启用", "Online payments are disabled")}</h2><p>{text(locale, "所有订单仍进入人工确认，不展示银行卡输入框。", "Orders remain in manual review and no card-entry fields appear.")}</p></div>
        <StatusTag tone="warning">{text(locale, "人工处理模式", "Manual mode")}</StatusTag>
        <button className="admin-primary" onClick={() => preview(text(locale, "正式启用流程", "Live enable flow"))}><ShieldCheck size={17} />{text(locale, "正式启用流程", "Live enable flow")}</button>
      </section>
      <div className="design-split">
        <section className="admin-panel design-list-panel">
          <div className="design-list-heading"><span>{text(locale, "支付提供商", "Payment providers")}</span><span>{text(locale, "覆盖范围", "Coverage")}</span></div>
          {providers.map((item, index) => <button className={selected === index ? "is-selected" : ""} onClick={() => setSelected(index)} key={item[0]}><span className="design-list-icon"><CurrencyCircleDollar size={19} /></span><div><strong>{item[0]}</strong><small>{item[2]}</small></div><div><strong>{item[1]}</strong><small>{index === 0 ? "•••• 4F8A" : "—"}</small></div><CaretRight size={16} /></button>)}
        </section>
        <aside className="admin-panel design-detail-panel">
          <span className="design-detail-icon"><PlugsConnected size={24} /></span>
          <small>{text(locale, "当前配置", "CURRENT CONFIGURATION")}</small>
          <h2>{providers[selected]![0]}</h2>
          <p>{text(locale, "密钥仅显示状态与末尾标识，真实值不会出现在管理页面。", "Credentials show only status and a suffix. Secret values never appear in the console.")}</p>
          <dl><div><dt>{text(locale, "运行模式", "Mode")}</dt><dd>{providers[selected]![2]}</dd></div><div><dt>Webhook</dt><dd>{selected === 0 ? text(locale, "签名验证正常", "Signature healthy") : text(locale, "未配置", "Not configured")}</dd></div><div><dt>{text(locale, "客户端", "Storefront")}</dt><dd>{text(locale, "关闭", "Off")}</dd></div></dl>
          <div className="design-detail-actions"><button onClick={() => preview(text(locale, "测试连接", "Test connection"))}><Pulse size={16} />{text(locale, "测试连接", "Test connection")}</button><button className="admin-primary" onClick={() => preview(text(locale, "申请正式启用", "Request live mode"))}><LockKey size={16} />{text(locale, "申请启用", "Request live")}</button></div>
        </aside>
      </div>
    </>
  );
}

function ReconciliationDesign({ locale, preview }: { locale: Locale; preview: PreviewAction }) {
  const rows = [
    ["STL-0727-018", "Stripe", "USD 1,248.20", text(locale, "完全匹配", "Matched"), "success"],
    ["STL-0727-017", "Stripe", "USD 894.10", text(locale, "差额 USD 12.00", "USD 12.00 variance"), "warning"],
    ["MAN-0727-041", text(locale, "人工处理", "Manual"), "MYR 287.00", text(locale, "等待复核", "Review pending"), "neutral"],
  ] as const;
  return (
    <>
      <PreviewToolbar summary={text(locale, "2 笔匹配 · 1 笔差异 · 1 笔人工复核", "2 matched · 1 variance · 1 manual review")} action={text(locale, "导出对账单", "Export statement")} icon={DownloadSimple} onAction={() => preview(text(locale, "导出对账单", "Export statement"))} />
      <div className="design-stats">
        <PreviewStat icon={CheckCircle} label={text(locale, "今日已结算", "Settled today")} value="USD 2,142.30" meta={text(locale, "32 笔交易", "32 transactions")} tone="green" />
        <PreviewStat icon={Clock} label={text(locale, "等待结算", "Pending settlement")} value="USD 381.72" meta={text(locale, "8 笔交易", "8 transactions")} />
        <PreviewStat icon={WarningCircle} label={text(locale, "需要复核", "Needs review")} value="1" meta={text(locale, "金额差异", "Amount variance")} tone="amber" />
      </div>
      <section className="admin-panel design-data-table is-settlements">
        <div className="design-data-head"><span>{text(locale, "批次", "Batch")}</span><span>{text(locale, "来源", "Source")}</span><span>{text(locale, "金额", "Amount")}</span><span>{text(locale, "结果", "Result")}</span><span>{text(locale, "操作", "Action")}</span></div>
        {rows.map(([id, source, amount, result, tone]) => <button className="design-data-row" key={id} onClick={() => preview(text(locale, "对账批次详情", "Settlement detail"))}><strong>{id}</strong><span>{source}</span><span>{amount}</span><StatusTag tone={tone}>{result}</StatusTag><ArrowRight size={16} /></button>)}
      </section>
    </>
  );
}

function TeamDesign({ locale, preview }: { locale: Locale; preview: PreviewAction }) {
  const [selected, setSelected] = useState(0);
  const members: Array<[string, string, string, string]> = [
    [text(locale, "王朝", "Wang Chao"), "owner@cloudbridge.test", text(locale, "超级管理员", "Super admin"), text(locale, "在线", "Online")],
    ["Mia Tan", "mia@cloudbridge.test", text(locale, "内容编辑", "Content editor"), text(locale, "在线", "Online")],
    ["Lin Cheng", "lin@cloudbridge.test", text(locale, "订单客服", "Order support"), text(locale, "在线", "Online")],
    [text(locale, "陈予", "Chen Yu"), "chen@cloudbridge.test", text(locale, "财务审核", "Finance reviewer"), text(locale, "离线", "Offline")],
  ];
  return (
    <>
      <PreviewToolbar summary={text(locale, "4 名员工 · 3 人在线", "4 members · 3 online")} action={text(locale, "邀请员工", "Invite member")} icon={UserPlus} onAction={() => preview(text(locale, "邀请员工", "Invite member"))} />
      <div className="design-split is-wide-list">
        <section className="admin-panel design-list-panel">
          <div className="design-list-heading"><span>{text(locale, "员工", "Member")}</span><span>{text(locale, "角色与状态", "Role & status")}</span></div>
          {members.map((item, index) => <button className={selected === index ? "is-selected" : ""} onClick={() => setSelected(index)} key={item[1]}><span className="design-avatar">{item[0][0]}</span><div><strong>{item[0]}</strong><small>{item[1]}</small></div><div><strong>{item[2]}</strong><small>{item[3]} · {text(locale, "2FA 已启用", "2FA enabled")}</small></div><CaretRight size={16} /></button>)}
        </section>
        <aside className="admin-panel design-detail-panel">
          <span className="design-avatar is-large">{members[selected]![0][0]}</span>
          <small>{members[selected]![2]}</small>
          <h2>{members[selected]![0]}</h2>
          <p>{members[selected]![1]}</p>
          <dl><div><dt>{text(locale, "数据范围", "Data scope")}</dt><dd>{selected === 0 ? text(locale, "全部数据", "All data") : text(locale, "所属工作组", "Assigned group")}</dd></div><div><dt>{text(locale, "当前会话", "Active sessions")}</dt><dd>{selected === 0 ? "2" : "1"}</dd></div><div><dt>{text(locale, "账号状态", "Account status")}</dt><dd>{text(locale, "正常", "Active")}</dd></div></dl>
          <div className="design-detail-actions"><button onClick={() => preview(text(locale, "查看会话", "View sessions"))}>{text(locale, "查看会话", "View sessions")}</button><button className="admin-primary" onClick={() => preview(text(locale, "编辑权限", "Edit access"))}>{text(locale, "编辑权限", "Edit access")}</button></div>
        </aside>
      </div>
    </>
  );
}

function RolesDesign({ locale, preview }: { locale: Locale; preview: PreviewAction }) {
  const [selected, setSelected] = useState(0);
  const roles = [
    [text(locale, "超级管理员", "Super admin"), text(locale, "所有权限与全部数据", "All permissions and data"), "1"],
    [text(locale, "运营管理员", "Operations manager"), text(locale, "商品、订单与人员调度", "Products, orders, and assignment"), "2"],
    [text(locale, "订单客服", "Order support"), text(locale, "被分配订单与联系方式", "Assigned orders and contacts"), "4"],
    [text(locale, "内容编辑", "Content editor"), text(locale, "商品、轮播与双语内容", "Products, hero, and bilingual copy"), "2"],
    [text(locale, "财务审核", "Finance reviewer"), text(locale, "付款、退款与金额", "Payments, refunds, and amounts"), "1"],
  ];
  const permissions = [text(locale, "查看订单", "View orders"), text(locale, "编辑商品", "Edit products"), text(locale, "查看联系方式", "Reveal contacts"), text(locale, "确认付款", "Confirm payment"), text(locale, "查看日志", "View logs")];
  return (
    <>
      <PreviewToolbar summary={text(locale, "5 个角色 · 按操作和数据范围授权", "5 roles · action and data scopes")} action={text(locale, "新建角色", "New role")} icon={Key} onAction={() => preview(text(locale, "新建角色", "New role"))} />
      <div className="design-role-layout">
        <section className="admin-panel design-role-list">{roles.map((role, index) => <button className={selected === index ? "is-selected" : ""} onClick={() => setSelected(index)} key={role[0]}><span>0{index + 1}</span><div><strong>{role[0]}</strong><small>{role[1]}</small></div><em><UsersThree size={15} />{role[2]}</em><CaretRight size={16} /></button>)}</section>
        <section className="admin-panel design-permission-panel">
          <div><small>{text(locale, "当前角色", "Selected role")}</small><h2>{roles[selected]![0]}</h2><p>{roles[selected]![1]}</p><button className="admin-primary" onClick={() => preview(text(locale, "编辑角色", "Edit role"))}>{text(locale, "编辑角色", "Edit role")}</button></div>
          <aside><span>{text(locale, "数据范围", "Data scope")}</span><strong>{selected === 0 ? text(locale, "全部数据", "All data") : text(locale, "按工作组", "Assigned group")}</strong></aside>
          {permissions.map((permission, index) => <article key={permission}><span>{permission}</span><em className={selected === 0 || index < 3 ? "is-allowed" : ""}>{selected === 0 || index < 3 ? text(locale, "允许", "Allowed") : text(locale, "不允许", "Denied")}</em></article>)}
        </section>
      </div>
    </>
  );
}

function SecurityEventsDesign({ locale, preview }: { locale: Locale; preview: PreviewAction }) {
  const events = [
    ["SEC-0727-1138", text(locale, "连续登录失败", "Repeated sign-in failures"), "203.0.113.42", text(locale, "已阻止", "Blocked"), "danger"],
    ["SEC-0727-1024", text(locale, "新设备登录", "New device sign-in"), "Kuala Lumpur · Safari", text(locale, "已确认", "Confirmed"), "success"],
    ["SEC-0726-2241", text(locale, "权限访问被拒绝", "Permission denied"), "roles.manage", text(locale, "已记录", "Recorded"), "warning"],
  ] as const;
  return (
    <>
      <div className="design-stats">
        <PreviewStat icon={ShieldCheck} label={text(locale, "安全评分", "Security score")} value="92 / 100" meta={text(locale, "保护状态良好", "Strong posture")} tone="green" />
        <PreviewStat icon={WarningCircle} label={text(locale, "24 小时事件", "Events in 24h")} value="8" meta={text(locale, "1 项需要复核", "1 needs review")} tone="amber" />
        <PreviewStat icon={LockKey} label={text(locale, "已阻止行为", "Blocked actions")} value="5" meta={text(locale, "均已写入审计", "All audited")} />
      </div>
      <PreviewToolbar summary={text(locale, "实时风险事件 · 最近更新 2 分钟前", "Live risk events · updated 2 min ago")} action={text(locale, "导出事件", "Export events")} icon={DownloadSimple} onAction={() => preview(text(locale, "导出安全事件", "Export security events"))} />
      <section className="admin-panel design-data-table is-events">
        <div className="design-data-head"><span>{text(locale, "事件编号", "Event ID")}</span><span>{text(locale, "事件", "Event")}</span><span>{text(locale, "来源", "Source")}</span><span>{text(locale, "结果", "Result")}</span><span>{text(locale, "操作", "Action")}</span></div>
        {events.map(([id, event, source, result, tone]) => <button className="design-data-row" onClick={() => preview(text(locale, "安全事件详情", "Security event detail"))} key={id}><strong>{id}</strong><span>{event}</span><code>{source}</code><StatusTag tone={tone}>{result}</StatusTag><ArrowRight size={16} /></button>)}
      </section>
    </>
  );
}

function DataSecurityDesign({ locale, preview }: { locale: Locale; preview: PreviewAction }) {
  const classes = [
    [text(locale, "公开内容", "Public content"), text(locale, "商品、政策、轮播", "Products, policies, hero"), Globe, "success"],
    [text(locale, "内部运营", "Internal operations"), text(locale, "库存、分配、备注", "Inventory, assignment, notes"), FileText, "success"],
    [text(locale, "个人信息", "Personal data"), text(locale, "联系方式、IP、设备", "Contacts, IP, device"), ShieldCheck, "warning"],
    [text(locale, "机密信息", "Secrets"), text(locale, "密钥、Token、数据库凭据", "Keys, tokens, DB credentials"), LockKey, "locked"],
  ] as const;
  return (
    <>
      <PreviewToolbar summary={text(locale, "4 个数据等级 · 3 条保留策略", "4 data classes · 3 retention policies")} action={text(locale, "策略检查", "Policy check")} icon={ShieldCheck} onAction={() => preview(text(locale, "数据策略检查", "Data policy check"))} />
      <div className="design-classification-grid">{classes.map(([title, body, Icon, tone]) => <article className="admin-panel" key={title}><span><Icon size={23} /></span><div><small>{text(locale, "数据等级", "DATA CLASS")}</small><h2>{title}</h2><p>{body}</p></div><StatusTag tone={tone}>{tone === "locked" ? text(locale, "受限", "Restricted") : text(locale, "已覆盖", "Covered")}</StatusTag></article>)}</div>
      <section className="admin-panel design-data-table is-retention">
        <div className="design-data-head"><span>{text(locale, "数据类型", "Data type")}</span><span>{text(locale, "保存期限", "Retention")}</span><span>{text(locale, "保护方式", "Protection")}</span><span>{text(locale, "责任方", "Owner")}</span><span>{text(locale, "操作", "Action")}</span></div>
        {[
          [text(locale, "未完成订单联系方式", "Open-order contacts"), text(locale, "订单关闭后 30 天", "30 days after closure"), text(locale, "字段加密", "Field encryption"), text(locale, "订单运营", "Order ops")],
          [text(locale, "安全审计事件", "Security audit events"), text(locale, "365 天", "365 days"), text(locale, "不可变记录", "Immutable records"), text(locale, "安全团队", "Security")],
          [text(locale, "系统运行日志", "System runtime logs"), text(locale, "90 天", "90 days"), text(locale, "脱敏与访问控制", "Redaction & access control"), text(locale, "平台运维", "Platform ops")],
        ].map((row) => <button className="design-data-row" key={row[0]} onClick={() => preview(text(locale, "保留策略详情", "Retention policy detail"))}><strong>{row[0]}</strong><span>{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span><ArrowRight size={16} /></button>)}
      </section>
    </>
  );
}

function SecretsDesign({ locale, preview }: { locale: Locale; preview: PreviewAction }) {
  const [selected, setSelected] = useState(0);
  const secrets = [
    ["STRIPE_SIGNING_SECRET", "Webhook", "•••• 8D2C", text(locale, "14 天前轮换", "Rotated 14 days ago")],
    ["DATABASE_APP_PASSWORD", "Database", "•••• C91F", text(locale, "32 天前轮换", "Rotated 32 days ago")],
    ["CONTACT_ENCRYPTION_KEY", text(locale, "数据保护", "Data protection"), "•••• 71AE", text(locale, "71 天前轮换", "Rotated 71 days ago")],
    ["TELEGRAM_BOT_TOKEN", "Telegram", "—", text(locale, "未配置", "Not configured")],
  ];
  return (
    <>
      <PreviewToolbar summary={text(locale, "3 个已配置 · 1 个未配置 · 无明文显示", "3 configured · 1 missing · no plaintext shown")} action={text(locale, "新增机密", "New secret")} icon={Key} onAction={() => preview(text(locale, "新增机密", "New secret"))} />
      <div className="design-split">
        <section className="admin-panel design-list-panel">
          <div className="design-list-heading"><span>{text(locale, "机密名称", "Secret")}</span><span>{text(locale, "范围与状态", "Scope & state")}</span></div>
          {secrets.map((item, index) => <button className={selected === index ? "is-selected" : ""} onClick={() => setSelected(index)} key={item[0]}><span className={`design-list-icon${index === 3 ? " is-warning" : ""}`}><Key size={19} /></span><div><strong>{item[0]}</strong><small>{item[2]}</small></div><div><strong>{item[1]}</strong><small>{item[3]}</small></div><CaretRight size={16} /></button>)}
        </section>
        <aside className="admin-panel design-detail-panel">
          <span className="design-detail-icon is-locked"><LockKey size={24} /></span>
          <small>{text(locale, "机密状态", "SECRET STATUS")}</small>
          <h2>{secrets[selected]![0]}</h2>
          <p>{text(locale, "管理后台只展示用途、状态和末尾标识，不提供查看完整密钥的入口。", "The console shows purpose, status, and a suffix only. It never offers a reveal-full-secret action.")}</p>
          <dl><div><dt>{text(locale, "使用范围", "Scope")}</dt><dd>{secrets[selected]![1]}</dd></div><div><dt>{text(locale, "末尾标识", "Suffix")}</dt><dd>{secrets[selected]![2]}</dd></div><div><dt>{text(locale, "轮换状态", "Rotation")}</dt><dd>{secrets[selected]![3]}</dd></div></dl>
          <button className="admin-primary" onClick={() => preview(text(locale, "轮换机密", "Rotate secret"))}><ArrowsClockwise size={17} />{text(locale, "轮换机密", "Rotate secret")}</button>
        </aside>
      </div>
    </>
  );
}

function BackupsDesign({ locale, preview }: { locale: Locale; preview: PreviewAction }) {
  const rows = [
    ["BKP-20260728-0400", text(locale, "自动完整备份", "Automatic full backup"), "1.84 GB", "04:00", text(locale, "可恢复", "Restorable"), "success"],
    ["BKP-20260727-0400", text(locale, "自动完整备份", "Automatic full backup"), "1.81 GB", text(locale, "昨天", "Yesterday"), text(locale, "已验证", "Verified"), "success"],
    ["BKP-20260726-1605", text(locale, "部署前快照", "Pre-deploy snapshot"), "1.79 GB", "Jul 26", text(locale, "可恢复", "Restorable"), "success"],
  ] as const;
  return (
    <>
      <div className="design-stats">
        <PreviewStat icon={HardDrives} label={text(locale, "最近备份", "Latest backup")} value="04:00" meta={text(locale, "完整备份成功", "Full backup complete")} tone="green" />
        <PreviewStat icon={Archive} label={text(locale, "保留策略", "Retention")} value="30 days" meta={text(locale, "每日 1 份", "1 snapshot daily")} />
        <PreviewStat icon={Clock} label={text(locale, "恢复目标", "Recovery target")} value="< 30 min" meta={text(locale, "最近演练 21 分钟", "Last drill: 21 min")} tone="blue" />
      </div>
      <PreviewToolbar summary={text(locale, "备份存储正常 · 最近验证 6 小时前", "Backup storage healthy · verified 6h ago")} action={text(locale, "立即创建快照", "Create snapshot")} icon={CloudArrowUp} onAction={() => preview(text(locale, "立即创建快照", "Create snapshot"))} />
      <div className="design-two-column">
        <section className="admin-panel design-data-table is-backups">
          <div className="design-data-head"><span>{text(locale, "备份编号", "Backup ID")}</span><span>{text(locale, "类型", "Type")}</span><span>{text(locale, "大小", "Size")}</span><span>{text(locale, "时间", "Time")}</span><span>{text(locale, "状态", "Status")}</span></div>
          {rows.map(([id, type, size, time, status, tone]) => <button className="design-data-row" key={id} onClick={() => preview(text(locale, "备份详情", "Backup detail"))}><strong>{id}</strong><span>{type}</span><span>{size}</span><time>{time}</time><StatusTag tone={tone}>{status}</StatusTag></button>)}
        </section>
        <aside className="admin-panel design-restore-card">
          <span><ArrowsClockwise size={25} /></span><small>{text(locale, "恢复演练", "RESTORE DRILL")}</small><h2>{text(locale, "先验证，再允许恢复", "Verify before restore")}</h2><p>{text(locale, "恢复流程先在隔离环境验证完整性，不直接覆盖当前数据库。", "The restore flow validates integrity in isolation before it can affect the active database.")}</p>
          <dl><div><dt>{text(locale, "最近演练", "Last drill")}</dt><dd>2026-07-21</dd></div><div><dt>{text(locale, "恢复耗时", "Restore time")}</dt><dd>21m 48s</dd></div><div><dt>{text(locale, "校验结果", "Integrity")}</dt><dd>{text(locale, "全部通过", "Passed")}</dd></div></dl>
          <button className="admin-primary" onClick={() => preview(text(locale, "开始恢复演练", "Start restore drill"))}><ShieldCheck size={17} />{text(locale, "开始恢复演练", "Start restore drill")}</button>
        </aside>
      </div>
    </>
  );
}

function IntegrationsDesign({ locale, preview }: { locale: Locale; preview: PreviewAction }) {
  const services: Array<[string, string, IconComponent, "success" | "warning" | "neutral"]> = [
    [text(locale, "数据库", "Database"), text(locale, "主数据服务 · 99.99%", "Primary data · 99.99%"), Database, "success"],
    [text(locale, "对象存储", "Object storage"), text(locale, "图片与媒体资源", "Images and media"), CloudArrowUp, "success"],
    [text(locale, "邮件服务", "Email service"), text(locale, "2 个通知等待重试", "2 deliveries retrying"), EnvelopeSimple, "warning"],
    [text(locale, "汇率服务", "Rate provider"), text(locale, "每 30 分钟同步", "Refreshes every 30 min"), ArrowsClockwise, "success"],
    [text(locale, "支付平台", "Payment platform"), text(locale, "仅测试配置", "Sandbox only"), CurrencyCircleDollar, "neutral"],
    ["Telegram", text(locale, "机器人尚未连接", "Bot not connected"), TelegramLogo, "neutral"],
  ];
  const jobs: Array<[string, string, string]> = [
    [text(locale, "法币汇率更新", "Fiat rate refresh"), "11:30", text(locale, "已完成", "Completed")],
    [text(locale, "过期订单释放库存", "Release expired inventory"), "11:25", text(locale, "已完成", "Completed")],
    [text(locale, "邮件通知重试", "Retry email notifications"), "11:20", text(locale, "待重试", "Retrying")],
    [text(locale, "每日数据备份", "Daily database backup"), "04:00", text(locale, "已完成", "Completed")],
  ];
  return (
    <>
      <PreviewToolbar summary={text(locale, "3 项正常 · 1 项降级 · 2 项未连接", "3 healthy · 1 degraded · 2 not connected")} action={text(locale, "健康检查", "Health check")} icon={Pulse} onAction={() => preview(text(locale, "系统健康检查", "System health check"))} />
      <div className="design-service-grid">{services.map(([title, body, Icon, tone]) => <article className="admin-panel" key={title}><span><Icon size={23} /></span><div><h2>{title}</h2><p>{body}</p></div><StatusTag tone={tone}>{tone === "success" ? text(locale, "正常", "Healthy") : tone === "warning" ? text(locale, "降级", "Degraded") : text(locale, "未连接", "Not connected")}</StatusTag><button onClick={() => preview(text(locale, `${title}详情`, `${title} detail`))}><CaretRight size={16} /></button></article>)}</div>
      <section className="admin-panel design-job-list">
        <div className="panel-heading"><h2>{text(locale, "后台任务", "Background jobs")}</h2></div>
        {jobs.map(([title, time, state], index) => <div key={title}><span className={index === 2 ? "is-warning" : ""}><Pulse size={17} /></span><div><strong>{title}</strong><small>TRACE-CB-JOB-{time.replace(":", "")}</small></div><time>{time}</time><StatusTag tone={index === 2 ? "warning" : "success"}>{state}</StatusTag></div>)}
      </section>
    </>
  );
}
