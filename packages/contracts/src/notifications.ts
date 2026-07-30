export const telegramNewOrderFieldCodes = [
  "ORDER_NUMBER",
  "PRODUCT",
  "AMOUNT",
  "CURRENCY",
  "STATUS",
  "CREATED_AT",
  "CONTACT_CHANNEL",
  "MASKED_CONTACT",
] as const;
export type TelegramNewOrderFieldCode =
  (typeof telegramNewOrderFieldCodes)[number];

export type TelegramNewOrderEventType = "ORDER_CREATED";
export type TelegramConnectionState =
  | "MISSING_SECRETS"
  | "UNVERIFIED"
  | "CONNECTED"
  | "ERROR";
export type TelegramDeliveryStatus =
  | "PENDING"
  | "RETRY_SCHEDULED"
  | "DELIVERED"
  | "FAILED";

export type AdminTelegramNewOrderSettings = {
  requestedEnabled: boolean;
  effectiveEnabled: boolean;
  recipientGroupLabel: string;
  eventType: TelegramNewOrderEventType;
  includedFields: ReadonlyArray<TelegramNewOrderFieldCode>;
  connectionState: TelegramConnectionState;
  tokenConfigured: boolean;
  externalDeliveryVerified: boolean;
  verifiedAt: string | null;
  verifiedChatTitle: string | null;
  botUsername: string | null;
  version: number;
  updatedAt: string;
};

export type UpdateAdminTelegramNewOrderSettingsInput = {
  version: number;
  requestedEnabled: boolean;
  recipientGroupLabel: string;
  includedFields: ReadonlyArray<TelegramNewOrderFieldCode>;
  reason: string;
};

export type TelegramNewOrderSimulation = {
  mode: "SIMULATED";
  recipientGroupLabel: string;
  fields: ReadonlyArray<{
    code: TelegramNewOrderFieldCode;
    value: string;
  }>;
  generatedAt: string;
  deliveryAttempted: false;
  externalDeliveryVerified: false;
};

export type TelegramConnectionTest = {
  mode: "REAL";
  delivered: true;
  messageId: string;
  chatTitle: string;
  botUsername: string;
  deliveredAt: string;
};

export type TelegramDeliveryItem = {
  id: string;
  orderId: string | null;
  orderNumber: string;
  eventType: TelegramNewOrderEventType;
  status: TelegramDeliveryStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  telegramMessageId: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RetryTelegramDeliveryInput = {
  reason: string;
};
