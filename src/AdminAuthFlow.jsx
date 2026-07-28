import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  DeviceMobile,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  LockKey,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { BrandMark } from "./BrandMark.jsx";

const go = (path) => {
  window.location.hash = path;
};

const authCopy = {
  zh: {
    subtitle: "管理员登录设计预览",
    heroTitle: "一个验证器，六位动态码",
    heroCopy: "登录安全只保留 Google Authenticator。管理员输入邮箱和密码后，再完成当前 6 位动态码验证。",
    loginTitle: "管理员登录",
    loginCopy: "输入员工邮箱与密码，继续完成 Google Authenticator 验证。",
    email: "员工邮箱",
    password: "密码",
    continue: "继续验证",
    enterAdmin: "进入管理后台",
    codeTitle: "输入 6 位动态码",
    codeCopy: "打开 Google Authenticator，输入 CloudBridge 账户当前显示的 6 位数字。",
    codeLabel: "Google Authenticator 动态码",
    verify: "验证并进入后台",
    verifying: "正在验证…",
    back: "返回上一步",
    genericError: "请完整填写邮箱和至少 8 位密码。",
    codeError: "请输入完整的 6 位数字动态码。",
    enabled: "已开启",
    disabled: "已关闭",
    demoNote: "当前为网页设计演示，不连接 Google、不读取密钥，也不会保存登录信息。",
    support: "网页登录设计 · Google Authenticator 为唯一动态码方式",
  },
  en: {
    subtitle: "Admin sign-in design preview",
    heroTitle: "One authenticator. Six digits.",
    heroCopy: "Google Authenticator is the only sign-in security option. After email and password, admins enter the current 6-digit code.",
    loginTitle: "Admin sign in",
    loginCopy: "Enter the staff email and password, then continue to Google Authenticator.",
    email: "Staff email",
    password: "Password",
    continue: "Continue to verification",
    enterAdmin: "Open admin console",
    codeTitle: "Enter the 6-digit code",
    codeCopy: "Open Google Authenticator and enter the six digits currently shown for CloudBridge.",
    codeLabel: "Google Authenticator code",
    verify: "Verify and open admin",
    verifying: "Verifying…",
    back: "Back",
    genericError: "Enter an email and a password of at least 8 characters.",
    codeError: "Enter the complete 6-digit code.",
    enabled: "Enabled",
    disabled: "Disabled",
    demoNote: "This is a webpage design preview. It does not connect to Google, read secrets, or save sign-in data.",
    support: "Web design preview · Google Authenticator is the only rotating-code method",
  },
};

function AuthLanguageToggle({ lang, setLang }) {
  return (
    <div className="auth-language" aria-label={lang === "zh" ? "语言切换" : "Language switch"}>
      <button type="button" className={lang === "zh" ? "is-active" : ""} onClick={() => setLang("zh")}>中文</button>
      <button type="button" className={lang === "en" ? "is-active" : ""} onClick={() => setLang("en")}>EN</button>
    </div>
  );
}

function AuthFrame({ lang, setLang, googleAuthenticatorEnabled, children }) {
  const t = authCopy[lang];
  return (
    <div className="admin-auth-shell">
      <header className="admin-auth-header">
        <button className="admin-auth-brand" type="button" onClick={() => go("/admin/login")} aria-label="CloudBridge">
          <BrandMark size="auth" />
          <span><strong>CloudBridge</strong></span>
        </button>
        <AuthLanguageToggle lang={lang} setLang={setLang} />
      </header>
      <main className="admin-auth-main">
        <section className="admin-auth-assurance" aria-label={lang === "zh" ? "登录验证说明" : "Sign-in verification overview"}>
          <div className="auth-signal"><ShieldCheck size={28} weight="duotone" /></div>
          <p>{t.subtitle}</p>
          <h1>{t.heroTitle}</h1>
          <p>{t.heroCopy}</p>
          <div className="auth-assurance-list">
            <span><DeviceMobile size={20} /><strong>Google Authenticator</strong><small>{lang === "zh" ? "唯一动态码方式" : "Only rotating-code method"}</small></span>
            <span><span className="auth-six-mark">6</span><strong>{lang === "zh" ? "六位数字" : "Six digits"}</strong><small>{lang === "zh" ? "动态码输入" : "Rotating code input"}</small></span>
            <span><Clock size={20} /><strong>{lang === "zh" ? "后台可开关" : "Admin controlled"}</strong><small>{googleAuthenticatorEnabled ? t.enabled : t.disabled}</small></span>
          </div>
        </section>
        {children}
      </main>
      <footer className="admin-auth-footer">{t.support}</footer>
    </div>
  );
}

