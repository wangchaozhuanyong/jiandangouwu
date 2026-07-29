import {
  telegramNewOrderFieldCodes,
  type AdminTelegramNewOrderSettings,
  type TelegramNewOrderFieldCode,
} from "@cloudbridge/contracts";

export const TELEGRAM_NEW_ORDER_SETTINGS_KEY =
  "notifications.telegram.new-order";

const telegramBotTokenPattern = /\d{6,12}:[A-Za-z0-9_-]{30,}/u;
const telegramChatIdPattern = /-100\d{5,}/u;
const controlOrFormatCharacterPattern = /[\p{Cc}\p{Cf}]/u;
const recipientGroupLabelPattern =
  /^[\p{Script=Han}A-Za-z0-9 ._()（）·&/+,\-]+$/u;

export const containsTelegramSensitivePattern = (value: string): boolean =>
  controlOrFormatCharacterPattern.test(value)
  || telegramBotTokenPattern.test(value)
  || telegramChatIdPattern.test(value);

export const isSafeTelegramRecipientGroupLabel = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  return normalized.length >= 1
    && normalized.length <= 120
    && recipientGroupLabelPattern.test(normalized)
    && !/^-?\d+$/u.test(normalized)
    && !containsTelegramSensitivePattern(normalized);
};

export const isSafeTelegramSettingsReason = (value: unknown): boolean =>
  typeof value === "string"
  && !containsTelegramSensitivePattern(value);

type StoredTelegramNewOrderSettings = {
  requestedEnabled: boolean;
  recipientGroupLabel: string;
  eventType: "ORDER_CREATED";
  includedFields: ReadonlyArray<TelegramNewOrderFieldCode>;
};

export const DEFAULT_TELEGRAM_NEW_ORDER_SETTINGS:
Readonly<StoredTelegramNewOrderSettings> = {
  requestedEnabled: false,
  recipientGroupLabel: "订单运营组",
  eventType: "ORDER_CREATED",
  includedFields: telegramNewOrderFieldCodes,
};

const defaultStoredSettings = (): StoredTelegramNewOrderSettings => ({
  ...DEFAULT_TELEGRAM_NEW_ORDER_SETTINGS,
  includedFields: [...DEFAULT_TELEGRAM_NEW_ORDER_SETTINGS.includedFields],
});

const isTelegramFieldCode = (
  value: unknown,
): value is TelegramNewOrderFieldCode => (
  typeof value === "string"
  && telegramNewOrderFieldCodes.includes(value as TelegramNewOrderFieldCode)
);

const parseIncludedFields = (
  value: unknown,
): ReadonlyArray<TelegramNewOrderFieldCode> | null => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    return null;
  }
  if (!value.every(isTelegramFieldCode) || new Set(value).size !== value.length) {
    return null;
  }
  return value;
};

export const parseStoredTelegramNewOrderSettings = (
  value: unknown,
): StoredTelegramNewOrderSettings => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return defaultStoredSettings();
  }
  const source = value as Record<string, unknown>;
  const approvedKeys = new Set([
    "requestedEnabled",
    "recipientGroupLabel",
    "eventType",
    "includedFields",
  ]);
  if (Object.keys(source).some((key) => !approvedKeys.has(key))) {
    return defaultStoredSettings();
  }
  const includedFields = parseIncludedFields(source.includedFields);
  if (
    typeof source.requestedEnabled !== "boolean"
    || source.eventType !== "ORDER_CREATED"
    || !isSafeTelegramRecipientGroupLabel(source.recipientGroupLabel)
    || !includedFields
  ) {
    return defaultStoredSettings();
  }
  return {
    requestedEnabled: source.requestedEnabled,
    recipientGroupLabel: (source.recipientGroupLabel as string).trim(),
    eventType: "ORDER_CREATED",
    includedFields,
  };
};

export const toAdminTelegramNewOrderSettings = (
  value: unknown,
  version: number,
  updatedAt: Date,
): AdminTelegramNewOrderSettings => ({
  ...parseStoredTelegramNewOrderSettings(value),
  effectiveEnabled: false,
  connectionState: "NOT_CONNECTED",
  tokenConfigured: false,
  externalDeliveryVerified: false,
  version,
  updatedAt: updatedAt.toISOString(),
});
