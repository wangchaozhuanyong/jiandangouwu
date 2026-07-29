import type {
  Locale,
  StorefrontChannel,
} from "@cloudbridge/contracts";

export function resolveContactTarget(
  channel: StorefrontChannel,
  locale: Locale,
): string | null {
  const target = channel.directTarget?.trim() ?? "";
  if (
    channel.type === "WHATSAPP"
    && channel.mode === "DIRECT_LINK"
    && /^https:\/\/wa\.me\/[1-9]\d{5,15}(?:\?.*)?$/u.test(target)
  ) {
    const url = new URL(target);
    if (!url.searchParams.has("text")) {
      url.searchParams.set(
        "text",
        locale === "zh"
          ? "你好，我想咨询 CloudBridge 服务。"
          : "Hello, I would like to ask about CloudBridge services.",
      );
    }
    return url.toString();
  }
  if (
    channel.type === "EMAIL"
    && channel.mode === "DIRECT_LINK"
    && /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(target)
  ) return target;
  if (
    channel.type === "TELEGRAM"
    && channel.mode === "DIRECT_LINK"
    && /^https:\/\/t\.me\/[A-Za-z0-9_]{5,}$/u.test(target)
  ) return target;
  if (
    channel.type === "QQ"
    && channel.mode === "DIRECT_WITH_FALLBACK"
    && /^mqqwpa:\/\/im\/chat\?chat_type=wpa&uin=\d{5,15}$/u.test(target)
  ) return target;
  return null;
}
