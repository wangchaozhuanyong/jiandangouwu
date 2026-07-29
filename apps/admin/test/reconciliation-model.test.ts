import assert from "node:assert/strict";
import test from "node:test";
import type {
  AdminManualPaymentEvent,
  ManualPaymentEventType,
} from "@cloudbridge/contracts";
import { buildReconciliationReadiness } from "../src/features/finance/reconciliation-model";

const event = ({
  currency = "USD",
  eventType = "MANUALLY_RECORDED_PAID",
  id,
  recordedAt,
}: {
  currency?: string;
  eventType?: ManualPaymentEventType;
  id: string;
  recordedAt: string;
}): AdminManualPaymentEvent => ({
  statusHistoryId: id,
  eventType,
  fromStatus: "PAYMENT_PROCESSING",
  toStatus: eventType === "MANUALLY_RECORDED_REFUNDED" ? "REFUNDED" : "PAID",
  orderId: `order-${id}`,
  orderNumber: `CB-${id}`,
  productNameSnapshot: `Product ${id}`,
  orderAmount: {
    amount: "19.90",
    currency,
  },
  referenceAmount: null,
  exchangeRateSnapshot: "1.0000000000",
  currentStatus: eventType === "MANUALLY_RECORDED_REFUNDED" ? "REFUNDED" : "PAID",
  currentAssignee: null,
  actor: {
    id: "admin-one",
    displayName: "Admin One",
  },
  reason: "Internal review",
  recordedAt,
  externalActionVerified: false,
});

test("reconciliation readiness counts internal records without combining currency amounts", () => {
  const result = buildReconciliationReadiness([
    event({
      id: "history-paid-usd",
      recordedAt: "2026-07-29T10:00:00.000Z",
    }),
    event({
      currency: "CNY",
      eventType: "REFUND_REVIEW_STARTED",
      id: "history-refund-cny",
      recordedAt: "2026-07-29T11:00:00.000Z",
    }),
    event({
      eventType: "DISPUTE_REVIEW_STARTED",
      id: "history-dispute-usd",
      recordedAt: "2026-07-29T12:00:00.000Z",
    }),
  ]);

  assert.equal(result.totalInternalEvents, 3);
  assert.deepEqual(result.eventTypeCounts, {
    MANUALLY_RECORDED_PAID: 1,
    REFUND_REVIEW_STARTED: 1,
    MANUALLY_RECORDED_REFUNDED: 0,
    DISPUTE_REVIEW_STARTED: 1,
  });
  assert.deepEqual(result.currencyEvidence, [
    { currency: "CNY", eventCount: 1 },
    { currency: "USD", eventCount: 2 },
  ]);
  assert.equal("totalAmount" in result, false);
  assert.equal(result.externalEvidenceState, "NOT_COLLECTED");
  assert.equal(result.allExternalActionsUnverified, true);
});

test("reconciliation readiness sorts newest records and caps the recent list at eight", () => {
  const events = Array.from({ length: 10 }, (_, index) =>
    event({
      id: `history-${String(index).padStart(2, "0")}`,
      recordedAt: `2026-07-29T${String(index).padStart(2, "0")}:00:00.000Z`,
    }),
  );

  const result = buildReconciliationReadiness(events);

  assert.equal(result.latestRecordedAt, "2026-07-29T09:00:00.000Z");
  assert.equal(result.recentInternalEvents.length, 8);
  assert.equal(result.recentInternalEvents[0]?.statusHistoryId, "history-09");
  assert.equal(result.recentInternalEvents[7]?.statusHistoryId, "history-02");
});

test("reconciliation readiness separates missing infrastructure from uncollected evidence", () => {
  const result = buildReconciliationReadiness([]);

  assert.deepEqual(
    result.gates
      .filter((gate) => gate.state === "NOT_IMPLEMENTED")
      .map((gate) => gate.code),
    ["PAYMENT_PROVIDER", "WEBHOOK_INGESTION", "MATCHING_AND_EXCEPTIONS"],
  );
  assert.deepEqual(
    result.gates
      .filter((gate) => gate.state === "NOT_COLLECTED")
      .map((gate) => gate.code),
    ["EXTERNAL_TRANSACTION_IDS", "SETTLEMENT_STATEMENTS"],
  );
});

test("reconciliation readiness fails closed if an event claims external verification", () => {
  const invalid = {
    ...event({
      id: "history-invalid",
      recordedAt: "2026-07-29T12:00:00.000Z",
    }),
    externalActionVerified: true,
  } as unknown as AdminManualPaymentEvent;

  assert.throws(
    () => buildReconciliationReadiness([invalid]),
    /must remain externally unverified/u,
  );
});
