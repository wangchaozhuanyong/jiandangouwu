import type { Locale, Money } from "./common.js";
import type { ContactChannelType } from "./support.js";

export const orderStatuses = [
  "MANUAL_PENDING",
  "CONTACTED",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
  "PAID",
  "FULFILLING",
  "COMPLETED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
  "DISPUTED",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const adminOrderScopes = ["AFTER_SALES"] as const;
export type AdminOrderScope = (typeof adminOrderScopes)[number];

export type CreateOrderInput = {
  locale: Locale;
  productId: string;
  currency: string;
  contactChannel: ContactChannelType;
  contactValue: string;
  acceptedPolicyVersion: string;
  expectedPrice: Money;
};

export type OrderReceipt = {
  orderNumber: string;
  status: OrderStatus;
  productName: string;
  amount: Money;
  referenceAmount: Money | null;
  contactChannel: ContactChannelType;
  maskedContact: string;
  reservedUntil: string;
};

export const manualPaymentStages = [
  "NOT_RECORDED",
  "EXTERNAL_PROCESSING_UNVERIFIED",
  "MANUALLY_RECORDED_PAID",
  "REFUND_REVIEW",
  "MANUALLY_RECORDED_REFUNDED",
  "DISPUTE_REVIEW",
  "CANCELLED",
] as const;
export type ManualPaymentStage = (typeof manualPaymentStages)[number];

export type AdminOrderAssignee = {
  id: string;
  displayName: string;
};

export type AdminOrderStatusEvent = {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason: string | null;
  actor: AdminOrderAssignee | null;
  createdAt: string;
};

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  productId: string;
  productNameSnapshot: string;
  amount: Money;
  referenceAmount: Money | null;
  contactChannel: ContactChannelType;
  maskedContact: string;
  status: OrderStatus;
  paymentMode: "MANUAL";
  paymentStage: ManualPaymentStage;
  reservedUntil: string;
  assignedTo: AdminOrderAssignee | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminOrderDetail = AdminOrderListItem & {
  exchangeRateSnapshot: string;
  productVersion: number;
  acceptedPolicyVersion: string;
  allowedTransitions: ReadonlyArray<OrderStatus>;
  statusHistory: ReadonlyArray<AdminOrderStatusEvent>;
};

export type AdminOrderListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  scope?: AdminOrderScope;
  status?: OrderStatus;
  assigneeId?: string | "UNASSIGNED";
  contactChannel?: ContactChannelType;
};

export type UpdateAdminOrderStatusInput = {
  expectedStatus: OrderStatus;
  expectedUpdatedAt: string;
  status: OrderStatus;
  reason: string;
};

export type AssignAdminOrderInput = {
  assigneeId: string | null;
  expectedAssigneeId: string | null;
  expectedUpdatedAt: string;
  reason: string;
};

export type RevealAdminOrderContactInput = {
  reason: string;
};

export type RevealedAdminOrderContact = {
  contact: string;
  channel: ContactChannelType;
};
