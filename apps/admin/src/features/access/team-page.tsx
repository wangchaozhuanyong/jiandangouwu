import type {
  AdminAccessRoleSummary,
  AdminTeamMember,
  AssignableAdminRoleKey,
} from "@cloudbridge/contracts";
import {
  Check,
  Key,
  NotePencil,
  Plus,
  ShieldCheck,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  ApiError,
  createTeamMember,
  getTeamOverview,
  updateTeamMember,
  type AdminTeamOverview,
  type Locale,
} from "../../api";
import {
  useAdminStatus,
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../../admin-experience";
import {
  Dialog,
  formatDate,
  PanelState,
  RefreshNotice,
  StatusPill,
  useUnsavedChanges,
} from "../../admin-ui";

const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

export default function TeamPage({
  currentUserEmail,
  locale,
}: {
  currentUserEmail: string;
  locale: Locale;
}) {
  const loader = useCallback((signal: AbortSignal) => getTeamOverview(signal), []);
  const resource = useCachedAdminResource<AdminTeamOverview>("team", loader);
  const slow = useSlowAdminRequest(resource.state);
  const [dialog, setDialog] = useState<
    { kind: "create" } | { kind: "edit"; member: AdminTeamMember } | null
  >(null);
  if (!resource.data) {
    return <PanelState state={resource.state} locale={locale} retry={() => void resource.reload()} />;
  }
  const data = resource.data;
  return (
    <>
      <div className="access-boundary-note" role="note">
        <ShieldCheck size={19} />
        <span>
          <strong>{copy(locale, "ChatGPT 身份边界", "ChatGPT identity boundary")}</strong>
          {copy(
            locale,
            "CloudBridge 只预授权指定邮箱。系统不会发送邀请邮件，也不保存员工密码；员工必须使用完全相同的 ChatGPT 邮箱首次登录后才会激活。",
            "CloudBridge only pre-authorizes an exact email. It sends no invitation email and stores no staff passwords; the member activates only after first signing in with the same ChatGPT email.",
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
          <small>{copy(locale, "等待登录", "Awaiting sign-in")}</small>
          <strong>{data.members.filter((member) => member.status === "INVITED").length}</strong>
        </div>
        <div>
          <span><Key size={22} /></span>
          <small>{copy(locale, "身份来源", "Identity source")}</small>
          <strong>ChatGPT</strong>
        </div>
      </section>
      <section className="admin-panel">
        <div className="real-page-toolbar access-team-toolbar">
          <span>{copy(locale, "员工访问采用可停用的邮箱预授权，不执行不可恢复删除。", "Staff access uses reversible email pre-authorization; members are not permanently deleted.")}</span>
          <button className="admin-primary" onClick={() => setDialog({ kind: "create" })} type="button">
            <Plus size={17} aria-hidden="true" />
            {copy(locale, "添加员工", "Add staff")}
          </button>
        </div>
        <RefreshNotice
          state={resource.state}
          locale={locale}
          retry={() => void resource.reload()}
          slow={slow}
        />
        <div className="data-table team-table team-table--managed" tabIndex={0} aria-label={copy(locale, "团队成员表，可横向滚动", "Team members table, horizontally scrollable")}>
          <div className="table-head">
            <span>{copy(locale, "姓名", "Name")}</span>
            <span>{copy(locale, "邮箱", "Email")}</span>
            <span>{copy(locale, "账号状态", "Status")}</span>
            <span>{copy(locale, "角色", "Role")}</span>
            <span>{copy(locale, "最近识别", "Last identified")}</span>
            <span>{copy(locale, "操作", "Actions")}</span>
          </div>
          {data.members.map((member) => {
            const role = member.roles[0];
            const protectedOwner = role?.key === "SUPER_ADMIN";
            return (
              <div className="table-row" key={member.id}>
                <strong title={member.displayName}>{member.displayName}</strong>
                <code title={member.email}>{member.email}</code>
                <StatusPill status={member.status} locale={locale} />
                <span title={role?.name[locale]}>{role?.name[locale] ?? "—"}</span>
                <small>{member.lastLoginAt ? formatDate(member.lastLoginAt, locale) : "—"}</small>
                <span className="table-row-actions">
                  {protectedOwner ? (
                    <span className="access-owner-lock">{copy(locale, "系统保护", "Protected")}</span>
                  ) : (
                    <button
                      aria-label={copy(locale, `管理 ${member.displayName}`, `Manage ${member.displayName}`)}
                      onClick={() => setDialog({ kind: "edit", member })}
                      type="button"
                    >
                      <NotePencil size={16} aria-hidden="true" />
                      {copy(locale, "管理", "Manage")}
                    </button>
                  )}
                </span>
              </div>
            );
          })}
          {data.members.length === 0 && (
            <div className="table-empty">{copy(locale, "暂无管理员成员。", "No administrator members.")}</div>
          )}
        </div>
      </section>
      {dialog && (
        <MemberDialog
          currentUserEmail={currentUserEmail}
          locale={locale}
          member={dialog.kind === "edit" ? dialog.member : null}
          roles={data.availableRoles.filter((role) => role.assignable)}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void resource.reload();
          }}
        />
      )}
    </>
  );
}

function MemberDialog({
  currentUserEmail,
  locale,
  member,
  roles,
  onClose,
  onSaved,
}: {
  currentUserEmail: string;
  locale: Locale;
  member: AdminTeamMember | null;
  roles: AdminAccessRoleSummary[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify } = useAdminStatus();
  const initialRole = member?.roles[0]?.key === "SUPER_ADMIN"
    ? "READ_ONLY"
    : member?.roles[0]?.key ?? roles[0]?.key ?? "READ_ONLY";
  const initial = useMemo(() => ({
    displayName: member?.displayName ?? "",
    email: member?.email ?? "",
    roleKey: initialRole as AssignableAdminRoleKey,
    accessEnabled: member?.status !== "DISABLED",
    confirmationEmail: "",
    reason: "",
  }), [initialRole, member]);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useUnsavedChanges(dirty);

  const requestClose = () => {
    if (dirty && !window.confirm(copy(locale, "尚有未保存内容，确定关闭吗？", "Discard unsaved changes?"))) return;
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (member) {
        const currentRole = member.roles[0]?.key;
        const roleChanged = currentRole !== form.roleKey;
        const desiredStatus = form.accessEnabled ? "ACTIVE" : "DISABLED";
        const currentEnabled = member.status !== "DISABLED";
        await updateTeamMember(member.id, {
          expectedUpdatedAt: member.updatedAt,
          ...(roleChanged ? { roleKey: form.roleKey } : {}),
          ...(currentEnabled !== form.accessEnabled ? { status: desiredStatus } : {}),
          confirmationEmail: form.confirmationEmail.trim(),
          reason: form.reason.trim(),
        });
        notify(copy(locale, "员工访问已更新。", "Staff access updated."));
      } else {
        await createTeamMember({
          displayName: form.displayName.trim(),
          email: form.email.trim(),
          roleKey: form.roleKey,
          confirmationEmail: form.confirmationEmail.trim(),
          reason: form.reason.trim(),
        });
        notify(copy(locale, "员工邮箱已预授权，等待首次登录。", "Staff email pre-authorized and awaiting first sign-in."));
      }
      onSaved();
    } catch (requestError) {
      const message = requestError instanceof ApiError
        ? requestError.code === "ADMIN_MEMBER_EMAIL_EXISTS"
          ? copy(locale, "该邮箱已经存在。", "This email already exists.")
          : requestError.code === "OWNER_CONFIRMATION_MISMATCH"
            ? copy(locale, "身份确认邮箱与当前所有者不一致。", "The confirmation email does not match the current owner.")
            : requestError.code === "VERSION_CONFLICT"
              ? copy(locale, "员工资料已被其他管理员修改，请重新加载。", "This staff record changed elsewhere. Reload and try again.")
              : copy(locale, "员工访问未保存，请检查表单。", "Staff access was not saved. Check the form.")
        : copy(locale, "员工访问未保存。", "Staff access was not saved.");
      setError(message);
      notify(message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      closeLabel={copy(locale, "关闭", "Close")}
      onClose={requestClose}
      title={member
        ? copy(locale, `管理员工：${member.displayName}`, `Manage staff: ${member.displayName}`)
        : copy(locale, "添加员工", "Add staff")}
      wide
    >
      <form className="editor-form access-member-form" onSubmit={submit}>
        {!member && (
          <div className="form-grid two">
            <label>
              <span>{copy(locale, "员工姓名", "Staff name")}</span>
              <input required maxLength={120} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
            </label>
            <label>
              <span>{copy(locale, "ChatGPT 登录邮箱", "ChatGPT sign-in email")}</span>
              <input required maxLength={254} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </label>
          </div>
        )}
        {member && (
          <div className="channel-identity-note">
            <strong>{member.email}</strong>
            <span>{member.status === "INVITED"
              ? copy(locale, "等待首次登录", "Awaiting first sign-in")
              : member.status}</span>
          </div>
        )}
        <label>
          <span>{copy(locale, "预设角色", "Preset role")}</span>
          <select value={form.roleKey} onChange={(event) => setForm({ ...form, roleKey: event.target.value as AssignableAdminRoleKey })}>
            {roles.map((role) => (
              <option key={role.key} value={role.key}>{role.name[locale]}</option>
            ))}
          </select>
        </label>
        {member && (
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={form.accessEnabled}
              onChange={(event) => setForm({ ...form, accessEnabled: event.target.checked })}
            />
            <span>{copy(locale, "允许该员工访问后台", "Allow this staff member to access the admin")}</span>
          </label>
        )}
        <div className="access-confirmation-note" role="note">
          <WarningCircle size={19} aria-hidden="true" />
          <span>
            <strong>{copy(locale, "所有者身份确认", "Owner identity confirmation")}</strong>
            {copy(
              locale,
              `这是权限变更。CloudBridge 会在服务端重新核对当前 Sites 身份；请输入当前所有者邮箱 ${currentUserEmail}。这不是密码二次认证。`,
              `This changes access. CloudBridge rechecks the current Sites identity on the server; enter the current owner email ${currentUserEmail}. This is not password re-authentication.`,
            )}
          </span>
        </div>
        <label>
          <span>{copy(locale, "当前所有者邮箱", "Current owner email")}</span>
          <input required maxLength={254} type="email" autoComplete="off" value={form.confirmationEmail} onChange={(event) => setForm({ ...form, confirmationEmail: event.target.value })} />
        </label>
        <label>
          <span>{copy(locale, "业务原因", "Business reason")}</span>
          <textarea required minLength={8} maxLength={500} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
        </label>
        {error && <p className="form-error" role="alert"><WarningCircle size={17} />{error}</p>}
        <div className="dialog-actions">
          <button type="button" onClick={requestClose}>{copy(locale, "取消", "Cancel")}</button>
          <button className="admin-primary" disabled={busy || !dirty}>
            {busy ? copy(locale, "正在保存", "Saving") : copy(locale, "确认并保存", "Confirm and save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
