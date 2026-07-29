import {
  Check,
  ShieldCheck,
  UserCircleGear,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import {
  getTeamOverview,
  updateMemberRoles,
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

export default function TeamPage({
  locale,
  currentUserId,
  canWrite,
}: {
  locale: Locale;
  currentUserId: string;
  canWrite: boolean;
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
  const editingMember = data?.members.find((member) => member.id === editingId) ?? null;
  const originalRoleIds = useMemo(
    () => editingMember?.roles.map((role) => role.id) ?? [],
    [editingMember],
  );
  const dirty = Boolean(editingMember) && (
    !sameValues(roleIds, originalRoleIds) || reason.trim().length > 0
  );
  useAdminPageDirty(dirty);

  const beginEdit = (memberId: string) => {
    const member = data?.members.find((item) => item.id === memberId);
    if (!member || member.id === currentUserId || !canWrite) return;
    if (
      editingId
      && editingId !== memberId
      && dirty
      && !window.confirm(copy(
        locale,
        "切换成员会丢弃当前未保存的角色变更，是否继续？",
        "Switching members discards the current unsaved role changes. Continue?",
      ))
    ) return;
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
            "成员、角色和登录状态读取平台数据库；角色修改需要最近认证并写入审计。邀请和账号停用尚未接入。",
            "Members, roles, and sign-in state come from the platform database. Role changes require recent authentication and audit. Invitations and account disabling are not connected yet.",
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
          <small>{copy(locale, "已启用 2FA", "2FA enabled")}</small>
          <strong>{data.members.filter((member) => member.totpEnabled).length}</strong>
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
            <span>{copy(locale, "角色", "Roles")}</span>
            <span>{copy(locale, "最后登录", "Last sign-in")}</span>
            <span>{copy(locale, "操作", "Action")}</span>
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
                <span>{member.totpEnabled ? copy(locale, "已启用", "Enabled") : copy(locale, "未启用", "Not enabled")}</span>
                <span title={member.roles.map((role) => role.name[locale]).join("、")}>
                  {member.roles.map((role) => role.name[locale]).join("、")}
                </span>
                <small>{member.lastLoginAt ? formatDate(member.lastLoginAt, locale) : copy(locale, "从未登录", "Never")}</small>
                <button
                  className="row-icon-action"
                  disabled={!canWrite || self}
                  title={self
                    ? copy(locale, "不能修改自己的角色", "You cannot change your own roles")
                    : copy(locale, "编辑成员角色", "Edit member roles")}
                  aria-label={`${copy(locale, "编辑成员角色", "Edit member roles")} ${member.displayName}`}
                  onClick={() => beginEdit(member.id)}
                >
                  <UserCircleGear size={18} />
                </button>
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
    </>
  );
}