function LoginPanel({ lang, googleAuthenticatorEnabled, onAuthenticated }) {
  const t = authCopy[lang];
  const [stage, setStage] = useState("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, [stage]);

  const completePreview = (method) => {
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      onAuthenticated({
        name: lang === "zh" ? "王朝" : "Wang Chao",
        method,
      });
    }, 520);
  };

  const continueLogin = (event) => {
    event.preventDefault();
    if (!email.trim() || password.length < 8) {
      setError(t.genericError);
      return;
    }
    setError("");
    if (googleAuthenticatorEnabled) {
      setStage("google-authenticator");
      return;
    }
    completePreview("credentials-preview");
  };

  const verifyCode = (event) => {
    event.preventDefault();
    if (!/^\d{6}$/u.test(code)) {
      setError(t.codeError);
      return;
    }
    setError("");
    completePreview("google-authenticator-preview");
  };

  if (stage === "google-authenticator") {
    return (
      <section className="admin-auth-card" aria-labelledby="auth-code-title">
        <button className="auth-back" type="button" onClick={() => { setStage("credentials"); setCode(""); setError(""); }}>
          <ArrowLeft size={17} />{t.back}
        </button>
        <div className="auth-card-heading">
          <span><DeviceMobile size={23} /></span>
          <div><small>GOOGLE AUTHENTICATOR / 02</small><h2 id="auth-code-title">{t.codeTitle}</h2></div>
        </div>
        <p className="auth-card-copy">{t.codeCopy}</p>
        <div className="auth-account-preview">
          <span>{lang === "zh" ? "验证账户" : "Verifying account"}</span>
          <strong>{email}</strong>
        </div>
        <form onSubmit={verifyCode}>
          <label className="auth-field auth-code-field">
            <span>{t.codeLabel}</span>
            <div>
              <DeviceMobile size={19} />
              <input
                ref={firstFieldRef}
                className="auth-code-input"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/gu, "").slice(0, 6));
                  setError("");
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="000 000"
                aria-describedby="auth-code-timing"
              />
              <small>6 DIGITS</small>
            </div>
          </label>
          <div className="auth-code-meta" id="auth-code-timing">
            <Clock size={16} />
            <span>{lang === "zh" ? "请输入验证器当前显示的动态码" : "Use the code currently shown in the app"}</span>
          </div>
          {error && <p className="auth-error" role="alert"><WarningCircle size={17} />{error}</p>}
          <button className="auth-primary" type="submit" disabled={loading}>
            {loading ? t.verifying : t.verify}<ArrowRight size={18} />
          </button>
        </form>
        <p className="auth-demo-note"><ShieldCheck size={15} />{t.demoNote}</p>
      </section>
    );
  }

  return (
    <section className="admin-auth-card" aria-labelledby="login-title">
      <div className="auth-card-heading">
        <span><LockKey size={23} /></span>
        <div><small>ADMIN ACCESS / 01</small><h2 id="login-title">{t.loginTitle}</h2></div>
      </div>
      <div className={`auth-feature-status ${googleAuthenticatorEnabled ? "is-enabled" : "is-disabled"}`}>
        <span><i />Google Authenticator</span>
        <strong>{googleAuthenticatorEnabled ? t.enabled : t.disabled}</strong>
      </div>
      <p className="auth-card-copy">{googleAuthenticatorEnabled
        ? t.loginCopy
        : (lang === "zh" ? "Google Authenticator 当前已关闭，本次设计预览将直接进入后台。" : "Google Authenticator is currently disabled, so this preview opens the admin directly.")}</p>
      <form onSubmit={continueLogin} noValidate>
        <label className="auth-field">
          <span>{t.email}</span>
          <div><EnvelopeSimple size={18} /><input ref={firstFieldRef} type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} autoComplete="username" placeholder="name@cloudbridge.example" /></div>
        </label>
        <label className="auth-field">
          <span>{t.password}</span>
          <div>
            <LockKey size={18} />
            <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} autoComplete="current-password" />
            <button type="button" aria-label={showPassword ? (lang === "zh" ? "隐藏密码" : "Hide password") : (lang === "zh" ? "显示密码" : "Show password")} onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        {error && <p className="auth-error" role="alert"><WarningCircle size={17} />{error}</p>}
        <button className="auth-primary" type="submit" disabled={loading}>
          {loading ? t.verifying : googleAuthenticatorEnabled ? t.continue : t.enterAdmin}<ArrowRight size={18} />
        </button>
      </form>
      <p className="auth-demo-note"><ShieldCheck size={15} />{t.demoNote}</p>
    </section>
  );
}

export default function AdminAuthFlow({
  lang,
  setLang,
  googleAuthenticatorEnabled,
  onAuthenticated,
}) {
  return (
    <AuthFrame lang={lang} setLang={setLang} googleAuthenticatorEnabled={googleAuthenticatorEnabled}>
      <LoginPanel
        lang={lang}
        googleAuthenticatorEnabled={googleAuthenticatorEnabled}
        onAuthenticated={onAuthenticated}
      />
    </AuthFrame>
  );
}
