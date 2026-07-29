import type {
  AdminManualPaymentEvent,
  AdminManualPaymentEventListQuery,
} from "@cloudbridge/contracts";
import { request, type PageMeta } from "../../api";

export type ManualPaymentEventPage = {
  items: AdminManualPaymentEvent[];
  meta: PageMeta;
};

const queryString = (query: AdminManualPaymentEventListQuery): string => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 30));
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.eventType) params.set("eventType", query.eventType);
  if (query.currencyCode?.trim()) params.set("currencyCode", query.currencyCode.trim().toUpperCase());
  if (query.actorId) params.set("actorId", query.actorId);
  if (query.assigneeId) params.set("assigneeId", query.assigneeId);
  return params.toString();
};

export const getManualPaymentEvents = async (
  query: AdminManualPaymentEventListQuery,
  signal?: AbortSignal,
): Promise<ManualPaymentEventPage> => {
  const response = await request<AdminManualPaymentEvent[]>(
    `/admin/manual-payment-events?${queryString(query)}`,
    { signal },
  );
  return {
    items: response.data,
    meta: response.meta ?? {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 30,
      total: response.data.length,
      pageCount: response.data.length > 0 ? 1 : 0,
    },
  };
};
