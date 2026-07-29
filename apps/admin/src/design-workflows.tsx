import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  LockKey,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import type { Page } from "./admin-model";
import { Dialog } from "./admin-ui";
import type { Locale } from "./api";

type LocalizedText = {
  zh: string;
  en: string;
};

type WorkflowField = {
  label: LocalizedText;
  value: LocalizedText;
  kind?: "input" | "select" | "textarea";
};

type WorkflowDefinition = {
  title: LocalizedText;
  summary: LocalizedText;
  steps: readonly [LocalizedText, LocalizedText, LocalizedText];
  fields: readonly WorkflowField[];
  checks: readonly LocalizedText[];
  review: readonly (readonly [LocalizedText, LocalizedText])[];
  caution: LocalizedText;
};

export type DesignWorkflowId =
  | Page
  | "order-workbench"
  | "account-center"
  | "inventory-center"
  | "dashboard-insights";

type SurfaceState =
  | "ready"
  | "initial-loading"
  | "empty"
  | "offline"
  | "error"
  | "forbidden"
  | "conflict";

const copy = (zh: string, en: string): LocalizedText => ({ zh, en });
const field = (
  zh: string,
  en: string,
  valueZh: string,
  valueEn = valueZh,
  kind: WorkflowField["kind"] = "input",
): WorkflowField => ({
  label: copy(zh, en),
  value: copy(valueZh, valueEn),
  kind,
});

const workflow = (
  title: LocalizedText,
  summary: LocalizedText,
  steps: WorkflowDefinition["steps"],
  fields: WorkflowDefinition["fields"],
  checks: WorkflowDefinition["checks"],
  review: WorkflowDefinition["review"],
  caution: LocalizedText,
): WorkflowDefinition => ({ title, summary, steps, fields, checks, review, caution });

const commonReview = [
  [copy("服务器写入", "Server write"), copy("不会执行", "Not performed")],
  [copy("敏感数据", "Sensitive data"), copy("仅显示脱敏示例", "Masked examples only")],
  [copy("交付状态", "Delivery state"), copy("界面设计预览", "Interface design preview")],
] as const;

