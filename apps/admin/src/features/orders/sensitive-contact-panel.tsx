import type { ContactChannelType, Locale } from "@cloudbridge/contracts";
import { Eye, EyeSlash, LockKey, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api";
import { revealAdminOrderContact } from "./api";

const revealDurationMs = 60_000;
const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

export function SensitiveContactPanel({
  channel,
  locale,
  maskedContact,
  orderId,
  orderNumber,
}: {
  channel: ContactChannelType;
  locale: Locale;
  maskedContact: string;
  orderId: string;
  orderNumber: string;
}) {
  const [reason, setReason] = useState("");
  const [revealedContact, setRevealedContact] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!revealedContact) return undefined;
    const clear = () => setRevealedContact(null);
    const timer = window.setTimeout(clear, revealDurationMs);
    const onVisibilityChange = () => {
      if (document.hidden) clear();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [revealedContact]);

  const reveal = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedReason = reason.trim();
    if (busy) return;
    if (normalizedReason.length < 8) {
      setError(copy(locale, "业务原因去除首尾空格后至少需要 8 个字符。", "Business reason must contain at least 8 characters after trimming."));
      return;
    }
    const confirmed = window.confirm(copy(
      locale,
      `将揭示订单 ${orderNumber} 的完整联系方式，并记录操作人、原因与时间。明文会在 60 秒或离开当前标签页后隐藏。确定继续吗？`,
      `Reveal the full contact for ${orderNumber} and audit the operator, reason, and time? It will hide after 60 seconds or when this tab is left.`,
    ));
    if (!confirmed) return;

    setBusy(true);
    setError("");
    try {
      const result = await revealAdminOrderContact(orderId, { reason: normalizedReason });
      setRevealedContact(result.contact);
      setReason("");
    } catch (requestError) {
      const reauthenticationRequired = requestError instanceof ApiError
        && requestError.status === 403
        && (
          requestError.code.toLocaleUpperCase().includes("REAUTH")
          || requestError.message.toLocaleLowerCase().includes("reauth")
        );
      const message = reauthenticationRequired
        ? copy(locale, "近期认证已过期，请退出后重新登录，再揭示联系方式。", "Recent authentication expired. Sign out and sign in again before revealing contact.")
        : requestError instanceof ApiError && requestError.status === 403
          ? copy(locale, "当前账号没有揭示完整联系方式的权限。", "This account cannot reveal full contact details.")
          : requestError instanceof ApiError && requestError.status === 404
            ? copy(locale, "订单已不存在，请关闭详情并刷新列表。", "This order no longer exists. Close the detail and refresh the list.")
            : requestError instanceof ApiError && requestError.status === 429
              ? copy(locale, "揭示操作过于频繁，请稍后重试。", "Contact reveals are rate-limited. Try again later.")
              : copy(locale, "联系方式未能揭示，服务器未确认本次敏感操作。", "The contact was not revealed because the server did not confirm the sensitive action.");
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="order-detail-section sensitive-contact-panel">
      <div className="order-detail-section-heading">
        <LockKey aria-hidden="true" />
        <h3>{copy(locale, "敏感联系方式", "Sensitive contact")}</h3>
      </div>
      <dl className="order-contact-summary">
        <div><dt>{copy(locale, "渠道", "Channel")}</dt><dd>{channel}</dd></div>
        <div>
          <dt>{copy(locale, "联系方式", "Contact")}</dt>
          <dd>{revealedContact ?? maskedContact}</dd>
        </div>
      </dl>
      {revealedContact ? (
        <div className="revealed-contact-state" role="status">
          <Eye aria-hidden="true" />
          <span>{copy(locale, "完整值仅在当前详情中显示，将在 60 秒或标签页隐藏时自动清除。", "The full value exists only in this detail and clears after 60 seconds or when the tab is hidden.")}</span>
          <button type="button" onClick={() => setRevealedContact(null)}>
            <EyeSlash aria-hidden="true" />{copy(locale, "立即隐藏", "Hide now")}
          </button>
        </div>
      ) : (
        <form className="contact-reveal-form" onSubmit={reveal}>
          <label>
            <span>{copy(locale, "揭示原因（至少 8 个字符，写入审计）", "Reveal reason (at least 8 characters, audited)")}</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={8}
              maxLength={500}
              rows={2}
              required
            />
          </label>
          <button className="admin-secondary" disabled={busy || reason.trim().length < 8}>
            <Eye aria-hidden="true" />
            {busy ? copy(locale, "正在验证", "Verifying") : copy(locale, "确认并揭示", "Confirm and reveal")}
          </button>
        </form>
      )}
      {error && <p className="form-error" role="alert"><WarningCircle aria-hidden="true" />{error}</p>}
    </section>
  );
}
