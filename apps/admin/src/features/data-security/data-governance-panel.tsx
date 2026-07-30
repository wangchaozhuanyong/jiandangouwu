import type {
  AdminDataGovernanceOverview,
  PrivacyRequestStatus,
  PrivacyRequestType,
} from "@cloudbridge/contracts";
import {
  ArrowsClockwise,
  Database,
  Key,
  ShieldCheck,
  Trash,
  UserFocus,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useState,
} from "react";
import {
  invalidateAdminCache,
  useAdminStatus,
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../../admin-experience";
import {
  formatDate,
  PanelState,
  RefreshNotice,
  StatusPill,
} from "../../admin-ui";
import type { Locale } from "../../api";
import {
  createPrivacyRequest,
  getDataGovernanceOverview,
  runDataKeyRotation,
  updatePrivacyRequest,
} from "./governance-api";

const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;
const requestTypes: ReadonlyArray<PrivacyRequestType> = ["ACCESS", "CORRECTION", "ERASURE"];
const requestStatuses: ReadonlyArray<PrivacyRequestStatus> = [
  "RECEIVED",
  "IDENTITY_VERIFIED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
];

export default function DataGovernancePanel({
  canWrite,
  locale,
}: {
  canWrite: boolean;
  locale: Locale;
}) {
  const { notify } = useAdminStatus();
  const loader = useCallback((signal: AbortSignal) => getDataGovernanceOverview(signal), []);
  const resource = useCachedAdminResource<AdminDataGovernanceOverview>("data-governance", loader);
  const slow = useSlowAdminRequest(resource.state);
  const [requestType, setRequestType] = useState<PrivacyRequestType>("ACCESS");
  const [requesterReference, setRequesterReference] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => void resource.reload();
  if (!resource.data) {
    return (
      <section className="admin-panel governance-panel">
        <PanelState state={resource.state} locale={locale} retry={refresh} />
      </section>
    );
  }

  const overview = resource.data;
  const retention = overview.retention;
  const preview = overview.cleanupPreview;
  const updateStatus = (id: string, status: PrivacyRequestStatus, type: PrivacyRequestType) => {
    let confirmation: string | undefined;
    let correctedReference: string | undefined;
    if (status === "COMPLETED" && type === "ACCESS") {
      confirmation = window.prompt(copy(
        locale,
        "导出仅限已核验申请人。请输入 EXPORT VERIFIED DATA 确认。",
        "Exports are only for verified requesters. Type EXPORT VERIFIED DATA to confirm.",
      )) ?? "";
      if (confirmation !== "EXPORT VERIFIED DATA") return;
    }
    if (status === "COMPLETED" && type === "CORRECTION") {
      correctedReference = window.prompt(copy(
        locale,
        "请输入核验后的新联系方式。",
        "Enter the verified corrected contact value.",
      ))?.trim() ?? "";
      if (correctedReference.length < 3) return;
      confirmation = window.prompt(copy(
        locale,
        "请输入 CORRECT VERIFIED CONTACT 确认更正。",
        "Type CORRECT VERIFIED CONTACT to confirm the correction.",
      )) ?? "";
      if (confirmation !== "CORRECT VERIFIED CONTACT") return;
    }
    if (status === "COMPLETED" && type === "ERASURE") {
      confirmation = window.prompt(copy(
        locale,
        "匿名化不可逆。请输入 ANONYMIZE VERIFIED CONTACT 确认。",
        "Anonymization is irreversible. Type ANONYMIZE VERIFIED CONTACT to confirm.",
      )) ?? "";
      if (confirmation !== "ANONYMIZE VERIFIED CONTACT") return;
    }
    const actionReason = window.prompt(copy(locale, "请输入本次处理原因（至少 8 个字符）", "Enter the handling reason (at least 8 characters)"))?.trim() ?? "";
    if (actionReason.length < 8) return;
    setBusy(true);
    void updatePrivacyRequest(id, {
      status,
      reason: actionReason,
      confirmation,
      correctedReference,
    })
      .then(() => {
        invalidateAdminCache("audit");
        notify(copy(locale, "隐私请求状态已更新。", "Privacy-request status updated."));
        void resource.reload();
      })
      .catch(() => notify(copy(locale, "隐私请求更新失败。", "Privacy-request update failed."), "error"))
      .finally(() => setBusy(false));
  };

  return (
    <div className="governance-layout">
      <div className="data-security-truth-note" role="note">
        <ShieldCheck size={20} aria-hidden="true" />
        <span>
          <strong>{copy(locale, "Sites 数据治理已接入，自动删除仍关闭", "Sites data governance is connected; automatic deletion remains off")}</strong>
          {copy(
            locale,
            "当前只生成清理预览，不执行写入。隐私请求与密钥轮换均要求原因、确认和审计。",
            "Cleanup is preview-only and performs no writes. Privacy requests and key rotation require reasons, confirmation, and audit.",
          )}
        </span>
      </div>
      <RefreshNotice state={resource.state} locale={locale} retry={refresh} slow={slow} />

      <div className="governance-summary">
        <article className="admin-panel">
          <Database />
          <span>{copy(locale, "清理模式", "Cleanup mode")}</span>
          <strong>{retention.enabled ? "ENABLED" : "PREVIEW_ONLY"}</strong>
          <small>{copy(locale, "本轮写入", "Writes this run")} · {String(preview.writesPerformed)}</small>
        </article>
        <article className="admin-panel">
          <UserFocus />
          <span>{copy(locale, "隐私请求", "Privacy requests")}</span>
          <strong>{overview.privacyRequests.length}</strong>
          <small>{copy(locale, "客户无需账号", "No customer account required")}</small>
        </article>
        <article className="admin-panel">
          <Key />
          <span>{copy(locale, "密钥轮换", "Key rotation")}</span>
          <strong>{overview.keyRotation.state}</strong>
          <small>{overview.keyRotation.activeKeyId ?? "—"}</small>
        </article>
      </div>

      <section className="admin-panel governance-retention">
        <div className="governance-heading">
          <div>
            <small>{copy(locale, "未启用草案", "DISABLED DRAFT")}</small>
            <h2>{copy(locale, "数据保留与清理预览", "Retention and cleanup preview")}</h2>
          </div>
          <StatusPill status="PREVIEW_ONLY" locale={locale} />
        </div>
        <dl className="governance-retention-grid">
          <div><dt>{copy(locale, "联系方式匿名化", "Contact anonymization")}</dt><dd>{retention.contactAnonymizeAfterDays} d</dd></div>
          <div><dt>{copy(locale, "订单", "Orders")}</dt><dd>{retention.orderRetentionDays} d</dd></div>
          <div><dt>{copy(locale, "审计", "Audit")}</dt><dd>{retention.auditRetentionDays} d</dd></div>
          <div><dt>Telegram</dt><dd>{retention.telegramRetentionDays} d</dd></div>
          <div><dt>{copy(locale, "备份", "Backups")}</dt><dd>{retention.backupRetentionDays} d</dd></div>
        </dl>
        <div className="governance-preview-counts">
          <span><b>{preview.contactsEligible}</b>{copy(locale, "联系方式", "contacts")}</span>
          <span><b>{preview.ordersEligible}</b>{copy(locale, "订单", "orders")}</span>
          <span><b>{preview.auditEventsEligible}</b>{copy(locale, "审计事件", "audit events")}</span>
          <span><b>{preview.telegramDeliveriesEligible}</b>Telegram</span>
          <span><b>{preview.backupsEligible}</b>{copy(locale, "备份", "backups")}</span>
        </div>
        <p>
          {copy(locale, "预览生成时间", "Preview generated")} · {formatDate(preview.generatedAt, locale)}
          {" · "}
          {copy(locale, "最早符合日期", "Oldest eligible")} · {preview.oldestEligibleAt ? formatDate(preview.oldestEligibleAt, locale) : "—"}
        </p>
      </section>

      <section className="admin-panel governance-privacy">
        <div className="governance-heading">
          <div>
            <small>{copy(locale, "人工核验工作流", "MANUAL VERIFICATION WORKFLOW")}</small>
            <h2>{copy(locale, "隐私请求", "Privacy requests")}</h2>
          </div>
          <span>{overview.privacyRequests.length}</span>
        </div>
        {canWrite && (
          <form
            className="governance-request-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy || reason.trim().length < 8 || requesterReference.trim().length < 3) return;
              setBusy(true);
              void createPrivacyRequest({
                type: requestType,
                requesterReference: requesterReference.trim(),
                reason: reason.trim(),
              })
                .then(() => {
                  setRequesterReference("");
                  setReason("");
                  notify(copy(locale, "隐私请求已登记。", "Privacy request registered."));
                  void resource.reload();
                })
                .catch(() => notify(copy(locale, "隐私请求登记失败。", "Privacy request registration failed."), "error"))
                .finally(() => setBusy(false));
            }}
          >
            <label>
              <span>{copy(locale, "类型", "Type")}</span>
              <select onChange={(event) => setRequestType(event.target.value as PrivacyRequestType)} value={requestType}>
                {requestTypes.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>{copy(locale, "申请人联系方式", "Requester contact")}</span>
              <input onChange={(event) => setRequesterReference(event.target.value)} required value={requesterReference} />
            </label>
            <label>
              <span>{copy(locale, "登记原因", "Registration reason")}</span>
              <input minLength={8} onChange={(event) => setReason(event.target.value)} required value={reason} />
            </label>
            <button className="admin-primary" disabled={busy} type="submit">
              {copy(locale, "登记请求", "Register request")}
            </button>
          </form>
        )}
        <div className="governance-table-wrap" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>ID</th><th>{copy(locale, "类型", "Type")}</th><th>{copy(locale, "申请人", "Requester")}</th>
                <th>{copy(locale, "状态", "Status")}</th><th>{copy(locale, "结果", "Result")}</th>
                <th>{copy(locale, "登记时间", "Created")}</th><th>{copy(locale, "处理", "Action")}</th>
              </tr>
            </thead>
            <tbody>
              {overview.privacyRequests.length === 0 && (
                <tr><td colSpan={7}>{copy(locale, "尚无隐私请求。", "No privacy requests.")}</td></tr>
              )}
              {overview.privacyRequests.map((item) => (
                <tr key={item.id}>
                  <td><code>{item.id}</code></td>
                  <td>{item.type}</td>
                  <td>{item.requesterReference}</td>
                  <td><StatusPill status={item.status} locale={locale} /></td>
                  <td>
                    {item.result
                      ? (
                          <details>
                            <summary>{item.result.action} · {item.result.affectedOrders}</summary>
                            {item.result.exportedOrders?.map((order) => (
                              <p key={order.orderNumber}>
                                <code>{order.orderNumber}</code>
                                {" · "}{order.status}
                                {" · "}{order.contactChannel}
                                {" · "}{order.maskedContact}
                              </p>
                            ))}
                          </details>
                        )
                      : "—"}
                  </td>
                  <td>{formatDate(item.createdAt, locale)}</td>
                  <td>
                    <select
                      aria-label={`${item.id} ${copy(locale, "状态", "status")}`}
                      disabled={!canWrite || busy}
                      onChange={(event) => updateStatus(item.id, event.target.value as PrivacyRequestStatus, item.type)}
                      value={item.status}
                    >
                      {requestStatuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel governance-key">
        <div className="governance-heading">
          <div>
            <small>{copy(locale, "双密钥过渡", "DUAL-KEY TRANSITION")}</small>
            <h2>{copy(locale, "Sites 托管密钥轮换", "Sites-managed key rotation")}</h2>
          </div>
          <StatusPill status={overview.keyRotation.state} locale={locale} />
        </div>
        <dl>
          <div><dt>{copy(locale, "当前密钥", "Active key")}</dt><dd><code>{overview.keyRotation.activeKeyId ?? "—"}</code></dd></div>
          <div><dt>{copy(locale, "下一密钥", "Next key")}</dt><dd><code>{overview.keyRotation.nextKeyId ?? "—"}</code></dd></div>
          <div><dt>{copy(locale, "待重加密联系方式", "Contacts remaining")}</dt><dd>{overview.keyRotation.contactsRemaining}</dd></div>
          <div><dt>{copy(locale, "待重加密备份", "Backups remaining")}</dt><dd>{overview.keyRotation.backupsRemaining}</dd></div>
        </dl>
        <p>
          {overview.keyRotation.state === "NEXT_KEY_MISSING"
            ? copy(locale, "先在 Sites 生产密钥中配置 CLOUDBRIDGE_DATA_KEY_NEXT；失败时旧密钥继续生效。", "Configure CLOUDBRIDGE_DATA_KEY_NEXT in Sites production secrets first; the old key remains active on failure.")
            : copy(locale, "执行前会创建新备份，随后分批重加密并完整校验。", "A new backup is created before batched re-encryption and full validation.")}
        </p>
        <button
          className="admin-secondary"
          disabled={!canWrite || busy || overview.keyRotation.state !== "READY"}
          onClick={() => {
            const rotationReason = window.prompt(copy(locale, "请输入轮换原因（至少 8 个字符）", "Enter the rotation reason (at least 8 characters)"))?.trim() ?? "";
            if (rotationReason.length < 8) return;
            if (!window.confirm(copy(locale, "确认开始密钥轮换？旧密钥会保留到校验完成。", "Start key rotation? The old key remains until validation completes."))) return;
            setBusy(true);
            void runDataKeyRotation(rotationReason)
              .then(() => {
                notify(copy(locale, "密钥轮换已完成校验。", "Key rotation completed validation."));
                void resource.reload();
              })
              .catch(() => notify(copy(locale, "密钥轮换失败，旧密钥仍在使用。", "Key rotation failed; the old key remains active."), "error"))
              .finally(() => setBusy(false));
          }}
          type="button"
        >
          <ArrowsClockwise />
          {copy(locale, "开始轮换", "Start rotation")}
        </button>
        {overview.keyRotation.lastErrorCode && (
          <p className="table-action-error"><WarningCircle />{overview.keyRotation.lastErrorCode}</p>
        )}
      </section>
    </div>
  );
}
