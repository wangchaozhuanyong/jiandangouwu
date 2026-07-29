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
