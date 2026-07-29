import type {
  AdminTelegramNewOrderSettings,
  TelegramNewOrderFieldCode,
} from "@cloudbridge/contracts";

export type NotificationReadinessGateCode =
  | "DELIVERY_RUNTIME"
  | "BOT_CREDENTIAL"
  | "EXTERNAL_VERIFICATION"
  | "DELIVERY_EVENT_STORE"
  | "RETRY_QUEUE";

export type NotificationReadinessGate = {
  code: NotificationReadinessGateCode;
  state: "BLOCKED" | "NOT_IMPLEMENTED";
};

export type NotificationReadiness = {
  route: {
    provider: "TELEGRAM";
    eventType: "ORDER_CREATED";
    connectionState: "NOT_CONNECTED";
    requestedEnabled: boolean;
    effectiveEnabled: false;
    tokenConfigured: false;
    externalDeliveryVerified: false;
    recipientGroupLabel: string;
    includedFields: ReadonlyArray<TelegramNewOrderFieldCode>;
    version: number;
    updatedAt: string;
  };
  deliveryEvidenceState: "NOT_COLLECTED";
  gates: ReadonlyArray<NotificationReadinessGate>;
};

export const buildNotificationReadiness = (
  settings: AdminTelegramNewOrderSettings,
): NotificationReadiness => ({
  route: {
    provider: "TELEGRAM",
    eventType: settings.eventType,
    connectionState: settings.connectionState,
    requestedEnabled: settings.requestedEnabled,
    effectiveEnabled: settings.effectiveEnabled,
    tokenConfigured: settings.tokenConfigured,
    externalDeliveryVerified: settings.externalDeliveryVerified,
    recipientGroupLabel: settings.recipientGroupLabel,
    includedFields: [...settings.includedFields],
    version: settings.version,
    updatedAt: settings.updatedAt,
  },
  deliveryEvidenceState: "NOT_COLLECTED",
  gates: [
    { code: "DELIVERY_RUNTIME", state: "BLOCKED" },
    { code: "BOT_CREDENTIAL", state: "BLOCKED" },
    { code: "EXTERNAL_VERIFICATION", state: "BLOCKED" },
    { code: "DELIVERY_EVENT_STORE", state: "NOT_IMPLEMENTED" },
    { code: "RETRY_QUEUE", state: "NOT_IMPLEMENTED" },
  ],
});
