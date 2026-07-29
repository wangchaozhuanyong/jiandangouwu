import {
  Check,
  Key,
  LockOpen,
  Power,
  ShieldCheck,
  ShieldSlash,
  UserCircleGear,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import {
  getTeamOverview,
  type AdminMemberLifecycleAction,
  type AdminTeamMember,
  updateMemberRoles,
  updateMemberLifecycle,
  type AdminTeamOverview,
  type Locale,
} from "../../api";
import {
  invalidateAdminCache,
  useAdminPageDirty,
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

const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

const sameValues = (left: string[], right: string[]): boolean => {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
};

const lifecycleActions = (
  member: AdminTeamMember,
): AdminMemberLifecycleAction[] => {
  if (member.authProvider !== "PASSWORD") return [];
  const actions: AdminMemberLifecycleAction[] = [];
  if (member.status === "DISABLED" && member.passwordConfigured && member.roles.length > 0) {
    actions.push("ENABLE");
  }
  if (["ACTIVE", "LOCKED", "INVITED"].includes(member.status)) {
    actions.push("DISABLE");
  }
  if (member.status === "LOCKED") actions.unshift("UNLOCK");
  if (member.totpEnabled) actions.push("RESET_TOTP");
  return actions;
};

const lifecycleActionCopy = (
  locale: Locale,
  action: AdminMemberLifecycleAction,
): { label: string; detail: string } => ({
  ENABLE: {
    label: copy(locale, "启用账号", "Enable account"),
    detail: copy(
      locale,
      "撤销遗留认证状态后恢复登录；保留现有密码、角色和双重验证设置。",
      "Revoke stale authentication state and restore sign-in while keeping the existing password, roles, and two-factor setting.",
    ),
  },
  DISABLE: {
    label: copy(locale, "停用账号", "Disable account"),
    detail: copy(
      locale,
      "立即撤销全部会话和认证流程；再次启用前无法登录，业务数据不会删除。",
      "Immediately revoke all sessions and authentication flows. Sign-in remains blocked until re-enabled; business data is not deleted.",
    ),
  },
  UNLOCK: {
    label: copy(locale, "解除锁定", "Unlock account"),
    detail: copy(
      locale,
      "清除失败次数和锁定期限，并要求成员使用现有凭据重新登录。",
      "Clear failed attempts and the lock deadline, then require a fresh sign-in with existing credentials.",
    ),
  },
  RESET_TOTP: {
    label: copy(locale, "重置双重验证", "Reset two-factor"),
    detail: copy(
      locale,
      "删除现有 TOTP 密钥并撤销全部会话；成员重新登录后需要再次绑定。",
      "Delete the current TOTP secret and revoke all sessions. The member must enroll again after signing in.",
    ),
  },
})[action];

export default function TeamPage({
  locale,
  currentUserId,
  canWrite,
  sitesRuntime,
}: {
  locale: Locale;
  currentUserId: string;
  canWrite: boolean;
  sitesRuntime: boolean;
}) {
  const loader = useCallback((signal: AbortSignal) => getTeamOverview(signal), []);
  const { data, state, reload, commit } = useCachedAdminResource<AdminTeamOverview>("team", loader);
  const slow = useSlowAdminRequest(state);
  const { notify } = useAdminStatus();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [managingId, setManagingId] = useState<string | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [lifecycleError, setLifecycleError] = useState("");
  const editingMember = data?.members.find((member) => member.id === editingId) ?? null;
  const managingMember = data?.members.find((member) => member.id === managingId) ?? null;
  const originalRoleIds = useMemo(
    () => editingMember?.roles.map((role) => role.id) ?? [],
    [editingMember],
  );
  const roleDirty = Boolean(editingMember) && (
    !sameValues(roleIds, originalRoleIds) || reason.trim().length > 0
  );
  const lifecycleDirty = Boolean(managingMember) && lifecycleReason.trim().length > 0;
  const availableLifecycleActions = useMemo(
    () => managingMember ? lifecycleActions(managingMember) : [],
    [managingMember],
  );
  useAdminPageDirty(roleDirty || lifecycleDirty);

  const beginEdit = (memberId: string) => {
    const member = data?.members.find((item) => item.id === memberId);
    if (!member || member.id === currentUserId || !canWrite) return;
    if (
      editingId
      && editingId !== memberId
      && roleDirty
      && !window.confirm(copy(
        locale,
        "切换成员会丢弃当前未保存的角色变更，是否继续？",
        "Switching members discards the current unsaved role changes. Continue?",
      ))
    ) return;
    if (
      managingMember
      && lifecycleDirty
      && !window.confirm(copy(
        locale,
        "打开角色编辑会丢弃当前未提交的账号操作原因，是否继续？",
        "Opening role editing discards the current unsaved account-action reason. Continue?",
      ))
    ) return;
    setManagingId(null);
    setLifecycleReason("");
    setLifecycleError("");
    setEditingId(member.id);
    setRoleIds(member.roles.map((role) => role.id));
    setReason("");
    setError("");
  };

  const closeEditor = () => {
    if (busy) return;
    setEditingId(null);
    setRoleIds([]);
    setReason("");
    setError("");
  };

  const beginLifecycle = (memberId: string) => {
    const member = data?.members.find((item) => item.id === memberId);
    if (
      !member
      || member.id === currentUserId
      || !canWrite
      || member.authProvider !== "PASSWORD"
    ) return;
    if (
      editingMember
      && roleDirty
      && !window.confirm(copy(
        locale,
        "打开账号管理会丢弃当前未保存的角色变更，是否继续？",
        "Opening account management discards the current unsaved role changes. Continue?",
      ))
    ) return;
    if (
      managingId
      && managingId !== memberId
      && lifecycleDirty
      && !window.confirm(copy(
        locale,
        "切换成员会丢弃当前未提交的账号操作原因，是否继续？",
        "Switching members discards the current unsaved account-action reason. Continue?",
      ))
    ) return;
    setEditingId(null);
    setRoleIds([]);
    setReason("");
    setError("");
    setManagingId(member.id);
    setLifecycleReason("");
    setLifecycleError("");
  };

  const closeLifecycle = () => {
    if (lifecycleBusy) return;
    setManagingId(null);
    setLifecycleReason("");
    setLifecycleError("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!data || !editingMember || busy) return;
    if (roleIds.length === 0) {
      setError(copy(locale, "至少保留一个角色。", "Keep at least one role."));
      return;
    }
    if (reason.trim().length < 8) {
      setError(copy(locale, "请填写至少 8 个字符的变更原因。", "Enter a reason of at least 8 characters."));
      return;
    }
    if (sameValues(roleIds, originalRoleIds)) {
      setError(copy(locale, "角色没有变化。", "The role assignment has not changed."));
      return;
    }
    if (!window.confirm(copy(
      locale,
      `确认修改 ${editingMember.displayName} 的角色？权限将在下一次请求立即生效。`,
      `Change roles for ${editingMember.displayName}? Permissions take effect on the next request.`,
    ))) return;

    setBusy(true);
    setError("");
    try {
      const updated = await updateMemberRoles(editingMember.id, {
        roleIds,
        expectedUpdatedAt: editingMember.updatedAt,
        reason: reason.trim(),
      });
      commit({
        ...data,
        members: data.members.map((member) => member.id === updated.id ? updated : member),
      });
      invalidateAdminCache("roles", "audit");
      notify(copy(locale, "成员角色已由服务器确认更新。", "Member roles were confirmed by the server."));
      setEditingId(null);
      setRoleIds([]);
      setReason("");
      setError("");
    } catch {
      setError(copy(
        locale,
        "保存失败。可能是最近认证已过期、权限不足或数据已被其他管理员修改。",
        "Save failed. Reauthentication may have expired, permission may be missing, or another administrator changed the data.",
      ));
      notify(copy(locale, "成员角色未更新。", "Member roles were not updated."), "error");
    } finally {
      setBusy(false);
    }
  };

  const submitLifecycle = async (action: AdminMemberLifecycleAction) => {
    if (
      !data
      || !managingMember
      || lifecycleBusy
      || !availableLifecycleActions.includes(action)
    ) return;
    if (lifecycleReason.trim().length < 8) {
      setLifecycleError(copy(
        locale,
        "请填写至少 8 个字符的操作原因。",
        "Enter an action reason of at least 8 characters.",
      ));
      return;
    }
    const actionCopy = lifecycleActionCopy(locale, action);
    if (!window.confirm(copy(
      locale,
      `${actionCopy.label}：${managingMember.displayName}。${actionCopy.detail}该操作需要最近认证、会写入审计，确定继续吗？`,
      `${actionCopy.label}: ${managingMember.displayName}. ${actionCopy.detail} This requires recent authentication and will be audited. Continue?`,
    ))) return;

    setLifecycleBusy(true);
    setLifecycleError("");
    try {
      const result = await updateMemberLifecycle(managingMember.id, {
        action,
        expectedUpdatedAt: managingMember.updatedAt,
        reason: lifecycleReason.trim(),
      });
      commit({
        ...data,
        members: data.members.map((member) => (
          member.id === result.member.id ? result.member : member
        )),
      });
      invalidateAdminCache("audit");
      notify(copy(
        locale,
        `${actionCopy.label}已由服务器确认；已撤销 ${result.revokedSessionCount} 个会话和 ${result.revokedChallengeCount} 个认证流程。`,
        `${actionCopy.label} was confirmed by the server; ${result.revokedSessionCount} session(s) and ${result.revokedChallengeCount} authentication flow(s) were revoked.`,
      ));
      setManagingId(null);
      setLifecycleReason("");
      setLifecycleError("");
    } catch {
      setLifecycleError(copy(
        locale,
        "操作未确认完成。可能是最近认证已过期、账号状态已变化、会话服务不可用或当前账号受系统保护；请刷新后复核。",
        "The operation was not confirmed. Reauthentication may have expired, account state may have changed, the session service may be unavailable, or the account may be system protected. Refresh and verify.",
      ));
      notify(copy(locale, "账号状态未确认更新。", "Account state was not confirmed."), "error");
    } finally {
      setLifecycleBusy(false);
    }
  };

  if (!data) {
    return <PanelState state={state} locale={locale} retry={() => void reload()} />;
  }

  return (
    <>
      <div className="access-boundary-note" role="note">
        <ShieldCheck size={19} />
        <span>
          <strong>{copy(locale, "真实成员与角色分配", "Live members and role assignment")}</strong>
          {copy(
            locale,
            sitesRuntime
              ? "成员身份来自 ChatGPT；CloudBridge 只读展示，不修改平台账号、密码、双重验证或会话。"
              : "成员、角色和登录状态读取 MySQL；角色、启停、解锁和 TOTP 重置都需要最近认证、业务原因、会话撤销与审计。成员邀请仍未接入。",
            sitesRuntime
              ? "Member identity comes from ChatGPT. CloudBridge displays it read-only and does not change platform accounts, passwords, two-factor authentication, or sessions."
              : "Members, roles, and sign-in state come from MySQL. Role, enable, disable, unlock, and TOTP reset actions require recent authentication, a business reason, session revocation, and audit. Member invitations are not connected yet.",
          )}
        </span>
      </div>
      <section className="admin-panel access-summary">
        <div>
          <span><UsersThree size={22} /></span>
          <small>{copy(locale, "成员总数", "Members")}</small>
          <strong>{data.members.length}</strong>
        </div>
        <div>
          <span><Check size={22} /></span>
          <small>{copy(locale, "正常账号", "Active accounts")}</small>
          <strong>{data.members.filter((member) => member.status === "ACTIVE").length}</strong>
        </div>
        <div>
          <span><ShieldCheck size={22} /></span>
          <small>{copy(locale, "锁定账号", "Locked accounts")}</small>
          <strong>{data.members.filter((member) => member.status === "LOCKED").length}</strong>
        </div>
        <div>
          <span><Key size={22} /></span>
          <small>{sitesRuntime
            ? copy(locale, "身份安全", "Identity security")
            : copy(locale, "已启用 2FA", "2FA enabled")}</small>
          <strong>{sitesRuntime
            ? copy(locale, "平台管理", "Platform")
            : data.members.filter((member) => member.totpEnabled === true).length}</strong>
        </div>
      </section>
      <section className="admin-panel">
        <RefreshNotice state={state} locale={locale} retry={() => void reload()} slow={slow} />
        <div className="data-table team-table" tabIndex={0} aria-label={copy(locale, "团队成员表，可横向滚动", "Team members table, horizontally scrollable")}>
          <div className="table-head">
            <span>{copy(locale, "姓名", "Name")}</span>
            <span>{copy(locale, "邮箱", "Email")}</span>
            <span>{copy(locale, "账号状态", "Status")}</span>
            <span>{copy(locale, "双重验证", "Two-factor")}</span>
            <span>{copy(locale, "失败登录", "Failed sign-ins")}</span>
            <span>{copy(locale, "锁定至", "Locked until")}</span>
            <span>{copy(locale, "角色", "Roles")}</span>
            <span>{copy(locale, "最后登录", "Last sign-in")}</span>
            <span>{copy(locale, "操作", "Actions")}</span>
          </div>
          {data.members.length === 0 && (
            <div className="table-empty">{copy(locale, "暂无管理员成员。", "No administrator members.")}</div>
          )}
          {data.members.map((member) => {
            const self = member.id === currentUserId;
            return (
              <div className="table-row" key={member.id}>
                <strong title={member.displayName}>{member.displayName}</strong>
                <code title={member.email}>{member.email}</code>
                <StatusPill status={member.status} locale={locale} />
                <span>{member.totpEnabled === null
                  ? copy(locale, "平台管理", "Platform managed")
                  : member.totpEnabled
                    ? copy(locale, "已启用", "Enabled")
                    : copy(locale, "未启用", "Not enabled")}</span>
                <span>{member.failedLoginCount === null
                  ? copy(locale, "未采集", "Not collected")
                  : member.failedLoginCount}</span>
                <small>{member.authProvider === "SITES"
                  ? copy(locale, "未采集", "Not collected")
                  : member.lockedUntil
                    ? formatDate(member.lockedUntil, locale)
                    : "—"}</small>
                <span title={member.roles.map((role) => role.name[locale]).join("、")}>
                  {member.roles.map((role) => role.name[locale]).join("、")}
                </span>
                <small>{member.lastLoginAt ? formatDate(member.lastLoginAt, locale) : copy(locale, "从未登录", "Never")}</small>
                <span className="member-action-group">
                  <button
                    className="row-icon-action"
                    disabled={!canWrite || self || member.authProvider !== "PASSWORD"}
                    title={self
                      ? copy(locale, "不能修改自己的角色", "You cannot change your own roles")
                      : copy(locale, "编辑成员角色", "Edit member roles")}
                    aria-label={`${copy(locale, "编辑成员角色", "Edit member roles")} ${member.displayName}`}
                    onClick={() => beginEdit(member.id)}
                  >
                    <UserCircleGear size={18} />
                  </button>
                  <button
                    className="row-icon-action"
                    disabled={!canWrite || self || member.authProvider !== "PASSWORD"}
                    title={sitesRuntime
                      ? copy(locale, "Sites 账号由 ChatGPT 管理", "Sites accounts are managed by ChatGPT")
                      : self
                        ? copy(locale, "请在安全中心管理自己的账号", "Manage your own account in the security center")
                        : copy(locale, "管理账号状态与双重验证", "Manage account state and two-factor authentication")}
                    aria-label={`${copy(locale, "管理账号安全", "Manage account security")} ${member.displayName}`}
                    onClick={() => beginLifecycle(member.id)}
                  >
                    <ShieldCheck size={18} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </section>
      {editingMember && (
        <section className="admin-panel access-editor" aria-labelledby="member-role-editor-title">
          <div className="panel-heading">
            <div>
              <small>{copy(locale, "敏感权限变更", "Sensitive access change")}</small>
              <h2 id="member-role-editor-title">{editingMember.displayName}</h2>
              <p>{editingMember.email}</p>
            </div>
            <StatusPill status={editingMember.status} locale={locale} />
          </div>
          <form onSubmit={(event) => void submit(event)}>
            <fieldset>
              <legend>{copy(locale, "分配角色", "Assigned roles")}</legend>
              <div className="access-choice-grid">
                {data.availableRoles.map((role) => (
                  <label key={role.id}>
                    <input
                      type="checkbox"
                      checked={roleIds.includes(role.id)}
                      onChange={(event) => setRoleIds((current) => event.target.checked
                        ? [...current, role.id]
                        : current.filter((id) => id !== role.id))}
                    />
                    <span><strong>{role.name[locale]}</strong><small>{role.key}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="access-reason">
              <span>{copy(locale, "变更原因", "Change reason")}</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={8}
                maxLength={500}
                placeholder={copy(locale, "说明职责变化或授权依据", "Explain the responsibility change or authorization basis")}
                required
              />
            </label>
            {error && <p className="form-error" role="alert"><WarningCircle />{error}</p>}
            <div className="access-editor-actions">
              <button type="button" disabled={busy} onClick={closeEditor}>{copy(locale, "取消", "Cancel")}</button>
              <button className="admin-primary" disabled={busy || roleIds.length === 0}>
                {busy ? copy(locale, "正在保存", "Saving") : copy(locale, "确认角色变更", "Confirm role change")}
              </button>
            </div>
          </form>
        </section>
      )}
      {managingMember && (
        <section className="admin-panel access-editor account-lifecycle-editor" aria-labelledby="member-lifecycle-editor-title">
          <div className="panel-heading">
            <div>
              <small>{copy(locale, "高风险账号操作", "High-risk account actions")}</small>
              <h2 id="member-lifecycle-editor-title">{managingMember.displayName}</h2>
              <p>{managingMember.email}</p>
            </div>
            <StatusPill status={managingMember.status} locale={locale} />
          </div>
          <div className="account-lifecycle-body">
            <dl>
              <div>
                <dt>{copy(locale, "密码状态", "Password")}</dt>
                <dd>{managingMember.passwordConfigured
                  ? copy(locale, "已配置", "Configured")
                  : copy(locale, "未配置", "Not configured")}</dd>
              </div>
              <div>
                <dt>{copy(locale, "双重验证", "Two-factor")}</dt>
                <dd>{managingMember.totpEnabled
                  ? copy(locale, "已启用", "Enabled")
                  : copy(locale, "未启用", "Not enabled")}</dd>
              </div>
              <div>
                <dt>{copy(locale, "失败登录", "Failed sign-ins")}</dt>
                <dd>{managingMember.failedLoginCount ?? copy(locale, "未采集", "Not collected")}</dd>
              </div>
              <div>
                <dt>{copy(locale, "锁定期限", "Lock deadline")}</dt>
                <dd>{managingMember.lockedUntil
                  ? formatDate(managingMember.lockedUntil, locale)
                  : copy(locale, "无", "None")}</dd>
              </div>
            </dl>
            <label className="access-reason">
              <span>{copy(locale, "操作原因", "Action reason")}</span>
              <textarea
                value={lifecycleReason}
                onChange={(event) => setLifecycleReason(event.target.value)}
                minLength={8}
                maxLength={500}
                placeholder={copy(
                  locale,
                  "说明账号处置依据、影响范围和负责人",
                  "Explain the account-action basis, impact, and accountable owner",
                )}
                required
              />
            </label>
            {lifecycleError && <p className="form-error" role="alert"><WarningCircle />{lifecycleError}</p>}
            {availableLifecycleActions.length > 0 ? (
              <div className="account-lifecycle-actions">
                {availableLifecycleActions.map((action) => {
                  const actionCopy = lifecycleActionCopy(locale, action);
                  const Icon = action === "ENABLE"
                    ? Power
                    : action === "UNLOCK"
                      ? LockOpen
                      : action === "RESET_TOTP"
                        ? Key
                        : ShieldSlash;
                  return (
                    <button
                      type="button"
                      className={action === "DISABLE" || action === "RESET_TOTP"
                        ? "is-danger"
                        : "is-primary"}
                      disabled={lifecycleBusy}
                      onClick={() => void submitLifecycle(action)}
                      key={action}
                    >
                      <Icon size={19} />
                      <span>
                        <strong>{actionCopy.label}</strong>
                        <small>{actionCopy.detail}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="account-lifecycle-empty" role="status">
                {copy(
                  locale,
                  managingMember.passwordConfigured
                    ? "当前账号状态没有可执行的生命周期操作。"
                    : "该账号尚未配置密码；成员邀请流程完成前不能启用。",
                  managingMember.passwordConfigured
                    ? "No lifecycle action is available for the current account state."
                    : "This account has no password and cannot be enabled until the invitation flow exists.",
                )}
              </p>
            )}
            <div className="access-editor-actions">
              <button type="button" disabled={lifecycleBusy} onClick={closeLifecycle}>
                {copy(locale, "关闭", "Close")}
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