const workflowDefinitions: Record<string, WorkflowDefinition> = {
  "order-workbench": workflow(
    copy("订单处理工作台", "Order operations workbench"),
    copy("集中查看订单、负责人、沟通记录、库存预留和状态时间线。", "Review the order, owner, communication, inventory reservation, and status timeline in one place."),
    [copy("订单资料", "Order details"), copy("处理记录", "Operations"), copy("确认影响", "Impact review")],
    [
      field("负责人", "Owner", "Mia Tan"),
      field("处理优先级", "Priority", "普通", "Normal", "select"),
      field("内部备注", "Internal note", "等待客户确认服务时间", "Awaiting service-time confirmation", "textarea"),
    ],
    [
      copy("联系方式查看必须经过近期认证并留下审计记录", "Contact reveal requires recent reauthentication and an audit event"),
      copy("订单状态只能沿允许的状态路径前进", "Order status follows approved transitions only"),
      copy("预留到期会提示释放库存，不在界面中伪造执行结果", "Expired reservations surface a release task without faking execution"),
    ],
    commonReview,
    copy("付款、退款、争议和联系方式属于敏感操作，最终实现必须等待服务器确认。", "Payment, refund, dispute, and contact actions must wait for server confirmation in the final implementation."),
  ),
  "dashboard-insights": workflow(
    copy("运营提醒与下钻", "Operations alerts and drill-down"),
    copy("让管理员从工作台直接发现临期订单、低库存、通知失败和安全风险。", "Surface expiring orders, low inventory, failed notifications, and security risks directly from the workspace."),
    [copy("选择指标", "Choose signal"), copy("查看明细", "Inspect details"), copy("进入任务", "Open task")],
    [
      field("时间范围", "Time range", "最近 24 小时", "Last 24 hours", "select"),
      field("工作组", "Team", "全部运营人员", "All operators", "select"),
      field("提醒阈值", "Alert threshold", "订单剩余 15 分钟", "Order expires in 15 minutes"),
    ],
    [
      copy("每张提醒卡都能下钻到唯一对应页面", "Every alert drills into one owning page"),
      copy("金额、订单和安全指标不混用同一种视觉语义", "Money, order, and security signals use distinct visual semantics"),
      copy("无异常时显示明确的健康状态而不是空白", "Healthy periods show a clear all-good state instead of blank space"),
    ],
    commonReview,
    copy("工作台用于发现和分流任务，不在卡片内直接执行高风险操作。", "The workspace discovers and routes tasks; it does not execute high-risk actions inside metric cards."),
  ),
  "inventory-center": workflow(
    copy("商品库存与发布", "Product inventory and publishing"),
    copy("把库存调整、媒体选择、双语内容和发布影响放在同一商品工作流中。", "Combine inventory adjustments, media selection, bilingual content, and publishing impact in one product workflow."),
    [copy("库存与媒体", "Stock and media"), copy("内容检查", "Content review"), copy("发布预览", "Publish preview")],
    [
      field("库存调整", "Stock adjustment", "+10"),
      field("调整原因", "Adjustment reason", "供应补充", "Supply replenishment", "select"),
      field("图片资源", "Media asset", "product-codex.webp"),
      field("发布说明", "Publishing note", "更新库存与展示图片", "Update inventory and product image", "textarea"),
    ],
    [
      copy("每次库存调整都展示调整前后数量和操作人", "Every stock adjustment shows before/after quantity and operator"),
      copy("替换媒体前显示所有使用位置", "Media replacement lists every current usage"),
      copy("中英文缺失时禁止进入发布确认", "Publishing is blocked while Chinese or English content is incomplete"),
    ],
    commonReview,
    copy("价格、库存和上下架会影响新订单，最终保存必须显示影响范围并由服务器确认。", "Price, inventory, and availability affect new orders and require server-confirmed impact review."),
  ),
  "account-center": workflow(
    copy("管理员账户中心", "Administrator account center"),
    copy("统一管理个人资料、密码、活动会话和默认关闭的 TOTP。", "Manage profile, password, active sessions, and optional TOTP in one place."),
    [copy("个人资料", "Profile"), copy("登录安全", "Sign-in security"), copy("活动会话", "Active sessions")],
    [
      field("显示名称", "Display name", "CloudBridge Admin"),
      field("管理员邮箱", "Admin email", "admin@cloudbridge.test"),
      field("当前密码", "Current password", "", "", "input"),
    ],
    [
      copy("修改密码后提供撤销其他会话的明确选择", "Password changes offer an explicit option to revoke other sessions"),
      copy("TOTP 默认关闭，只保留开启、验证和关闭流程", "TOTP stays off by default with only enable, verify, and disable flows"),
      copy("会话列表分列显示设备、位置、创建时间和最近活动", "Sessions separate device, location, creation, and recent activity into columns"),
    ],
    commonReview,
    copy("账户安全设计不包含 Passkey、指纹或其他登录方式。", "Account security intentionally excludes passkeys, biometrics, and other sign-in methods."),
  ),
  categories: workflow(
    copy("分类影响与排序", "Category impact and ordering"),
    copy("在调整双语名称、可见性和顺序前检查受影响商品。", "Review affected products before changing bilingual names, visibility, or order."),
    [copy("分类资料", "Category details"), copy("商品影响", "Product impact"), copy("排序预览", "Order preview")],
    [
      field("中文名称", "Chinese name", "编程开发"),
      field("英文名称", "English name", "Development"),
      field("显示状态", "Visibility", "启用", "Active", "select"),
      field("排序位置", "Order position", "02"),
    ],
    [
      copy("停用或归档前列出全部关联商品", "List every related product before deactivation or archive"),
      copy("拖动排序同时提供键盘上下移动方式", "Drag ordering includes equivalent keyboard move controls"),
      copy("双语名称完整后才能进入影响确认", "Impact review requires complete bilingual names"),
    ],
    commonReview,
    copy("分类影响预览不会移动商品、隐藏分类或改变排序。", "Category impact preview does not move products, hide categories, or change ordering."),
  ),
  currencies: workflow(
    copy("币种与汇率历史", "Currency and exchange-rate history"),
    copy("设计币种启停、排序、汇率来源、有效时间和过期提醒。", "Design currency activation, ordering, rate source, effective time, and staleness alerts."),
    [copy("币种资料", "Currency details"), copy("汇率历史", "Rate history"), copy("新订单影响", "New-order impact")],
    [
      field("币种代码", "Currency code", "USD"),
      field("汇率来源", "Rate source", "管理员手动", "Admin manual", "select"),
      field("生效时间", "Effective time", "立即生效", "Effective now", "select"),
      field("更新原因", "Update reason", "同步最新人工报价", "Align with the latest manual quote", "textarea"),
    ],
    [
      copy("历史记录分列显示汇率、来源、生效时间和操作人", "Rate history separates value, source, effective time, and operator"),
      copy("过期汇率在客户端继续使用前提供明确告警", "Stale rates surface a clear warning before storefront use"),
      copy("启停币种前显示现有商品和未完成订单影响", "Activation changes preview affected products and open orders"),
    ],
    commonReview,
    copy("汇率历史预览不会更新报价或影响任何新订单金额。", "Rate-history preview does not update quotes or affect any new-order amount."),
  ),
  security: workflow(
    copy("登录安全与会话", "Sign-in security and sessions"),
    copy("在现有可选 TOTP 基础上补齐密码、会话、锁定与安全说明。", "Extend optional TOTP with password, session, lockout, and security guidance."),
    [copy("登录保护", "Sign-in protection"), copy("活动会话", "Active sessions"), copy("敏感确认", "Sensitive review")],
    [
      field("当前方式", "Current method", "邮箱与密码", "Email and password", "select"),
      field("TOTP 状态", "TOTP status", "默认关闭", "Off by default", "select"),
      field("会话策略", "Session policy", "8 小时滑动过期", "8-hour sliding expiry"),
    ],
    [
      copy("只保留密码登录与可选 TOTP，不出现其他登录方式", "Keep password sign-in and optional TOTP only"),
      copy("会话列表支持识别当前会话和撤销其他会话", "Sessions identify the current session and allow revoking others"),
      copy("锁定、解锁和关闭 TOTP 都记录审计事件", "Lock, unlock, and TOTP disable actions produce audit events"),
    ],
    commonReview,
    copy("安全流程预览不会关闭 TOTP、修改密码、解锁账号或撤销会话。", "Security preview does not disable TOTP, change passwords, unlock accounts, or revoke sessions."),
  ),
  logs: workflow(
    copy("审计日志详情", "Audit log detail"),
    copy("查看操作人、请求、目标、前后差异和关联安全事件。", "Inspect actor, request, target, before/after differences, and linked security events."),
    [copy("筛选事件", "Filter events"), copy("查看差异", "Inspect diff"), copy("导出范围", "Export scope")],
    [
      field("事件范围", "Event scope", "最近 24 小时", "Last 24 hours", "select"),
      field("操作类型", "Action type", "全部敏感操作", "All sensitive actions", "select"),
      field("导出原因", "Export reason", "内部安全复核", "Internal security review", "textarea"),
    ],
    [
      copy("请求编号、事件编号、目标和时间各占独立字段", "Request ID, event ID, target, and time use separate fields"),
      copy("详情并排显示变更前、变更后与操作理由", "Detail compares before, after, and action reason"),
      copy("导出遵循权限、时间范围和数据脱敏规则", "Export follows permissions, time scope, and masking rules"),
    ],
    commonReview,
    copy("筛选、详情和导出不会读取额外敏感字段或生成真实文件。", "Filters, detail, and export do not reveal extra sensitive fields or create a real file."),
  ),
  disputes: workflow(
    copy("退款与争议案件", "Refund and dispute case"),
    copy("复核客户材料、沟通记录、金额与处理期限。", "Review customer evidence, communication history, value, and deadlines."),
    [copy("案件资料", "Case details"), copy("证据复核", "Evidence review"), copy("双人确认", "Dual approval")],
    [
      field("案件类型", "Case type", "未收到服务", "Service not received", "select"),
      field("负责人", "Owner", "Lin Cheng"),
      field("处理意见", "Resolution note", "等待补充服务记录", "Awaiting service evidence", "textarea"),
    ],
    [
      copy("退款金额与原订单快照同时显示", "Refund value appears beside the original order snapshot"),
      copy("证据、沟通与内部备注使用独立时间线", "Evidence, communication, and internal notes use separate timelines"),
      copy("敏感结论需要两位不同管理员确认", "Sensitive resolutions require two different administrators"),
    ],
    commonReview,
    copy("案件预览不会创建退款、扣款或争议结果。", "The case preview never creates a refund, charge, or dispute outcome."),
  ),
  media: workflow(
    copy("媒体资源管理", "Media asset management"),
    copy("上传、检查、替换并追踪图片在客户端的使用位置。", "Upload, inspect, replace, and trace storefront asset usage."),
    [copy("文件检查", "File check"), copy("使用位置", "Usage review"), copy("替换确认", "Replacement review")],
    [
      field("文件名称", "File name", "hero-codex.webp"),
      field("资源类型", "Asset type", "首页轮播", "Hero", "select"),
      field("替代说明", "Alternative text", "CloudBridge Codex 服务视觉", "CloudBridge Codex service visual", "textarea"),
    ],
    [
      copy("显示尺寸、比例、文件大小和优化状态", "Show dimensions, ratio, file size, and optimization state"),
      copy("使用中的资源不能直接删除", "Assets in use cannot be deleted directly"),
      copy("替换前列出全部受影响页面和语言", "Replacement lists every affected page and locale"),
    ],
    commonReview,
    copy("上传、删除和替换均为本地界面预览。", "Upload, deletion, and replacement remain local interface previews."),
  ),
  translations: workflow(
    copy("双语内容工作台", "Bilingual content workbench"),
    copy("集中发现缺失字段、编辑译文并完成发布前检查。", "Find missing fields, edit translations, and complete pre-publish review."),
    [copy("选择内容", "Choose content"), copy("编辑译文", "Edit translation"), copy("完整度检查", "Completeness check")],
    [
      field("内容类型", "Content type", "商品介绍", "Product description", "select"),
      field("源语言内容", "Source content", "为开发团队提供完整的 AI 编码工作流。", "A complete AI coding workflow for development teams.", "textarea"),
      field("英文译文", "English translation", "A complete AI coding workflow for development teams.", "A complete AI coding workflow for development teams.", "textarea"),
    ],
    [
      copy("缺失内容按页面和字段定位", "Missing copy is grouped by page and field"),
      copy("编辑器并排显示源文与译文", "The editor presents source and translation side by side"),
      copy("未翻译内容遵循隐藏规则而不跨语言回退", "Untranslated content follows hide rules without cross-locale fallback"),
    ],
    commonReview,
    copy("完成度变化仅用于设计演示，不修改真实内容。", "Completeness changes are design-only and do not modify live copy."),
  ),
  notifications: workflow(
    copy("通知投递工作流", "Notification delivery workflow"),
    copy("设计通知模板、接收范围、投递记录和失败重试。", "Design templates, recipients, delivery history, and failure retry."),
    [copy("事件与模板", "Event and template"), copy("接收范围", "Recipients"), copy("投递检查", "Delivery review")],
    [
      field("通知事件", "Notification event", "新订单创建", "New order created", "select"),
      field("通知渠道", "Delivery channel", "站内通知", "In-app notification", "select"),
      field("摘要模板", "Summary template", "新订单 {{orderNumber}} 等待处理", "New order {{orderNumber}} is awaiting action", "textarea"),
    ],
    [
      copy("模板预览只使用脱敏订单示例", "Template previews use masked order examples only"),
      copy("投递记录显示渠道、接收组、时间和结果", "Delivery history separates channel, group, time, and result"),
      copy("失败项提供重试规则和最终失败状态", "Failures expose retry policy and terminal failure state"),
    ],
    commonReview,
    copy("发送、全部已读和重试均不会调用真实通知服务。", "Send, mark-read, and retry actions never call a live notification service."),
  ),
  "telegram-bot": workflow(
    copy("Telegram 机器人连接", "Telegram bot connection"),
    copy("设计机器人授权、接收群组、事件范围和脱敏消息预览。", "Design bot authorization, recipient groups, event scope, and masked message preview."),
    [copy("服务器凭证", "Server credential"), copy("群组与权限", "Group and access"), copy("消息测试", "Message test")],
    [
      field("机器人状态", "Bot status", "尚未连接", "Not connected", "select"),
      field("接收群组", "Recipient group", "订单运营组", "Order operations group"),
      field("通知事件", "Notification events", "新订单、低库存", "New order, low inventory", "textarea"),
    ],
    [
      copy("Bot Token 只显示掩码和服务器保存状态", "The bot token shows only a mask and server-side status"),
      copy("订单消息不包含完整联系方式", "Order messages never include full contact details"),
      copy("测试结果持续标注为模拟直到后端接通", "Test results stay labeled simulated until the backend is connected"),
    ],
    commonReview,
    copy("本预览不会授权机器人、读取群组或发送 Telegram 消息。", "This preview does not authorize a bot, read groups, or send Telegram messages."),
  ),
  payments: workflow(
    copy("人工收款记录", "Manual payment record"),
    copy("在不收集卡信息的前提下记录人工付款凭证与复核状态。", "Record manual payment evidence and review state without collecting card data."),
    [copy("付款资料", "Payment details"), copy("凭证复核", "Evidence review"), copy("状态确认", "Status review")],
    [
      field("付款方式", "Payment method", "人工银行转账", "Manual bank transfer", "select"),
      field("参考编号", "Reference number", "BANK-829104"),
      field("复核备注", "Review note", "金额与订单一致", "Amount matches order", "textarea"),
    ],
    [
      copy("不出现银行卡号、CVV 或客户支付密码字段", "No card number, CVV, or customer payment password fields"),
      copy("付款凭证与订单金额快照并排复核", "Payment evidence is reviewed beside the order amount snapshot"),
      copy("确认付款必须由具备财务权限的管理员执行", "Payment confirmation requires finance permission"),
    ],
    commonReview,
    copy("付款确认仅为界面状态，不会改变订单或资金状态。", "Payment confirmation is an interface state and does not change order or funds."),
  ),
  reconciliation: workflow(
    copy("支付对账复核", "Payment reconciliation review"),
    copy("导入结算记录、自动匹配订单并处理金额差异。", "Import settlements, match orders, and resolve amount variances."),
    [copy("导入批次", "Import batch"), copy("匹配结果", "Match results"), copy("差异处理", "Variance review")],
    [
      field("结算批次", "Settlement batch", "SET-2026-07-28"),
      field("匹配规则", "Matching rule", "订单号与金额", "Order number and amount", "select"),
      field("差异说明", "Variance note", "等待人工核对银行记录", "Awaiting manual bank review", "textarea"),
    ],
    [
      copy("匹配、差异和未找到订单使用独立状态", "Matched, variance, and missing-order states stay distinct"),
      copy("导出文件标注币种与数据时间范围", "Exports identify currency and data time range"),
      copy("差异处理保留原值、建议值和操作理由", "Variance resolution retains original value, proposed value, and reason"),
    ],
    commonReview,
    copy("导入、匹配和导出仅展示交互，不处理真实结算数据。", "Import, matching, and export demonstrate interaction only and do not process settlement data."),
  ),
  team: workflow(
    copy("成员账户生命周期", "Team member lifecycle"),
    copy("设计邀请、启用、锁定、停用、数据范围和会话管理。", "Design invite, activation, lock, disable, data scope, and session management."),
    [copy("成员资料", "Member details"), copy("角色与范围", "Role and scope"), copy("安全确认", "Security review")],
    [
      field("管理员邮箱", "Admin email", "operator@cloudbridge.test"),
      field("显示名称", "Display name", "Order Operator"),
      field("角色", "Role", "订单客服", "Order support", "select"),
      field("数据范围", "Data scope", "被分配订单", "Assigned orders", "select"),
    ],
    [
      copy("邀请、启用、停用和锁定状态清晰区分", "Invited, active, disabled, and locked states remain distinct"),
      copy("停用成员前显示未完成订单和活动会话", "Disabling a member reveals open orders and active sessions"),
      copy("撤销会话与重置 TOTP 均要求高权限确认", "Session revocation and TOTP reset require elevated confirmation"),
    ],
    commonReview,
    copy("本流程不会邀请、停用、解锁账户或撤销真实会话。", "This flow does not invite, disable, unlock accounts, or revoke real sessions."),
  ),
  roles: workflow(
    copy("角色权限编辑", "Role permission editing"),
    copy("按操作与数据范围配置角色，并预览受影响成员。", "Configure roles by action and data scope, then review affected members."),
    [copy("角色资料", "Role details"), copy("权限矩阵", "Permission matrix"), copy("成员影响", "Member impact")],
    [
      field("角色名称", "Role name", "订单客服", "Order support"),
      field("角色说明", "Description", "处理被分配订单与客户联系", "Manage assigned orders and customer contact", "textarea"),
      field("数据范围", "Data scope", "被分配订单", "Assigned orders", "select"),
    ],
    [
      copy("权限按查看、编辑、敏感操作和管理分组", "Permissions group read, write, sensitive, and administrative actions"),
      copy("危险权限展示原因输入和影响成员数", "Dangerous permissions show reason input and affected member count"),
      copy("超级管理员角色不可被误删或失去全部权限", "The super-admin role cannot be accidentally deleted or stripped"),
    ],
    commonReview,
    copy("权限开关只改变本地预览状态，不会改变任何服务器授权。", "Permission toggles affect local preview state only and never change server authorization."),
  ),
  "security-events": workflow(
    copy("安全事件处置", "Security event response"),
    copy("查看风险证据、关联账号、处置动作和审计链路。", "Inspect risk evidence, related accounts, response actions, and audit trail."),
    [copy("事件证据", "Event evidence"), copy("风险分级", "Risk triage"), copy("处置方案", "Response plan")],
    [
      field("风险等级", "Severity", "中风险", "Medium", "select"),
      field("负责人", "Owner", "Security Admin"),
      field("处置备注", "Response note", "复核登录来源并撤销异常会话", "Review sign-in source and revoke the suspicious session", "textarea"),
    ],
    [
      copy("事件、账号、请求和追踪编号分列展示", "Event, account, request, and trace IDs use separate columns"),
      copy("阻止、观察和误报使用不同结案状态", "Blocked, monitored, and false-positive outcomes stay distinct"),
      copy("会话撤销和账号锁定需要再次确认", "Session revocation and account locking require confirmation"),
    ],
    commonReview,
    copy("处置动作不会锁定账户、撤销会话或修改安全策略。", "Response actions do not lock accounts, revoke sessions, or change security policy."),
  ),
  "data-security": workflow(
    copy("数据分类与保留", "Data classification and retention"),
    copy("设计数据等级、访问范围、保留期限和删除审批。", "Design data classes, access scopes, retention periods, and deletion approval."),
    [copy("数据分类", "Classification"), copy("保留策略", "Retention policy"), copy("审批影响", "Approval impact")],
    [
      field("数据类型", "Data type", "客户联系方式", "Customer contact", "select"),
      field("保留期限", "Retention period", "订单完成后 180 天", "180 days after completion"),
      field("访问范围", "Access scope", "订单客服与安全管理员", "Order support and security administrators", "textarea"),
    ],
    [
      copy("每类数据显示存储位置、加密和访问角色", "Every class shows storage, encryption, and authorized roles"),
      copy("策略变更预览受影响记录与未来生效时间", "Policy changes preview affected records and future effective time"),
      copy("删除流程包含暂停、复核和不可逆确认", "Deletion includes hold, review, and irreversible confirmation"),
    ],
    commonReview,
    copy("策略检查不会删除、移动或重新分类真实数据。", "Policy checks do not delete, move, or reclassify real data."),
  ),
  secrets: workflow(
    copy("密钥与机密轮换", "Secret and key rotation"),
    copy("仅展示机密元数据、版本、使用服务和轮换状态。", "Show secret metadata, version, consuming services, and rotation state only."),
    [copy("机密元数据", "Secret metadata"), copy("使用范围", "Usage scope"), copy("轮换计划", "Rotation plan")],
    [
      field("机密标识", "Secret identifier", "SESSION_SECRET"),
      field("使用服务", "Consumers", "API、管理后台会话", "API and admin sessions", "textarea"),
      field("轮换窗口", "Rotation window", "低峰期 02:00–03:00", "Off-peak 02:00–03:00"),
    ],
    [
      copy("界面永远不显示机密原文", "The interface never displays secret values"),
      copy("轮换前展示依赖服务和回滚版本", "Rotation shows dependent services and rollback version"),
      copy("失败状态保留旧版本并提示人工处置", "Failure retains the old version and surfaces manual response"),
    ],
    commonReview,
    copy("本页不会读取、生成、保存或轮换任何真实密钥。", "This page does not read, generate, save, or rotate real secrets."),
  ),
  backups: workflow(
    copy("备份恢复演练", "Backup restore drill"),
    copy("选择备份、在隔离环境验证并记录恢复目标。", "Choose a backup, validate it in isolation, and record recovery objectives."),
    [copy("选择备份", "Choose backup"), copy("隔离验证", "Isolated validation"), copy("恢复审批", "Restore approval")],
    [
      field("备份版本", "Backup version", "BKP-20260728-0400", "BKP-20260728-0400", "select"),
      field("验证环境", "Validation environment", "隔离恢复环境", "Isolated restore environment", "select"),
      field("演练说明", "Drill note", "验证订单与审计数据完整性", "Validate order and audit-data integrity", "textarea"),
    ],
    [
      copy("成功备份与成功恢复使用不同状态", "Successful backup and successful restore remain separate states"),
      copy("演练显示 RPO、RTO、校验结果和负责人", "Drills expose RPO, RTO, validation result, and owner"),
      copy("生产恢复必须经过独立审批和维护窗口", "Production restore requires separate approval and a maintenance window"),
    ],
    commonReview,
    copy("开始演练不会创建资源、下载数据或覆盖数据库。", "Starting a drill does not create resources, download data, or overwrite a database."),
  ),
  integrations: workflow(
    copy("系统集成与后台任务", "Integrations and background jobs"),
    copy("设计服务连接、健康状态、失败重试和任务追踪。", "Design service connections, health states, retries, and job tracing."),
    [copy("服务配置", "Service configuration"), copy("连接检查", "Connection check"), copy("任务恢复", "Job recovery")],
    [
      field("服务类型", "Service type", "邮件服务", "Email service", "select"),
      field("回调地址", "Callback URL", "https://example.test/webhooks"),
      field("失败策略", "Failure policy", "指数退避，最多 5 次", "Exponential backoff, up to 5 attempts", "textarea"),
    ],
    [
      copy("连接信息只显示安全元数据和最后检查时间", "Connections show safe metadata and last-check time only"),
      copy("后台任务显示计划时间、开始时间、状态和追踪编号", "Jobs separate scheduled time, start time, status, and trace ID"),
      copy("重试和终止均要求说明原因", "Retry and termination require a reason"),
    ],
    commonReview,
    copy("连接测试和任务重试不会调用真实外部服务。", "Connection checks and job retries do not call live external services."),
  ),
};

