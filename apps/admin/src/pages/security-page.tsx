import {
  Eye,
  Key,
  LockKey,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { useState } from "react";
import {
  beginTotpEnrollment,
  disableTotp,
  verifyTotpEnrollment,
  type AdminUser,
  type Locale,
} from "../api";
import { invalidateAdminCache, useAdminStatus } from "../admin-experience";
import { DesignWorkflowDialog } from "../design-workflows";
import { StatusPill } from "../admin-ui";
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
      <section className="admin-panel security-design-entry">
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
  const [sessionsOpen, setSessionsOpen] = useState(false);

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
      <section className="admin-panel security-design-entry">
        <span><Eye size={25} /></span>
        <div>
          <small>{locale === "zh" ? "界面设计预览" : "INTERFACE DESIGN PREVIEW"}</small>
          <h2>{locale === "zh" ? "密码、锁定与活动会话" : "Password, lockout, and active sessions"}</h2>
          <p>{locale === "zh" ? "补齐 TOTP 之外的账户安全管理，但不增加新的登录方式。" : "Complete account-security management around TOTP without adding sign-in methods."}</p>
        </div>
        <button className="admin-primary" onClick={() => setSessionsOpen(true)}>
          <Eye />{locale === "zh" ? "打开安全流程" : "Open security flow"}
        </button>
      </section>
      {sessionsOpen && <DesignWorkflowDialog id="security" locale={locale} onClose={() => setSessionsOpen(false)} />}
    </div>
  );
}
