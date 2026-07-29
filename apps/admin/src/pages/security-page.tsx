import {
  ArrowsClockwise,
  Browsers,
  Key,
  LockKey,
  ShieldCheck,
  SignOut,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import {
  beginTotpEnrollment,
  disableTotp,
  getAdminSessions,
  revokeAdminSession,
  revokeOtherAdminSessions,
  verifyTotpEnrollment,
  type AdminSessionOverview,
  type AdminUser,
  type Locale,
} from "../api";
import {
  invalidateAdminCache,
  useAdminStatus,
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../admin-experience";
import {
  formatDate,
  PanelState,
  RefreshNotice,
  StatusPill,
} from "../admin-ui";
import { adminCopy } from "../i18n";

export default function SecurityPage({
  locale,
  user,
  onChanged,
}: {
  locale: Locale;
  user: AdminUser;
  onChanged: () => Promise<void>;
}) {
  if (user.authProvider === "SITES") {
    return <SitesSecurityPage locale={locale} user={user} />;
  }
  return <PasswordSecurityPage locale={locale} user={user} onChanged={onChanged} />;
}

function SitesSecurityPage({
  locale,
  user,
}: {
  locale: Locale;
  user: AdminUser;
}) {
  return (
    <div className="security-grid">
      <section className="admin-panel security-card">
        <span><ShieldCheck size={28} /></span>
        <div>
          <h2>{locale === "zh" ? "ChatGPT 管理员登录" : "ChatGPT administrator sign-in"}</h2>
          <strong>{locale === "zh" ? "由 Sites 统一保护" : "Protected by Sites"}</strong>
        </div>
        <StatusPill status="ACTIVE" locale={locale} />
      </section>
      <section className="admin-panel security-setup">
        <div className="panel-heading">
          <h2>{locale === "zh" ? "当前管理身份" : "Current administrator identity"}</h2>
          <StatusPill status="ACTIVE" locale={locale} />
        </div>
        <dl className="sites-security-facts">
          <div><dt>{locale === "zh" ? "姓名" : "Name"}</dt><dd>{user.displayName}</dd></div>
          <div><dt>{locale === "zh" ? "邮箱" : "Email"}</dt><dd>{user.email}</dd></div>
          <div><dt>{locale === "zh" ? "登录提供方" : "Identity provider"}</dt><dd>ChatGPT</dd></div>
          <div><dt>{locale === "zh" ? "本站密码" : "Site password"}</dt><dd>{locale === "zh" ? "不保存" : "Not stored"}</dd></div>
        </dl>
        <p className="sites-security-note">
          <LockKey size={18} aria-hidden="true" />
          {locale === "zh"
            ? "商城前台没有顾客账号和登录入口。这里的登录只用于保护商品、订单、设置和审计数据。"
            : "The storefront has no customer account or sign-in. Authentication here only protects catalog, order, settings, and audit data."}
        </p>
      </section>
      <section className="admin-panel security-provider-boundary">
        <span><Key size={25} /></span>
        <div>
          <small>{locale === "zh" ? "真实安全边界" : "LIVE SECURITY BOUNDARY"}</small>
          <h2>{locale === "zh" ? "密码与双重验证由 ChatGPT 管理" : "Password and two-step verification are managed by ChatGPT"}</h2>
          <p>
            {locale === "zh"
              ? "CloudBridge 不重复保存密码、动态码或浏览器会话列表；退出操作会交回 Sites 登录系统。"
              : "CloudBridge does not duplicate passwords, one-time codes, or browser-session lists. Sign-out returns control to Sites authentication."}
          </p>
        </div>
      </section>
    </div>
  );
}

function PasswordSecurityPage({
  locale,
  user,
  onChanged,
}: {
  locale: Locale;
  user: AdminUser;
  onChanged: () => Promise<void>;
}) {
  const t = adminCopy[locale];
  const { notify } = useAdminStatus();
  const [enrollment, setEnrollment] = useState<{ flowId: string; secret: string; uri: string } | null>(null);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const begin = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setEnrollment(await beginTotpEnrollment());
    } catch {
      setError(t.securityError as string);
      notify(t.securityError as string, "error");
    } finally {
      setBusy(false);
    }
  };

  const finishEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!enrollment || busy) return;
    setBusy(true);
    setError("");
    try {
      await verifyTotpEnrollment(enrollment.flowId, token);
      setEnrollment(null);
      setToken("");
      invalidateAdminCache("audit");
      notify(locale === "zh" ? "双重验证已开启。" : "Two-factor authentication is enabled.");
      await onChanged();
    } catch {
      setError(t.securityError as string);
      notify(t.securityError as string, "error");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await disableTotp(password);
      setPassword("");
      invalidateAdminCache("audit");
      notify(locale === "zh" ? "双重验证已关闭。" : "Two-factor authentication is disabled.");
      await onChanged();
    } catch {
      setError(t.securityError as string);
      notify(t.securityError as string, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="security-grid">
      <section className="admin-panel security-card">
        <span>{user.totpEnabled ? <ShieldCheck size={28} /> : <LockKey size={28} />}</span>
        <div>
          <h2>{t.totpTitle as string}</h2>
          <strong>{user.totpEnabled
            ? locale === "zh" ? "登录时需要密码和动态码" : "Password and code required at sign-in"
            : locale === "zh" ? "默认关闭" : "Off by default"}</strong>
        </div>
        <StatusPill status={user.totpEnabled ? "ACTIVE" : "INACTIVE"} locale={locale} />
      </section>

      <section className="admin-panel security-setup">
        <div className="panel-heading">
          <h2>{user.totpEnabled ? t.disable2fa as string : t.beginSetup as string}</h2>
          <StatusPill status={user.totpEnabled ? "ACTIVE" : "INACTIVE"} locale={locale} />
        </div>
        <p>{user.totpEnabled ? t.disable2faBody as string : t.totpBody as string}</p>

        {!user.totpEnabled && !enrollment && (
          <button className="admin-primary" disabled={busy} onClick={() => void begin()}>
            <Key />
            {busy ? t.submitting as string : t.beginSetup as string}
          </button>
        )}

        {!user.totpEnabled && enrollment && (
          <form className="totp-enrollment" onSubmit={finishEnrollment}>
            <label>
              <span>{t.authenticatorSecret as string}</span>
              <code>{enrollment.secret}</code>
            </label>
            <label>
              <span>{t.totpCode as string}</span>
              <input value={token} onChange={(event) => setToken(event.target.value.replace(/\D/gu, ""))} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" minLength={6} maxLength={6} required />
            </label>
            <button className="admin-primary" disabled={busy}>{busy ? t.submitting as string : t.verify as string}</button>
          </form>
        )}

        {user.totpEnabled && (
          <form className="totp-disable" onSubmit={turnOff}>
            <label>
              <span>{t.currentPassword as string}</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" maxLength={128} required />
            </label>
            <button className="admin-danger" disabled={busy}>{busy ? t.submitting as string : t.disable2fa as string}</button>
          </form>
        )}

        {error && <p className="form-error" role="alert"><WarningCircle />{error}</p>}
      </section>
      <SessionWorkbench locale={locale} />
    </div>
  );
}

