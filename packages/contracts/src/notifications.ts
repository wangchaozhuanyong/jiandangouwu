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

export const systemAlertSources = ["SECURITY", "BACKUP"] as const;
export type SystemAlertSource = (typeof systemAlertSources)[number];

export type SystemAlertEventType =
  | "SECURITY_SIGNAL"
  | "BACKUP_FAILURE"
  | "BACKUP_STALE"
  | "DELIVERY_TEST";

export type SystemAlertSeverity = "HIGH" | "MEDIUM";
export type SystemAlertDeliveryStatus = TelegramDeliveryStatus;
export type SystemAlertConnectionState =
  | "MISSING_SECRETS"
  | "UNVERIFIED"
  | "DISABLED"
  | "CONNECTED";

export type SystemAlertDeliveryItem = {
  id: string;
  source: SystemAlertSource;
  eventType: SystemAlertEventType;
  severity: SystemAlertSeverity;
  status: SystemAlertDeliveryStatus;
  subjectType: string;
  subjectId: string;
  title: Readonly<Record<"zh" | "en", string>>;
  summary: Readonly<Record<"zh" | "en", string>>;
  attemptCount: number;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  telegramMessageId: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SystemAlertReadiness = {
  connectionState: SystemAlertConnectionState;
  configuredChannels: number;
  recipientGroupLabel: string;
  verifiedAt: string | null;
  pendingCount: number;
  failedCount: number;
  deliveredCount: number;
  lastDeliveryVerifiedAt: string | null;
};

export type SystemAlertDeliveriesResponse = {
  items: SystemAlertDeliveryItem[];
  readiness: SystemAlertReadiness;
};
