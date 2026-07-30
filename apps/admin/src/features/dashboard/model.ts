import type { Locale, Overview } from "../../api";
import type { Page } from "../../admin-model";

export type DashboardCapabilityState =
  | "IMPLEMENTED_REQUEST_DRIVEN"
  | "IMPLEMENTED_LIVE_QUERY"
  | "IMPLEMENTED_RETRY_QUEUE"
  | "NOT_COLLECTED"
  | "NOT_IMPLEMENTED";

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
  inventoryRisk: Overview["inventoryRisk"];
  capabilities: DashboardCapabilityBoundary[];
};

const capabilityBoundaries: readonly DashboardCapabilityBoundary[] = [
  {
    code: "RESERVATION_EXPIRY",
    state: "IMPLEMENTED_REQUEST_DRIVEN",
    ownerPage: "orders",
  },
  {
    code: "LOW_STOCK_ALERT",
    state: "IMPLEMENTED_LIVE_QUERY",
    ownerPage: "products",
  },
  {
    code: "NOTIFICATION_DELIVERY",
    state: "IMPLEMENTED_RETRY_QUEUE",
    ownerPage: "notifications",
  },
  {
    code: "SECURITY_ALERT",
    state: "IMPLEMENTED_RETRY_QUEUE",
    ownerPage: "security-events",
  },
] as const;

export const liveInventoryRiskCapabilityBody = (
  locale: Locale,
  inventoryRiskThreshold: number,
): string => locale === "zh"
  ? `工作台会实时查询全部在售商品，区分库存数据冲突、售罄和 1–${inventoryRiskThreshold} 件低库存；它不是通知投递或历史告警。`
  : `The workspace queries every active product and separates invalid stock, sold-out items, and low stock from 1–${inventoryRiskThreshold}. This is not notification delivery or alert history.`;

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
    inventoryRisk: {
      ...overview.inventoryRisk,
      items: overview.inventoryRisk.items.map((item) => ({
        ...item,
        name: { ...item.name },
      })),
    },
    capabilities: capabilityBoundaries.map((capability) => ({ ...capability })),
  };
}
