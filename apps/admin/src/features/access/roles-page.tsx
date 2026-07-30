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
          <strong>{copy(locale, "邮箱预授权，不发送邀请邮件", "Email pre-authorization, without invitation email")}</strong>
          {copy(
            locale,
            "角色决定员工登录 CloudBridge 后能看到和操作的内容。只有预授权邮箱通过同一邮箱登录 ChatGPT 后，账户才会首次激活。",
            "Roles control what staff can see and do after signing in to CloudBridge. A pre-authorized account activates only after the same email signs in through ChatGPT.",
          )}
        </span>
      </div>
      <RefreshNotice
        state={resource.state}
        locale={locale}
        retry={() => void resource.reload()}
        slow={slow}
      />
      <div className="access-role-card-grid">
        {data.roles.map((role) => (
          <button
            className={`admin-panel access-role-card${selected?.id === role.id ? " is-selected" : ""}`}
            key={role.id}
            onClick={() => setSelectedId(role.id)}
            type="button"
          >
            <span className="access-role-card-heading">
              <span>
                <strong>{role.name[locale]}</strong>
                <small>{role.description[locale]}</small>
              </span>
              <b>{role.memberCount}</b>
            </span>
            <span className="access-role-card-summary">
              <span>
                <small>{copy(locale, "能做什么", "Can do")}</small>
                {role.capabilities.slice(0, 2).map((item) => <span key={item.en}>✓ {item[locale]}</span>)}
              </span>
              <span>
                <small>{copy(locale, "不能做什么", "Cannot do")}</small>
                {role.restrictions.slice(0, 2).map((item) => <span key={item.en}>— {item[locale]}</span>)}
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="design-role-layout access-role-layout">
        <section className="admin-panel access-role-detail">
          {selected
            ? (
                <>
                  <div className="panel-heading">
                    <div><h2>{selected.name[locale]}</h2><p>{selected.description[locale]}</p></div>
                    <span className="access-role-member-count">
                      <strong>{selected.memberCount}</strong>
                      <small>{copy(locale, "位成员", "members")}</small>
                    </span>
                  </div>
                  <div className="access-role-explanation-grid">
                    <section>
                      <h3>{copy(locale, "能做什么", "What this role can do")}</h3>
                      <ul>{selected.capabilities.map((item) => <li key={item.en}>{item[locale]}</li>)}</ul>
                    </section>
                    <section>
                      <h3>{copy(locale, "限制", "Restrictions")}</h3>
                      <ul>{selected.restrictions.map((item) => <li key={item.en}>{item[locale]}</li>)}</ul>
                    </section>
                  </div>
                  <details className="access-technical-details">
                    <summary>{copy(locale, `技术权限详情（${selected.permissions.length} 项）`, `Technical permissions (${selected.permissions.length})`)}</summary>
                    <div className="access-permission-grid">
                      {selected.permissions.map((permission) => <code key={permission}>{permission}</code>)}
                    </div>
                  </details>
                </>
              )
            : <PanelState state="empty" locale={locale} retry={() => void resource.reload()} />}
        </section>
      </div>
    </>
  );
}
