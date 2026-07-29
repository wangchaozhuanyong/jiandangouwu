import type { Money } from "./common.js";
import type {
  AdminOrderAssignee,
  OrderStatus,
} from "./orders.js";

export const manualPaymentEventTypes = [
  "MANUALLY_RECORDED_PAID",
  "REFUND_REVIEW_STARTED",
  "MANUALLY_RECORDED_REFUNDED",
  "DISPUTE_REVIEW_STARTED",
] as const;
export type ManualPaymentEventType = (typeof manualPaymentEventTypes)[number];

export type AdminManualPaymentEvent = {
  statusHistoryId: string;
  eventType: ManualPaymentEventType;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  orderId: string;
  orderNumber: string;
  productNameSnapshot: string;
  orderAmount: Money;
  referenceAmount: Money | null;
  exchangeRateSnapshot: string;
  currentStatus: OrderStatus;
  currentAssignee: AdminOrderAssignee | null;
  actor: AdminOrderAssignee | null;
  reason: string | null;
  recordedAt: string;
  externalActionVerified: false;
};

export type AdminManualPaymentEventListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  eventType?: ManualPaymentEventType;
  currencyCode?: string;
  actorId?: string;
  assigneeId?: string | "UNASSIGNED";
};
