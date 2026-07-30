import {
  Key,
  LockKey,
  ShieldCheck,
} from "@phosphor-icons/react";
import type {
  AdminUser,
  Locale,
} from "../api";
import { StatusPill } from "../admin-ui";

export default function SecurityPage({
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
              ? "CloudBridge 不保存密码、动态码或跨账号会话；退出操作会交回 Sites 登录系统。"
              : "CloudBridge stores no passwords, one-time codes, or cross-account sessions. Sign-out returns control to Sites authentication."}
          </p>
        </div>
      </section>
    </div>
  );
}
