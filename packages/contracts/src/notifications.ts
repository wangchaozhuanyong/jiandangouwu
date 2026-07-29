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
export type TelegramConnectionState = "NOT_CONNECTED";

export type AdminTelegramNewOrderSettings = {
  requestedEnabled: boolean;
  effectiveEnabled: false;
  recipientGroupLabel: string;
  eventType: TelegramNewOrderEventType;
  includedFields: ReadonlyArray<TelegramNewOrderFieldCode>;
  connectionState: TelegramConnectionState;
  tokenConfigured: false;
  externalDeliveryVerified: false;
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
