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