const surfaceStates: Array<{ id: SurfaceState; label: LocalizedText }> = [
  { id: "ready", label: copy("正常", "Ready") },
  { id: "initial-loading", label: copy("加载", "Loading") },
  { id: "empty", label: copy("空数据", "Empty") },
  { id: "offline", label: copy("离线", "Offline") },
  { id: "error", label: copy("失败", "Error") },
  { id: "forbidden", label: copy("无权限", "Forbidden") },
  { id: "conflict", label: copy("保存冲突", "Conflict") },
];

const fallbackDefinition = workflow(
  copy("后台任务流程", "Admin task workflow"),
  copy("检查资料、影响和最终确认状态。", "Review details, impact, and confirmation states."),
  [copy("资料", "Details"), copy("检查", "Review"), copy("确认", "Confirm")],
  [field("任务名称", "Task name", "界面设计预览", "Interface design preview")],
  [
    copy("加载、空、离线、错误和权限状态完整", "Loading, empty, offline, error, and permission states are covered"),
    copy("敏感操作不使用乐观成功", "Sensitive actions do not use optimistic success"),
    copy("所有服务器写入保持关闭", "All server writes remain disabled"),
  ],
  commonReview,
  copy("当前任务只展示界面与交互。", "This task demonstrates interface and interaction only."),
);

