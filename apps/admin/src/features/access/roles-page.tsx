import { ShieldCheck } from "@phosphor-icons/react";
import {
  useCallback,
  useState,
} from "react";
import {
  getRolesOverview,
  type AdminRolesOverview,
  type Locale,
} from "../../api";
import {
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../../admin-experience";
import {
  PanelState,
  RefreshNotice,
  StatusPill,
} from "../../admin-ui";

const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

export default function RolesPage({
  locale,
}: {
  locale: Locale;
}) {
  const loader = useCallback((signal: AbortSignal) => getRolesOverview(signal), []);
  const resource = useCachedAdminResource<AdminRolesOverview>("roles", loader);
  const slow = useSlowAdminRequest(resource.state);
  const [selectedId, setSelectedId] = useState("");
  if (!resource.data) {
    return <PanelState state={resource.state} locale={locale} retry={() => void resource.reload()} />;
  }
  const data = resource.data;
  const selected = data.roles.find((role) => role.id === selectedId) ?? data.roles[0] ?? null;
  return (
    <>
      <div className="access-boundary-note" role="note">
        <ShieldCheck size={19} />
        <span>
          <strong>{copy(locale, "ChatGPT 平台角色边界", "ChatGPT platform role boundary")}</strong>
          {copy(
            locale,
            "Sites 管理员与权限由 ChatGPT 管理；本页只读展示当前身份投影，不创建、编辑或删除平台角色。",
            "Sites administrators and permissions are managed by ChatGPT. This page only displays the current identity projection and does not create, edit, or delete platform roles.",
          )}
        </span>
      </div>
      <RefreshNotice
        state={resource.state}
        locale={locale}
        retry={() => void resource.reload()}
        slow={slow}
      />
      <div className="design-role-layout access-role-layout">
        <section className="admin-panel design-role-list">
          <div className="access-role-list-toolbar">
            <span>
              <small>{copy(locale, "角色数量", "Roles")}</small>
              <strong>{data.roles.length}</strong>
            </span>
          </div>
          {data.roles.map((role) => (
            <button
              className={selected?.id === role.id ? "is-selected" : ""}
              key={role.id}
              onClick={() => setSelectedId(role.id)}
              type="button"
            >
              <span><strong>{role.name[locale]}</strong><small>{role.key}</small></span>
              <StatusPill status="PLATFORM_MANAGED" locale={locale} />
            </button>
          ))}
        </section>
        <section className="admin-panel access-role-detail">
          {selected
            ? (
                <>
                  <div className="panel-heading">
                    <div><h2>{selected.name[locale]}</h2><p>{selected.description ?? "—"}</p></div>
                    <StatusPill status="READ_ONLY" locale={locale} />
                  </div>
                  <dl>
                    <div><dt>{copy(locale, "角色键", "Role key")}</dt><dd><code>{selected.key}</code></dd></div>
                    <div><dt>{copy(locale, "成员数", "Members")}</dt><dd>{selected.memberCount}</dd></div>
                    <div><dt>{copy(locale, "权限数", "Permissions")}</dt><dd>{selected.permissions.length}</dd></div>
                  </dl>
                  <div className="access-permission-grid">
                    {selected.permissions.map((permission) => <code key={permission}>{permission}</code>)}
                  </div>
                </>
              )
            : <PanelState state="empty" locale={locale} retry={() => void resource.reload()} />}
        </section>
      </div>
    </>
  );
}
