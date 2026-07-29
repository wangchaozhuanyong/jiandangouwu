import {
  CaretRight,
  Key,
  LockKey,
  ShieldCheck,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import {
  getRolesOverview,
  updateRolePermissions,
  type AdminRolesOverview,
  type Locale,
} from "../../api";
import {
  invalidateAdminCache,
  useAdminPageDirty,
  useAdminStatus,
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../../admin-experience";
import { PanelState, RefreshNotice } from "../../admin-ui";

const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

const permissionLabels: Record<string, { zh: string; en: string }> = {
  "catalog.read": { zh: "查看商品与分类", en: "View catalog" },
  "catalog.write": { zh: "编辑商品与分类", en: "Edit catalog" },
  "orders.read": { zh: "查看订单", en: "View orders" },
  "orders.write": { zh: "处理订单", en: "Manage orders" },
  "contacts.reveal": { zh: "揭示完整联系方式", en: "Reveal full contacts" },
  "currencies.write": { zh: "修改汇率", en: "Update exchange rates" },
  "team.manage": { zh: "管理团队成员", en: "Manage team members" },
  "roles.manage": { zh: "管理角色权限", en: "Manage roles and permissions" },
  "audit.read": { zh: "查看审计日志", en: "View audit logs" },
  "content.read": { zh: "查看展示内容", en: "View storefront content" },
  "content.write": { zh: "编辑展示内容", en: "Edit storefront content" },
  "support.read": { zh: "查看客服渠道", en: "View support channels" },
  "support.write": { zh: "编辑客服渠道", en: "Edit support channels" },
  "settings.read": { zh: "查看网站设置", en: "View site settings" },
  "settings.write": { zh: "修改网站设置", en: "Edit site settings" },
};

const sameValues = (left: string[], right: string[]): boolean => {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
};

export default function RolesPage({
  locale,
  canWrite,
}: {
  locale: Locale;
  canWrite: boolean;
}) {
  const loader = useCallback((signal: AbortSignal) => getRolesOverview(signal), []);
  const { data, state, reload, commit } = useCachedAdminResource<AdminRolesOverview>("roles", loader);
  const slow = useSlowAdminRequest(state);
  const { notify } = useAdminStatus();
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(false);
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = data?.roles.find((role) => role.id === selectedId) ?? data?.roles[0] ?? null;

  const originalPermissionKeys = useMemo(
    () => selected?.permissions ?? [],
    [selected],
  );
  const dirty = editing && (
    !sameValues(permissionKeys, originalPermissionKeys) || reason.trim().length > 0
  );
  useAdminPageDirty(dirty);

  const selectRole = (roleId: string) => {
    if (busy || roleId === selected?.id) return;
    if (
      dirty
      && !window.confirm(copy(
        locale,
        "切换角色会丢弃当前未保存的权限变更，是否继续？",
        "Switching roles discards the current unsaved permission changes. Continue?",
      ))
    ) return;
    setSelectedId(roleId);
    setEditing(false);
    setPermissionKeys([]);
    setReason("");
    setError("");
  };

  const beginEdit = () => {
    if (!selected || selected.systemProtected || !canWrite) return;
    setPermissionKeys([...selected.permissions]);
    setReason("");
    setError("");
    setEditing(true);
  };

  const cancelEdit = () => {
    if (busy) return;
    setEditing(false);
    setPermissionKeys([]);
    setReason("");
    setError("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!data || !selected || busy || selected.systemProtected) return;
    if (permissionKeys.length === 0) {
      setError(copy(locale, "角色至少需要一个权限。", "A role needs at least one permission."));
      return;
    }
    if (reason.trim().length < 8) {
      setError(copy(locale, "请填写至少 8 个字符的变更原因。", "Enter a reason of at least 8 characters."));
      return;
    }
    if (sameValues(permissionKeys, originalPermissionKeys)) {
      setError(copy(locale, "权限没有变化。", "Permissions have not changed."));
      return;
    }
    if (!window.confirm(copy(
      locale,
      `确认修改“${selected.name[locale]}”的权限？受影响成员的下一次请求将立即使用新权限。`,
      `Change permissions for “${selected.name[locale]}”? Affected members use the new permissions on their next request.`,
    ))) return;

    setBusy(true);
    setError("");
    try {
      const updated = await updateRolePermissions(selected.id, {
        permissionKeys,
        expectedUpdatedAt: selected.updatedAt,
        reason: reason.trim(),
      });
      commit({
        ...data,
        roles: data.roles.map((role) => role.id === updated.id ? updated : role),
      });
      invalidateAdminCache("team", "audit");
      notify(copy(locale, "角色权限已由服务器确认更新。", "Role permissions were confirmed by the server."));
      setEditing(false);
      setPermissionKeys([]);
      setReason("");
      setError("");
    } catch {
      setError(copy(
        locale,
        "保存失败。可能是最近认证已过期、权限不足或角色已被其他管理员修改。",
        "Save failed. Reauthentication may have expired, permission may be missing, or another administrator changed the role.",
      ));
      notify(copy(locale, "角色权限未更新。", "Role permissions were not updated."), "error");
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
          <strong>{copy(locale, "真实角色权限矩阵", "Live role permission matrix")}</strong>
          {copy(
            locale,
            "角色与权限读取平台数据库；修改需要最近认证、并发校验和事务审计。超级管理员角色不可降权，角色新建与删除尚未接入。",
            "Roles and permissions come from the platform database. Changes require recent authentication, concurrency checks, and transactional audit. The super admin role cannot be reduced; role creation and deletion are not connected yet.",
          )}
        </span>
      </div>
      <RefreshNotice state={state} locale={locale} retry={() => void reload()} slow={slow} />
      <div className="design-role-layout access-role-layout">
        <section className="admin-panel design-role-list">
          {data.roles.length === 0 && (
            <div className="table-empty">{copy(locale, "暂无角色。", "No roles.")}</div>
          )}
          {data.roles.map((role, index) => (
            <button
              className={selected?.id === role.id ? "is-selected" : ""}
              onClick={() => selectRole(role.id)}
              key={role.id}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{role.name[locale]}</strong>
                <small>{role.key}</small>
              </div>
              <em><UsersThree size={15} />{role.memberCount}</em>
              <CaretRight size={16} />
            </button>
          ))}
        </section>
        {selected && (
          <section className="admin-panel design-permission-panel access-permission-panel">
            <div>
              <small>{copy(locale, "当前角色", "Selected role")}</small>
              <h2>{selected.name[locale]}</h2>
              <p>{selected.description ?? copy(locale, "暂无角色说明。", "No role description.")}</p>
              <button
                className="admin-primary"
                disabled={!canWrite || selected.systemProtected || editing}
                onClick={beginEdit}
              >
                {selected.systemProtected ? <LockKey /> : <Key />}
                {selected.systemProtected
                  ? copy(locale, "系统保护", "System protected")
                  : copy(locale, "编辑权限", "Edit permissions")}
              </button>
            </div>
            <aside>
              <span>{copy(locale, "成员数量", "Members")}</span>
              <strong>{selected.memberCount}</strong>
            </aside>
            <form onSubmit={(event) => void submit(event)}>
              <fieldset disabled={!editing || busy}>
                <legend>{copy(locale, "权限矩阵", "Permission matrix")}</legend>
                <div className="access-permission-grid">
                  {data.permissions.map((permission) => {
                    const allowed = editing
                      ? permissionKeys.includes(permission.key)
                      : selected.permissions.includes(permission.key);
                    return (
                      <label key={permission.key}>
                        <input
                          type="checkbox"
                          checked={allowed}
                          onChange={(event) => setPermissionKeys((current) => event.target.checked
                            ? [...current, permission.key]
                            : current.filter((key) => key !== permission.key))}
                        />
                        <span>
                          <strong>{permissionLabels[permission.key]?.[locale] ?? permission.key}</strong>
                          <small>{permission.key}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {editing && (
                <>
                  <label className="access-reason">
                    <span>{copy(locale, "变更原因", "Change reason")}</span>
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      minLength={8}
                      maxLength={500}
                      placeholder={copy(locale, "说明权限调整的业务依据", "Explain the business basis for this permission change")}
                      required
                    />
                  </label>
                  {error && <p className="form-error" role="alert"><WarningCircle />{error}</p>}
                  <div className="access-editor-actions">
                    <button type="button" disabled={busy} onClick={cancelEdit}>{copy(locale, "取消", "Cancel")}</button>
                    <button className="admin-primary" disabled={busy || permissionKeys.length === 0}>
                      {busy ? copy(locale, "正在保存", "Saving") : copy(locale, "确认权限变更", "Confirm permission change")}
                    </button>
                  </div>
                </>
              )}
            </form>
          </section>
        )}
      </div>
    </>
  );
}