const localize = (value: LocalizedText, locale: Locale): string => value[locale];

export function DesignWorkflowDialog({
  id,
  locale,
  contextLabel,
  onClose,
  onPreviewed,
}: {
  id: DesignWorkflowId;
  locale: Locale;
  contextLabel?: string;
  onClose: () => void;
  onPreviewed?: (message: string) => void;
}) {
  const definition = workflowDefinitions[id] ?? fallbackDefinition;
  const initialDraft = useMemo(
    () => Object.fromEntries(definition.fields.map((item, index) => [String(index), localize(item.value, locale)])),
    [definition, locale],
  );
  const [draft, setDraft] = useState<Record<string, string>>(initialDraft);
  const [step, setStep] = useState(0);
  const [surfaceState, setSurfaceState] = useState<SurfaceState>("ready");
  const [reviewed, setReviewed] = useState(false);
  const [completed, setCompleted] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft) || reviewed || step > 0;

  const requestClose = useCallback(() => {
    if (
      dirty
      && !completed
      && !window.confirm(locale === "zh" ? "这是本地设计预览，关闭后将丢失当前演示状态。确定关闭吗？" : "This is a local design preview. Closing discards the current demo state. Close it?")
    ) return;
    onClose();
  }, [completed, dirty, locale, onClose]);

  const finishPreview = () => {
    setCompleted(true);
    const message = locale === "zh"
      ? "流程最终状态已展示；没有执行保存、发送或其他服务器操作。"
      : "The final flow state is shown; no save, send, or other server action was performed.";
    onPreviewed?.(message);
  };

  return (
    <Dialog
      wide
      title={`${localize(definition.title, locale)}${contextLabel ? ` · ${contextLabel}` : ""}`}
      closeLabel={locale === "zh" ? "关闭设计流程" : "Close design flow"}
      onClose={requestClose}
    >
      <div className="design-flow">
        <div className="design-preview-note is-dialog-note" role="note">
          <Eye size={17} />
          <span>
            <strong>{locale === "zh" ? "完整交互设计预览" : "Complete interaction design preview"}</strong>
            {locale === "zh"
              ? "可检查主流程与异常状态；所有数据仅存在于当前弹窗，服务器数据保持不变。"
              : "Inspect the primary flow and failure states. Data exists only in this dialog and the server remains unchanged."}
          </span>
        </div>

        <div className="design-flow-statebar" aria-label={locale === "zh" ? "界面状态预览" : "Interface state preview"}>
          <span>{locale === "zh" ? "状态" : "State"}</span>
          {surfaceStates.map((item) => (
            <button
              type="button"
              className={surfaceState === item.id ? "is-active" : ""}
              aria-pressed={surfaceState === item.id}
              onClick={() => {
                setSurfaceState(item.id);
                setCompleted(false);
              }}
              key={item.id}
            >
              {localize(item.label, locale)}
            </button>
          ))}
        </div>

        {surfaceState === "ready" ? (
          <>
            <nav className="design-flow-steps" aria-label={locale === "zh" ? "流程步骤" : "Workflow steps"}>
              {definition.steps.map((item, index) => (
                <button
                  type="button"
                  className={step === index ? "is-active" : step > index ? "is-complete" : ""}
                  aria-current={step === index ? "step" : undefined}
                  onClick={() => {
                    setStep(index);
                    setCompleted(false);
                  }}
                  key={localize(item, locale)}
                >
                  <span>{step > index ? <Check size={13} /> : `0${index + 1}`}</span>
                  {localize(item, locale)}
                </button>
              ))}
            </nav>

            <div className="design-flow-layout">
              <section className="design-flow-main">
                {completed ? (
                  <div className="design-flow-complete" role="status">
                    <CheckCircle size={31} weight="duotone" />
                    <div>
                      <strong>{locale === "zh" ? "最终界面状态已展示" : "Final interface state shown"}</strong>
                      <p>{locale === "zh" ? "本次操作仅更新当前弹窗的预览状态，未连接任何真实保存、发送、支付、权限或运维功能。" : "This action changed only the local dialog preview. No live save, send, payment, permission, or operations function is connected."}</p>
                    </div>
                  </div>
                ) : step === 0 ? (
                  <div className="design-flow-fields">
                    <div>
                      <small>{locale === "zh" ? "任务说明" : "Task brief"}</small>
                      <p>{localize(definition.summary, locale)}</p>
                    </div>
                    {definition.fields.map((item, index) => (
                      <label key={`${id}-${index}`}>
                        <span>{localize(item.label, locale)}</span>
                        {item.kind === "textarea" ? (
                          <textarea
                            value={draft[String(index)] ?? ""}
                            onChange={(event) => setDraft((current) => ({ ...current, [String(index)]: event.target.value }))}
                          />
                        ) : item.kind === "select" ? (
                          <select
                            value={draft[String(index)] ?? ""}
                            onChange={(event) => setDraft((current) => ({ ...current, [String(index)]: event.target.value }))}
                          >
                            <option value={localize(item.value, locale)}>{localize(item.value, locale)}</option>
                            <option value={locale === "zh" ? "另一种设计状态" : "Alternative design state"}>
                              {locale === "zh" ? "另一种设计状态" : "Alternative design state"}
                            </option>
                          </select>
                        ) : (
                          <input
                            value={draft[String(index)] ?? ""}
                            onChange={(event) => setDraft((current) => ({ ...current, [String(index)]: event.target.value }))}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                ) : step === 1 ? (
                  <div className="design-flow-checks">
                    <div>
                      <small>{locale === "zh" ? "开发前必须锁定" : "Required before implementation"}</small>
                      <p>{locale === "zh" ? "以下规则属于本流程的固定交互要求。" : "These rules are fixed interaction requirements for this workflow."}</p>
                    </div>
                    {definition.checks.map((item, index) => (
                      <article key={localize(item, locale)}>
                        <span>{`0${index + 1}`}</span>
                        <div><strong>{localize(item, locale)}</strong><small>{locale === "zh" ? "已纳入界面与状态设计" : "Covered by interface and state design"}</small></div>
                        <CheckCircle size={18} />
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="design-flow-review">
                    <div>
                      <small>{locale === "zh" ? "影响确认" : "Impact review"}</small>
                      <p>{localize(definition.caution, locale)}</p>
                    </div>
                    <dl>
                      {definition.review.map(([label, value]) => (
                        <div key={localize(label, locale)}>
                          <dt>{localize(label, locale)}</dt>
                          <dd>{localize(value, locale)}</dd>
                        </div>
                      ))}
                    </dl>
                    <label className="design-flow-confirm">
                      <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
                      <span>{locale === "zh" ? "我已确认这是设计预览，不会产生真实业务结果。" : "I understand this is a design preview and creates no real business outcome."}</span>
                    </label>
                  </div>
                )}
              </section>

              <aside className="design-flow-aside">
                <span><FileText size={22} /></span>
                <small>{locale === "zh" ? "设计交付范围" : "DESIGN DELIVERY"}</small>
                <h3>{locale === "zh" ? "主流程与恢复路径" : "Primary and recovery paths"}</h3>
                <ul>
                  <li><CheckCircle />{locale === "zh" ? "正常、加载、空数据与离线" : "Ready, loading, empty, and offline"}</li>
                  <li><CheckCircle />{locale === "zh" ? "失败、无权限与保存冲突" : "Error, forbidden, and save conflict"}</li>
                  <li><CheckCircle />{locale === "zh" ? "键盘焦点、移动端与长文案" : "Keyboard focus, mobile, and long copy"}</li>
                  <li><LockKey />{locale === "zh" ? "敏感操作等待服务器确认" : "Sensitive actions wait for the server"}</li>
                </ul>
                <p>{localize(definition.caution, locale)}</p>
              </aside>
            </div>
          </>
        ) : (
          <DesignSurfaceState state={surfaceState} locale={locale} onRetry={() => setSurfaceState("ready")} />
        )}

        <footer className="design-flow-actions">
          <button type="button" onClick={requestClose}>{locale === "zh" ? "关闭" : "Close"}</button>
          {surfaceState === "ready" && !completed && (
            <>
              <button type="button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
                <ArrowLeft />{locale === "zh" ? "上一步" : "Back"}
              </button>
              {step < 2 ? (
                <button className="admin-primary" type="button" onClick={() => setStep((current) => Math.min(2, current + 1))}>
                  {locale === "zh" ? "下一步" : "Next"}<ArrowRight />
                </button>
              ) : (
                <button className="admin-primary" type="button" disabled={!reviewed} onClick={finishPreview}>
                  <Eye />{locale === "zh" ? "预览最终状态" : "Preview final state"}
                </button>
              )}
            </>
          )}
        </footer>
      </div>
    </Dialog>
  );
}

function DesignSurfaceState({
  state,
  locale,
  onRetry,
}: {
  state: Exclude<SurfaceState, "ready">;
  locale: Locale;
  onRetry: () => void;
}) {
  const content: Record<Exclude<SurfaceState, "ready">, {
    icon: typeof WarningCircle;
    title: LocalizedText;
    body: LocalizedText;
    action?: LocalizedText;
  }> = {
    "initial-loading": {
      icon: SpinnerGap,
      title: copy("正在加载任务资料", "Loading task details"),
      body: copy("保留稳定的弹窗结构，并使用与最终内容同尺寸的局部骨架。", "Keep the dialog shell stable and use local skeletons sized like the final content."),
    },
    empty: {
      icon: FileText,
      title: copy("暂时没有可处理项目", "Nothing needs action"),
      body: copy("说明为什么为空，并提供返回列表或创建条件的明确入口。", "Explain the empty state and provide a clear route back or a way to create qualifying data."),
      action: copy("返回正常状态", "Return to ready state"),
    },
    offline: {
      icon: WarningCircle,
      title: copy("当前处于离线状态", "You are offline"),
      body: copy("保留已加载内容，阻止敏感提交，并在网络恢复后提示重新检查。", "Keep cached content, block sensitive submission, and ask for a fresh review when connectivity returns."),
      action: copy("重新检查", "Check again"),
    },
    error: {
      icon: WarningCircle,
      title: copy("任务资料加载失败", "Task details failed to load"),
      body: copy("保留已填写内容，显示可理解的错误并提供重试。", "Preserve entered content, explain the error, and provide retry."),
      action: copy("重试预览", "Retry preview"),
    },
    forbidden: {
      icon: LockKey,
      title: copy("当前角色没有操作权限", "Your role does not have access"),
      body: copy("说明缺少的权限与可联系的管理员，不展示不可用的敏感数据。", "Explain the missing permission and escalation path without exposing protected data."),
      action: copy("返回流程", "Return to flow"),
    },
    conflict: {
      icon: Clock,
      title: copy("此记录已被其他管理员更新", "Another administrator updated this record"),
      body: copy("并排展示服务器新版本与当前草稿，让管理员选择重新加载或复制草稿后重试。", "Compare the server version with the current draft and let the administrator reload or copy the draft before retrying."),
      action: copy("查看最新版本", "Review latest version"),
    },
  };
  const item = content[state];
  const Icon = item.icon;
  return (
    <section className={`design-flow-surface is-${state}`} role={state === "initial-loading" ? "status" : "alert"} aria-busy={state === "initial-loading"}>
      <span><Icon className={state === "initial-loading" ? "spin" : ""} size={31} weight="duotone" /></span>
      <small>{locale === "zh" ? "状态设计预览" : "STATE DESIGN PREVIEW"}</small>
      <h3>{localize(item.title, locale)}</h3>
      <p>{localize(item.body, locale)}</p>
      {state === "initial-loading" ? (
        <div className="design-flow-skeleton" aria-hidden="true"><i /><i /><i /></div>
      ) : (
        <button className="admin-primary" type="button" onClick={onRetry}>{localize(item.action ?? copy("返回", "Return"), locale)}</button>
      )}
    </section>
  );
}
