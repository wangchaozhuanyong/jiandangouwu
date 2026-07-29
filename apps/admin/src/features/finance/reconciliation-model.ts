import {
  manualPaymentEventTypes,
  type AdminManualPaymentEvent,
  type ManualPaymentEventType,
} from "@cloudbridge/contracts";

export type ReconciliationGateCode =
  | "PAYMENT_PROVIDER"
  | "WEBHOOK_INGESTION"
  | "EXTERNAL_TRANSACTION_IDS"
  | "SETTLEMENT_STATEMENTS"
  | "MATCHING_AND_EXCEPTIONS";

export type ReconciliationReadinessGate = {
  code: ReconciliationGateCode;
  state: "NOT_IMPLEMENTED" | "NOT_COLLECTED";
};

export type ReconciliationCurrencyEvidence = {
  currency: string;
  eventCount: number;
};

export type ReconciliationReadiness = {
  totalInternalEvents: number;
  eventTypeCounts: Readonly<Record<ManualPaymentEventType, number>>;
  currencyEvidence: ReadonlyArray<ReconciliationCurrencyEvidence>;
  latestRecordedAt: string | null;
  recentInternalEvents: ReadonlyArray<AdminManualPaymentEvent>;
  externalEvidenceState: "NOT_COLLECTED";
  allExternalActionsUnverified: true;
  gates: ReadonlyArray<ReconciliationReadinessGate>;
};

const compareEvents = (
  left: AdminManualPaymentEvent,
  right: AdminManualPaymentEvent,
): number => {
  const timeDifference = Date.parse(right.recordedAt) - Date.parse(left.recordedAt);
  return timeDifference || right.statusHistoryId.localeCompare(left.statusHistoryId);
};

export const buildReconciliationReadiness = (
  events: ReadonlyArray<AdminManualPaymentEvent>,
): ReconciliationReadiness => {
  if (events.some((event) => event.externalActionVerified !== false)) {
    throw new Error("Manual payment evidence must remain externally unverified.");
  }

  const eventTypeCounts = Object.fromEntries(
    manualPaymentEventTypes.map((eventType) => [eventType, 0]),
  ) as Record<ManualPaymentEventType, number>;
  const currencyCounts = new Map<string, number>();

  events.forEach((event) => {
    eventTypeCounts[event.eventType] += 1;
    currencyCounts.set(
      event.orderAmount.currency,
      (currencyCounts.get(event.orderAmount.currency) ?? 0) + 1,
    );
  });

  const sorted = [...events].sort(compareEvents);

  return {
    totalInternalEvents: events.length,
    eventTypeCounts,
    currencyEvidence: [...currencyCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, eventCount]) => ({ currency, eventCount })),
    latestRecordedAt: sorted[0]?.recordedAt ?? null,
    recentInternalEvents: sorted.slice(0, 8),
    externalEvidenceState: "NOT_COLLECTED",
    allExternalActionsUnverified: true,
    gates: [
      { code: "PAYMENT_PROVIDER", state: "NOT_IMPLEMENTED" },
      { code: "WEBHOOK_INGESTION", state: "NOT_IMPLEMENTED" },
      { code: "EXTERNAL_TRANSACTION_IDS", state: "NOT_COLLECTED" },
      { code: "SETTLEMENT_STATEMENTS", state: "NOT_COLLECTED" },
      { code: "MATCHING_AND_EXCEPTIONS", state: "NOT_IMPLEMENTED" },
    ],
  };
};
