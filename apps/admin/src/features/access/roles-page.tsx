import {
  CaretRight,
  Key,
  LockKey,
  PencilSimple,
  Plus,
  ShieldCheck,
  Trash,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import {
  createRole,
  deleteRole,
  getRolesOverview,
  updateRoleMetadata,
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

type ManagementMode = "create" | "metadata" | "delete" | null;

type RoleDraft = {
  key: string;
  nameZh: string;
  nameEn: string;
  description: string;
  permissionKeys: string[];
  reason: string;
};

const blankDraft = (): RoleDraft => ({
  key: "",
  nameZh: "",
  nameEn: "",
  description: "",
  permissionKeys: [],
  reason: "",
});

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

const sortedRoles = (roles: AdminRolesOverview["roles"]): AdminRolesOverview["roles"] => (
  [...roles].sort((left, right) => left.key.localeCompare(right.key))
);

export default function RolesPage({
  locale,
  canWrite,
  sitesRuntime,
}: {
  locale: Locale;
  canWrite: boolean;
  sitesRuntime: boolean;
}) {
  const loader = useCallback((signal: AbortSignal) => getRolesOverview(signal), []);
  const { data, state, reload, commit } = useCachedAdminResource<AdminRolesOverview>("roles", loader);
  const slow = useSlowAdminRequest(state);
  const { notify } = useAdminStatus();
  const [selectedId, setSelectedId] = useState("");
  const [editingPermissions, setEditingPermissions] = useState(false);
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [permissionReason, setPermissionReason] = useState("");
  const [managementMode, setManagementMode] = useState<ManagementMode>(null);
  const [draft, setDraft] = useState<RoleDraft>(blankDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = data?.roles.find((role) => role.id === selectedId) ?? data?.roles[0] ?? null;

  const originalPermissionKeys = useMemo(
    () => selected?.permissions ?? [],
    [selected],
  );
  const metadataChanged = Boolean(
    selected
    && managementMode === "metadata"
    && (
      draft.nameZh !== selected.name.zh
      || draft.nameEn !== selected.name.en
      || draft.description !== (selected.description ?? "")
    )
  );
  const managementDirty = managementMode === "create"
    ? Boolean(
      draft.key
      || draft.nameZh
      || draft.nameEn
      || draft.description
      || draft.permissionKeys.length
      || draft.reason,
    )
    : managementMode === "metadata"
      ? metadataChanged || draft.reason.trim().length > 0
      : managementMode === "delete"
        ? draft.reason.trim().length > 0
        : false;
  const dirty = (
    editingPermissions
    && (
      !sameValues(permissionKeys, originalPermissionKeys)
      || permissionReason.trim().length > 0
    )
  ) || managementDirty;
  useAdminPageDirty(dirty);

  const confirmDiscard = (): boolean => (
    !dirty
    || window.confirm(copy(
      locale,
      "当前有未保存的角色变更，是否丢弃并继续？",
      "There are unsaved role changes. Discard them and continue?",
    ))
  );

  const resetEditors = () => {
    setEditingPermissions(false);
    setPermissionKeys([]);
    setPermissionReason("");
    setManagementMode(null);
    setDraft(blankDraft());
    setError("");
  };

  const selectRole = (roleId: string) => {
    if (busy || roleId === selected?.id || !confirmDiscard()) return;
    resetEditors();
    setSelectedId(roleId);
  };

  const beginPermissionEdit = () => {
    if (!selected || selected.systemProtected || !canWrite || !confirmDiscard()) return;
    resetEditors();
    setPermissionKeys([...selected.permissions]);
    setEditingPermissions(true);
  };

  const beginCreate = () => {
    if (!canWrite || busy || !confirmDiscard()) return;
    resetEditors();
    setManagementMode("create");
  };

  const beginMetadataEdit = () => {
    if (!selected || selected.systemProtected || !canWrite || busy || !confirmDiscard()) return;
    resetEditors();
    setDraft({
      key: selected.key,
      nameZh: selected.name.zh,
      nameEn: selected.name.en,
      description: selected.description ?? "",
      permissionKeys: [],
      reason: "",
    });
    setManagementMode("metadata");
  };

  const beginDelete = () => {
    if (
      !selected
      || selected.systemProtected
      || selected.memberCount > 0
      || !canWrite
      || busy
      || !confirmDiscard()
    ) return;
    resetEditors();
    setDraft({
      ...blankDraft(),
      key: selected.key,
      nameZh: selected.name.zh,
      nameEn: selected.name.en,
    });
    setManagementMode("delete");
  };

  const cancelEdit = () => {
    if (busy) return;
    resetEditors();
  };

  const submitPermissions = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!data || !selected || busy || selected.systemProtected) return;
    if (permissionKeys.length === 0) {
      setError(copy(locale, "角色至少需要一个权限。", "A role needs at least one permission."));
      return;
    }
    if (permissionReason.trim().length < 8) {
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
        reason: permissionReason.trim(),
      });
      commit({
        ...data,
        roles: data.roles.map((role) => role.id === updated.id ? updated : role),
      });
      invalidateAdminCache("team", "audit");
      notify(copy(locale, "角色权限已由服务器确认更新。", "Role permissions were confirmed by the server."));
      resetEditors();
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

  const submitManagement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!data || !managementMode || busy || !canWrite) return;
    if (draft.reason.trim().length < 8) {
      setError(copy(locale, "请填写至少 8 个字符的业务原因。", "Enter a business reason of at least 8 characters."));
      return;
    }

    if (managementMode === "create") {
      const key = draft.key.trim().toUpperCase();
      if (!/^[A-Z][A-Z0-9_]{2,79}$/u.test(key)) {
        setError(copy(
          locale,
          "角色键需为 3–80 位大写字母、数字或下划线，并以字母开头。",
          "The role key must be 3–80 uppercase letters, numbers, or underscores and start with a letter.",
        ));
        return;
      }
      if (draft.nameZh.trim().length < 2 || draft.nameEn.trim().length < 2) {
        setError(copy(locale, "中英文角色名称都至少需要 2 个字符。", "Both role names need at least 2 characters."));
        return;
      }
      if (draft.permissionKeys.length === 0) {
        setError(copy(locale, "新角色至少需要一个权限。", "A new role needs at least one permission."));
        return;
      }
      if (!window.confirm(copy(
        locale,
        `确认创建角色“${draft.nameZh.trim()}”（${key}）？`,
        `Create the role “${draft.nameEn.trim()}” (${key})?`,
      ))) return;

      setBusy(true);
      setError("");
      try {
        const created = await createRole({
          key,
          nameZh: draft.nameZh.trim(),
          nameEn: draft.nameEn.trim(),
          description: draft.description.trim(),
          permissionKeys: draft.permissionKeys,
          reason: draft.reason.trim(),
        });
        commit({ ...data, roles: sortedRoles([...data.roles, created]) });
        setSelectedId(created.id);
        invalidateAdminCache("team", "audit");
        notify(copy(locale, "新角色已由服务器创建。", "The new role was created by the server."));
        resetEditors();
      } catch {
        setError(copy(
          locale,
          "创建失败。请检查角色键是否重复、权限和最近认证是否仍然有效。",
          "Creation failed. Check for a duplicate key and confirm permissions and recent authentication.",
        ));
        notify(copy(locale, "角色未创建。", "The role was not created."), "error");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!selected || selected.systemProtected) return;
    if (managementMode === "metadata") {
      if (draft.nameZh.trim().length < 2 || draft.nameEn.trim().length < 2) {
        setError(copy(locale, "中英文角色名称都至少需要 2 个字符。", "Both role names need at least 2 characters."));
        return;
      }
      if (!metadataChanged) {
        setError(copy(locale, "角色名称和说明没有变化。", "The role names and description have not changed."));
        return;
      }
      if (!window.confirm(copy(
        locale,
        `确认更新“${selected.name[locale]}”的名称与说明？角色键保持不变。`,
        `Update the names and description for “${selected.name[locale]}”? The role key remains unchanged.`,
      ))) return;

      setBusy(true);
      setError("");
      try {
        const updated = await updateRoleMetadata(selected.id, {
          nameZh: draft.nameZh.trim(),
          nameEn: draft.nameEn.trim(),
          description: draft.description.trim(),
          expectedUpdatedAt: selected.updatedAt,
          reason: draft.reason.trim(),
        });
        commit({
          ...data,
          roles: data.roles.map((role) => role.id === updated.id ? updated : role),
        });
        invalidateAdminCache("team", "audit");
        notify(copy(locale, "角色资料已由服务器确认更新。", "Role metadata was confirmed by the server."));
        resetEditors();
      } catch {
        setError(copy(
          locale,
          "更新失败。可能是最近认证已过期、权限不足或角色已被其他管理员修改。",
          "Update failed. Reauthentication may have expired, permission may be missing, or another administrator changed the role.",
        ));
        notify(copy(locale, "角色资料未更新。", "Role metadata was not updated."), "error");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (selected.memberCount > 0) {
      setError(copy(locale, "请先把全部成员移出该角色。", "Remove every member from this role first."));
      return;
    }
    if (!window.confirm(copy(
      locale,
      `确认永久删除空角色“${selected.name[locale]}”（${selected.key}）？此操作不能撤销。`,
      `Permanently delete the empty role “${selected.name[locale]}” (${selected.key})? This cannot be undone.`,
    ))) return;

    setBusy(true);
    setError("");
    try {
      await deleteRole(selected.id, {
        expectedUpdatedAt: selected.updatedAt,
        reason: draft.reason.trim(),
      });
      const remaining = data.roles.filter((role) => role.id !== selected.id);
      commit({ ...data, roles: remaining });
      setSelectedId(remaining[0]?.id ?? "");
      invalidateAdminCache("team", "audit");
      notify(copy(locale, "空角色已由服务器删除。", "The empty role was deleted by the server."));
      resetEditors();
    } catch {
      setError(copy(
        locale,
        "删除失败。请确认角色仍为空、最近认证有效且角色没有被其他管理员修改。",
        "Deletion failed. Confirm the role is still empty, reauthentication is valid, and no other administrator changed it.",
      ));
      notify(copy(locale, "角色未删除。", "The role was not deleted."), "error");
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return <PanelState state={state} locale={locale} retry={() => void reload()} />;
  }

  const managementTitle = managementMode === "create"
    ? copy(locale, "创建自定义角色", "Create custom role")
    : managementMode === "metadata"
      ? copy(locale, "编辑角色资料", "Edit role metadata")
      : copy(locale, "删除空角色", "Delete empty role");

  return (
    <>
      <div className="access-boundary-note" role="note">
        <ShieldCheck size={19} />
        <span>
          <strong>
            {sitesRuntime
              ? copy(locale, "ChatGPT 平台角色边界", "ChatGPT platform role boundary")
              : copy(locale, "真实角色生命周期", "Live role lifecycle")}
          </strong>
          {sitesRuntime
            ? copy(
              locale,
              "当前 Sites 管理员与权限由 ChatGPT 管理；CloudBridge 只读展示，不创建、编辑或删除平台角色。",
              "Sites administrators and permissions are managed by ChatGPT. CloudBridge is read-only and does not create, edit, or delete platform roles.",
            )
            : copy(
              locale,
              "角色、权限和成员数量读取 MySQL；创建、资料修改、权限修改和空角色删除都需要最近认证、并发保护和事务审计。",
              "Roles, permissions, and member counts come from MySQL. Creation, metadata changes, permission changes, and empty-role deletion require recent authentication, concurrency protection, and transactional audit.",
            )}
        </span>
      </div>
      <RefreshNotice state={state} locale={locale} retry={() => void reload()} slow={slow} />
      <div className="design-role-layout access-role-layout">
        <section className="admin-panel design-role-list">
          <div className="access-role-list-toolbar">
            <span>
              <small>{copy(locale, "角色数量", "Roles")}</small>
              <strong>{data.roles.length}</strong>
            </span>
            <button
              className="admin-primary"
              disabled={!canWrite || busy}
              onClick={beginCreate}
              type="button"
            >
              <Plus />
              {copy(locale, "新建角色", "New role")}
            </button>
          </div>
          {data.roles.length === 0 && (
            <div className="table-empty">{copy(locale, "暂无角色。", "No roles.")}</div>
          )}
          {data.roles.map((role, index) => (
            <button
              className={selected?.id === role.id ? "is-selected" : ""}
              onClick={() => selectRole(role.id)}
              key={role.id}
              type="button"
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
            <div className="access-role-header">
              <span>
                <small>{copy(locale, "当前角色", "Selected role")}</small>
                <h2>{selected.name[locale]}</h2>
                <p>{selected.description ?? copy(locale, "暂无角色说明。", "No role description.")}</p>
              </span>
              <div className="access-role-header-actions">
                <button
                  className="admin-primary"
                  disabled={!canWrite || selected.systemProtected || editingPermissions || busy}
                  onClick={beginPermissionEdit}
                  type="button"
                >
                  {selected.systemProtected ? <LockKey /> : <Key />}
                  {selected.systemProtected
                    ? copy(locale, "系统保护", "System protected")
                    : copy(locale, "编辑权限", "Edit permissions")}
                </button>
                <button
                  disabled={!canWrite || selected.systemProtected || busy}
                  onClick={beginMetadataEdit}
                  type="button"
                >
                  <PencilSimple />
                  {copy(locale, "编辑资料", "Edit details")}
                </button>
                <button
                  className="admin-danger"
                  disabled={!canWrite || selected.systemProtected || selected.memberCount > 0 || busy}
                  onClick={beginDelete}
                  title={selected.memberCount > 0
                    ? copy(locale, "请先移出角色内全部成员", "Remove all members from the role first")
                    : undefined}
                  type="button"
                >
                  <Trash />
                  {copy(locale, "删除空角色", "Delete empty role")}
                </button>
              </div>
            </div>
            <aside>
              <span>{copy(locale, "成员数量", "Members")}</span>
              <strong>{selected.memberCount}</strong>
            </aside>
            <form onSubmit={(event) => void submitPermissions(event)}>
              <fieldset disabled={!editingPermissions || busy}>
                <legend>{copy(locale, "权限矩阵", "Permission matrix")}</legend>
                <div className="access-permission-grid">
                  {data.permissions.map((permission) => {
                    const allowed = editingPermissions
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
              {editingPermissions && (
                <>
                  <label className="access-reason">
                    <span>{copy(locale, "变更原因", "Change reason")}</span>
                    <textarea
                      value={permissionReason}
                      onChange={(event) => setPermissionReason(event.target.value)}
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
      {managementMode && (
        <section className="admin-panel access-editor role-management-editor">
          <div className="panel-heading">
            <div>
              <small>{copy(locale, "受保护操作", "Protected operation")}</small>
              <h2>{managementTitle}</h2>
              <p>
                {managementMode === "delete"
                  ? copy(
                    locale,
                    "仅允许删除没有成员的非系统角色；删除会同时移除该角色的权限关系并写入审计。",
                    "Only empty non-system roles can be deleted. Deletion also removes the role's permission links and writes an audit event.",
                  )
                  : copy(
                    locale,
                    "角色键创建后保持不可变；中英文名称、说明和权限都由服务器验证。",
                    "The role key remains immutable after creation. Both names, the description, and permissions are validated by the server.",
                  )}
              </p>
            </div>
          </div>
          <form onSubmit={(event) => void submitManagement(event)}>
            {managementMode !== "delete" && (
              <>
                <div className="role-metadata-grid">
                  <label>
                    <span>{copy(locale, "角色键", "Role key")}</span>
                    <input
                      value={draft.key}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        key: event.target.value.toUpperCase(),
                      }))}
                      minLength={3}
                      maxLength={80}
                      pattern="[A-Z][A-Z0-9_]{2,79}"
                      disabled={managementMode === "metadata" || busy}
                      placeholder="ORDER_REVIEWER"
                      required
                    />
                  </label>
                  <label>
                    <span>{copy(locale, "中文名称", "Chinese name")}</span>
                    <input
                      value={draft.nameZh}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        nameZh: event.target.value,
                      }))}
                      minLength={2}
                      maxLength={120}
                      disabled={busy}
                      required
                    />
                  </label>
                  <label>
                    <span>{copy(locale, "英文名称", "English name")}</span>
                    <input
                      value={draft.nameEn}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        nameEn: event.target.value,
                      }))}
                      minLength={2}
                      maxLength={120}
                      disabled={busy}
                      required
                    />
                  </label>
                  <label className="is-wide">
                    <span>{copy(locale, "角色说明", "Role description")}</span>
                    <textarea
                      value={draft.description}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))}
                      maxLength={500}
                      disabled={busy}
                      placeholder={copy(locale, "可选，说明该角色的职责边界", "Optional: describe the role's responsibility boundary")}
                    />
                  </label>
                </div>
                {managementMode === "create" && (
                  <fieldset disabled={busy}>
                    <legend>{copy(locale, "初始权限", "Initial permissions")}</legend>
                    <div className="access-permission-grid">
                      {data.permissions.map((permission) => (
                        <label key={permission.key}>
                          <input
                            type="checkbox"
                            checked={draft.permissionKeys.includes(permission.key)}
                            onChange={(event) => setDraft((current) => ({
                              ...current,
                              permissionKeys: event.target.checked
                                ? [...current.permissionKeys, permission.key]
                                : current.permissionKeys.filter((key) => key !== permission.key),
                            }))}
                          />
                          <span>
                            <strong>{permissionLabels[permission.key]?.[locale] ?? permission.key}</strong>
                            <small>{permission.key}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
              </>
            )}
            {managementMode === "delete" && selected && (
              <div className="role-delete-impact" role="note">
                <WarningCircle />
                <span>
                  <strong>{selected.name[locale]}</strong>
                  <code>{selected.key}</code>
                  <small>
                    {copy(
                      locale,
                      `当前成员 ${selected.memberCount} 人 · 权限 ${selected.permissions.length} 项`,
                      `${selected.memberCount} current members · ${selected.permissions.length} permissions`,
                    )}
                  </small>
                </span>
              </div>
            )}
            <label className="access-reason">
              <span>{copy(locale, "业务原因", "Business reason")}</span>
              <textarea
                value={draft.reason}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  reason: event.target.value,
                }))}
                minLength={8}
                maxLength={500}
                disabled={busy}
                placeholder={copy(locale, "说明本次角色操作的业务依据", "Explain the business basis for this role operation")}
                required
              />
            </label>
            {error && <p className="form-error" role="alert"><WarningCircle />{error}</p>}
            <div className="access-editor-actions">
              <button type="button" disabled={busy} onClick={cancelEdit}>{copy(locale, "取消", "Cancel")}</button>
              <button
                className={managementMode === "delete" ? "admin-danger" : "admin-primary"}
                disabled={busy}
              >
                {busy
                  ? copy(locale, "正在提交", "Submitting")
                  : managementMode === "create"
                    ? copy(locale, "确认创建角色", "Confirm role creation")
                    : managementMode === "metadata"
                      ? copy(locale, "确认资料变更", "Confirm metadata change")
                      : copy(locale, "确认永久删除", "Confirm permanent deletion")}
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