function SessionWorkbench({ locale }: { locale: Locale }) {
  const { notify } = useAdminStatus();
  const loader = useCallback((signal: AbortSignal) => getAdminSessions(signal), []);
  const {
    data,
    state,
    reload,
    commit,
  } = useCachedAdminResource<AdminSessionOverview>("security-sessions", loader);
  const slow = useSlowAdminRequest(state);
  const [revoking, setRevoking] = useState("");
  const [error, setError] = useState("");
  const otherSessionCount = data?.sessions.filter((session) => !session.current).length ?? 0;

  const revokeOne = async (sessionId: string) => {
    if (!data || revoking) return;
    if (!window.confirm(
      locale === "zh"
        ? "撤销后，该浏览器中的后台登录会立即失效。确定继续吗？"
        : "Revoking this session immediately signs that browser out. Continue?",
    )) return;
    setRevoking(sessionId);
    setError("");
    try {
      await revokeAdminSession(sessionId);
      commit({
        ...data,
        sessions: data.sessions.filter((session) => session.id !== sessionId),
      });
      invalidateAdminCache("audit");
      notify(locale === "zh" ? "会话已撤销。" : "Session revoked.");
    } catch {
      const message = locale === "zh"
        ? "会话撤销失败，真实服务器状态没有改变。"
        : "Session revocation failed. Server state was not changed.";
      setError(message);
      notify(message, "error");
    } finally {
      setRevoking("");
    }
  };

  const revokeOthers = async () => {
    if (!data || revoking || otherSessionCount === 0) return;
    if (!window.confirm(
      locale === "zh"
        ? `将撤销另外 ${otherSessionCount} 个后台会话，并保留当前会话。确定继续吗？`
        : `Revoke ${otherSessionCount} other admin session(s) and keep this session?`,
    )) return;
    setRevoking("others");
    setError("");
    try {
      const result = await revokeOtherAdminSessions();
      commit({
        ...data,
        sessions: data.sessions.filter((session) => session.current),
      });
      invalidateAdminCache("audit");
      notify(
        locale === "zh"
          ? `已撤销 ${result.revokedCount} 个其他会话。`
          : `${result.revokedCount} other session(s) revoked.`,
      );
    } catch {
      const message = locale === "zh"
        ? "其他会话撤销失败，真实服务器状态没有改变。"
        : "Other-session revocation failed. Server state was not changed.";
      setError(message);
      notify(message, "error");
    } finally {
      setRevoking("");
    }
  };

  return (
    <section className="admin-panel security-sessions-panel">
      <div className="panel-heading">
        <div>
          <small>{locale === "zh" ? "VALKEY 实时会话" : "LIVE VALKEY SESSIONS"}</small>
          <h2>{locale === "zh" ? "活动后台会话" : "Active administrator sessions"}</h2>
          <p>
            {locale === "zh"
              ? "仅列出当前账号的服务端会话，不采集设备名称、IP 地址或浏览器指纹。"
              : "Only server sessions for this account are listed. Device names, IP addresses, and browser fingerprints are not collected."}
          </p>
        </div>
        <div className="security-session-heading-actions">
          <button
            className="admin-secondary"
            disabled={state === "refreshing" || Boolean(revoking)}
            onClick={() => void reload()}
            type="button"
          >
            <ArrowsClockwise
              aria-hidden="true"
              className={state === "refreshing" ? "spin" : ""}
              size={17}
            />
            {locale === "zh" ? "刷新" : "Refresh"}
          </button>
          <button
            className="admin-danger"
            disabled={otherSessionCount === 0 || Boolean(revoking)}
            onClick={() => void revokeOthers()}
            type="button"
          >
            <SignOut aria-hidden="true" size={17} />
            {revoking === "others"
              ? locale === "zh" ? "正在撤销" : "Revoking"
              : locale === "zh" ? "撤销其他会话" : "Revoke other sessions"}
          </button>
        </div>
      </div>
      <RefreshNotice
        state={state}
        locale={locale}
        retry={() => void reload()}
        slow={slow}
      />
      <p className="security-session-note">
        <Browsers aria-hidden="true" size={18} />
        <span>
          {locale === "zh"
            ? "会话采用 8 小时滑动过期。当前会话只能通过右下角“退出登录”结束，防止在此误撤销自己。"
            : "Sessions use an eight-hour sliding expiry. End the current session with Sign out in the sidebar to prevent accidental self-revocation here."}
        </span>
      </p>
      {!data ? (
        <PanelState
          state={state}
          locale={locale}
          retry={() => void reload()}
          kind="table"
        />
      ) : (
        <>
          <div className="security-session-summary">
            <article>
              <small>{locale === "zh" ? "全部会话" : "All sessions"}</small>
              <strong>{data.sessions.length}</strong>
            </article>
            <article>
              <small>{locale === "zh" ? "当前会话" : "Current session"}</small>
              <strong>{data.sessions.filter((session) => session.current).length}</strong>
            </article>
            <article>
              <small>{locale === "zh" ? "其他会话" : "Other sessions"}</small>
              <strong>{otherSessionCount}</strong>
            </article>
          </div>
          <div
            aria-label={locale === "zh" ? "活动会话表，可横向滚动" : "Active sessions table, horizontally scrollable"}
            className="security-session-table-wrap"
            tabIndex={0}
          >
            <table className="security-session-table">
              <thead>
                <tr>
                  <th scope="col">{locale === "zh" ? "会话" : "Session"}</th>
                  <th scope="col">{locale === "zh" ? "创建时间" : "Created"}</th>
                  <th scope="col">{locale === "zh" ? "最近活动" : "Last active"}</th>
                  <th scope="col">{locale === "zh" ? "预计过期" : "Expected expiry"}</th>
                  <th scope="col">{locale === "zh" ? "操作" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((session) => (
                  <tr key={session.id}>
                    <td>
                      <span className={`security-session-state ${session.current ? "is-current" : ""}`}>
                        {session.current
                          ? locale === "zh" ? "当前" : "Current"
                          : locale === "zh" ? "其他" : "Other"}
                      </span>
                      <code title={session.id}>{session.id.slice(0, 8)}</code>
                    </td>
                    <td><time dateTime={session.createdAt}>{formatDate(session.createdAt, locale)}</time></td>
                    <td><time dateTime={session.lastSeenAt}>{formatDate(session.lastSeenAt, locale)}</time></td>
                    <td><time dateTime={session.expiresAt}>{formatDate(session.expiresAt, locale)}</time></td>
                    <td>
                      {session.current ? (
                        <span className="security-session-current-label">
                          {locale === "zh" ? "请使用退出登录" : "Use Sign out"}
                        </span>
                      ) : (
                        <button
                          className="admin-danger"
                          disabled={Boolean(revoking)}
                          onClick={() => void revokeOne(session.id)}
                          type="button"
                        >
                          <SignOut aria-hidden="true" size={16} />
                          {revoking === session.id
                            ? locale === "zh" ? "正在撤销" : "Revoking"
                            : locale === "zh" ? "撤销" : "Revoke"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.sessions.length === 0 && (
              <div className="table-empty" role="status">
                {locale === "zh" ? "没有可读取的活动会话。" : "No active sessions could be read."}
              </div>
            )}
          </div>
        </>
      )}
      {error && <p className="form-error security-session-error" role="alert"><WarningCircle />{error}</p>}
    </section>
  );
}
