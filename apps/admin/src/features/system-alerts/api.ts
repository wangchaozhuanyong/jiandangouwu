import {
  type SystemAlertDeliveriesResponse,
  type SystemAlertDeliveryItem,
  type SystemAlertSource,
} from "@cloudbridge/contracts";
import { request } from "../../api";

export type {
  SystemAlertDeliveriesResponse,
  SystemAlertDeliveryItem,
  SystemAlertSource,
};

export const getSystemAlertDeliveries = async (
  source: SystemAlertSource,
  signal?: AbortSignal,
): Promise<SystemAlertDeliveriesResponse> => (
  await request<SystemAlertDeliveriesResponse>(
    `/admin/system-alert-deliveries?source=${encodeURIComponent(source)}`,
    { signal },
  )
).data;

export const testSystemAlertDelivery = async (
  source: SystemAlertSource,
  reason: string,
): Promise<SystemAlertDeliveryItem> => (
  await request<SystemAlertDeliveryItem>("/admin/system-alert-deliveries/test", {
    method: "POST",
    body: JSON.stringify({ source, reason }),
  })
).data;

export const retrySystemAlertDelivery = async (
  id: string,
  reason: string,
): Promise<SystemAlertDeliveryItem> => (
  await request<SystemAlertDeliveryItem>(
    `/admin/system-alert-deliveries/${encodeURIComponent(id)}/retry`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  )
).data;
