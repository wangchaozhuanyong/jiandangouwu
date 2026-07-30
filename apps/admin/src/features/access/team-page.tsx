import {
  Check,
  Key,
  ShieldCheck,
  UsersThree,
} from "@phosphor-icons/react";
import { useCallback } from "react";
import {
  getTeamOverview,
  type AdminTeamOverview,
  type Locale,
} from "../../api";
import {
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

export default function TeamPage({
  locale,
}: {
  locale: Locale;
}) {
  const loader = useCallback((signal: AbortSignal) => getTeamOverview(signal), []);
  const resource = useCachedAdminResource<AdminTeamOverview>("team", loader);
  const slow = useSlowAdminRequest(resource.state);
  if (!resource.data) {
    return <PanelState state={resource.state} locale={locale} retry={() => void resource.reload()} />;
  }
  const data = resource.data;
  return (
    <>
      <div className="access-boundary-note" role="note">
        <ShieldCheck size={19} />
        <span>
          <strong>{copy(locale, "ChatGPT 管理员边界", "ChatGPT administrator boundary")}</strong>
          {copy(
            locale,
            "成员身份由 ChatGPT 管理。CloudBridge 只读展示当前所有者，不修改平台账号、密码、双重验证或会话；成员邀请暂缓。",
            "Member identity is managed by ChatGPT. CloudBridge displays the current owner read-only and does not change platform accounts, passwords, two-step verification, or sessions; invitations are deferred.",
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
          <small>{copy(locale, "账号来源", "Account source")}</small>
          <strong>ChatGPT</strong>
        </div>
        <div>
          <span><Key size={22} /></span>
          <small>{copy(locale, "身份安全", "Identity security")}</small>
          <strong>{copy(locale, "平台管理", "Platform")}</strong>
        </div>
      </section>
      <section className="admin-panel">
        <RefreshNotice
          state={resource.state}
          locale={locale}
          retry={() => void resource.reload()}
          slow={slow}
        />
        <div className="data-table team-table" tabIndex={0} aria-label={copy(locale, "团队成员表，可横向滚动", "Team members table, horizontally scrollable")}>
          <div className="table-head">
            <span>{copy(locale, "姓名", "Name")}</span>
            <span>{copy(locale, "邮箱", "Email")}</span>
            <span>{copy(locale, "账号状态", "Status")}</span>
            <span>{copy(locale, "身份提供方", "Identity provider")}</span>
            <span>{copy(locale, "角色", "Roles")}</span>
            <span>{copy(locale, "最近识别", "Last identified")}</span>
          </div>
          {data.members.map((member) => (
            <div className="table-row" key={member.id}>
              <strong title={member.displayName}>{member.displayName}</strong>
              <code title={member.email}>{member.email}</code>
              <StatusPill status={member.status} locale={locale} />
              <span>ChatGPT</span>
              <span title={member.roles.map((role) => role.name[locale]).join("、")}>
                {member.roles.map((role) => role.name[locale]).join("、")}
              </span>
              <small>{member.lastLoginAt ? formatDate(member.lastLoginAt, locale) : "—"}</small>
            </div>
          ))}
          {data.members.length === 0 && (
            <div className="table-empty">{copy(locale, "暂无管理员成员。", "No administrator members.")}</div>
          )}
        </div>
      </section>
    </>
  );
}
