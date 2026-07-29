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
  | "account-center";

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
