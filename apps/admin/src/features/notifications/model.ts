import type {
  AdminTelegramNewOrderSettings,
  TelegramConnectionState,
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
  state: "READY" | "BLOCKED";
};

export type NotificationReadiness = {
  route: {
    provider: "TELEGRAM";
    eventType: "ORDER_CREATED";
    connectionState: TelegramConnectionState;
    requestedEnabled: boolean;
    effectiveEnabled: boolean;
    tokenConfigured: boolean;
    externalDeliveryVerified: boolean;
    recipientGroupLabel: string;
    includedFields: ReadonlyArray<TelegramNewOrderFieldCode>;
    version: number;
    updatedAt: string;
  };
  deliveryEvidenceState: "VERIFIED" | "NOT_COLLECTED";
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
  deliveryEvidenceState: settings.externalDeliveryVerified ? "VERIFIED" : "NOT_COLLECTED",
  gates: [
    { code: "DELIVERY_RUNTIME", state: settings.effectiveEnabled ? "READY" : "BLOCKED" },
    { code: "BOT_CREDENTIAL", state: settings.tokenConfigured ? "READY" : "BLOCKED" },
    { code: "EXTERNAL_VERIFICATION", state: settings.externalDeliveryVerified ? "READY" : "BLOCKED" },
    { code: "DELIVERY_EVENT_STORE", state: "READY" },
    { code: "RETRY_QUEUE", state: "READY" },
  ],
});
