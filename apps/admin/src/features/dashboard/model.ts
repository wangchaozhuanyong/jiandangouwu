import type { Overview } from "../../api";
import type { Page } from "../../admin-model";

export type DashboardCapabilityState = "NOT_COLLECTED" | "NOT_IMPLEMENTED";

export type DashboardCapabilityCode =
  | "RESERVATION_EXPIRY"
  | "LOW_STOCK_ALERT"
  | "NOTIFICATION_DELIVERY"
  | "SECURITY_ALERT";

export type DashboardCapabilityBoundary = {
  code: DashboardCapabilityCode;
  state: DashboardCapabilityState;
  ownerPage: Page;
};

export type DashboardSnapshot = {
  inactiveProductCount: number;
  latestOrderCount: number;
  latestOrderAt: string | null;
  capabilities: DashboardCapabilityBoundary[];
};

const capabilityBoundaries: readonly DashboardCapabilityBoundary[] = [
  {
    code: "RESERVATION_EXPIRY",
    state: "NOT_IMPLEMENTED",
    ownerPage: "orders",
  },
  {
    code: "LOW_STOCK_ALERT",
    state: "NOT_COLLECTED",
    ownerPage: "products",
  },
  {
    code: "NOTIFICATION_DELIVERY",
    state: "NOT_COLLECTED",
    ownerPage: "notifications",
  },
  {
    code: "SECURITY_ALERT",
    state: "NOT_IMPLEMENTED",
    ownerPage: "security-events",
  },
] as const;

export function buildDashboardSnapshot(overview: Overview): DashboardSnapshot {
  const latestOrderAt = overview.latestOrders.reduce<string | null>(
    (latest, order) => latest === null || order.createdAt > latest ? order.createdAt : latest,
    null,
  );

  return {
    inactiveProductCount: Math.max(
      0,
      overview.metrics.productCount - overview.metrics.activeProducts,
    ),
    latestOrderCount: overview.latestOrders.length,
    latestOrderAt,
    capabilities: capabilityBoundaries.map((capability) => ({ ...capability })),
  };
}
