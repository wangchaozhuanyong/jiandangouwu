import type { LocalizedText } from "./common.js";

export const contactChannelTypes = ["WHATSAPP", "EMAIL", "TELEGRAM", "WECHAT", "QQ"] as const;
export type ContactChannelType = (typeof contactChannelTypes)[number];

export const contactChannelModes = ["DIRECT_LINK", "DIRECT_WITH_FALLBACK", "QR_COPY"] as const;
export type ContactChannelMode = (typeof contactChannelModes)[number];

export type StorefrontChannel = {
  type: ContactChannelType;
  mode: ContactChannelMode;
  label: string;
  account: string;
  directTarget: string | null;
  serviceHours: string;
};

export type AdminContactChannel = {
  id: string;
  type: ContactChannelType;
  mode: ContactChannelMode;
  label: LocalizedText;
  publicAccount: string;
  directTarget: string | null;
  serviceHours: LocalizedText;
  active: boolean;
  sortOrder: number;
  version: number;
  updatedAt: string;
};

export type UpdateContactChannelInput = {
  version: number;
  label: LocalizedText;
  publicAccount: string;
  directTarget: string | null;
  serviceHours: LocalizedText;
  active: boolean;
  sortOrder: number;
};

export type ReorderContactChannelsInput = {
  items: ReadonlyArray<{
    id: string;
    version: number;
  }>;
};

export type ContactChannelConfiguration = Pick<
  AdminContactChannel,
  "type" | "mode" | "publicAccount" | "directTarget"
>;

const unconfiguredContactValues = new Set([
  "未配置",
  "待配置",
  "待补充",
  "暂无",
  "not configured",
  "pending",
  "none",
  "n/a",
  "na",
]);

export function isApprovedContactChannelTarget(
  type: ContactChannelType,
  mode: ContactChannelMode,
  directTarget: string | null,
): boolean {
  const target = directTarget?.trim() || null;
  if (type === "WHATSAPP") {
    return mode === "DIRECT_LINK"
      && Boolean(target && /^https:\/\/wa\.me\/[1-9]\d{5,15}(?:\?.*)?$/u.test(target));
  }
  if (type === "EMAIL") {
    return mode === "DIRECT_LINK"
      && Boolean(target && /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/iu.test(target));
  }
  if (type === "TELEGRAM") {
    return mode === "DIRECT_LINK"
      && Boolean(target && /^https:\/\/t\.me\/[A-Za-z0-9_]{5,}$/u.test(target));
  }
  if (type === "WECHAT") {
    return mode === "QR_COPY" && target === null;
  }
  return mode === "DIRECT_WITH_FALLBACK"
    && Boolean(target && /^mqqwpa:\/\/im\/chat\?chat_type=wpa&uin=\d{5,15}$/u.test(target));
}

export function isConfiguredContactChannel(
  channel: ContactChannelConfiguration,
): boolean {
  const account = channel.publicAccount.normalize("NFKC").trim().toLocaleLowerCase();
  return account.length > 0
    && !unconfiguredContactValues.has(account)
    && isApprovedContactChannelTarget(channel.type, channel.mode, channel.directTarget);
}
