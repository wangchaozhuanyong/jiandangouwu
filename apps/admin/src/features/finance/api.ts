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

export const getAllManualPaymentEvents = async (
  signal?: AbortSignal,
): Promise<AdminManualPaymentEvent[]> => {
  const events = new Map<string, AdminManualPaymentEvent>();
  let page = 1;
  let pageCount = 1;

  do {
    const response = await getManualPaymentEvents({ page, pageSize: 100 }, signal);
    response.items.forEach((event) => events.set(event.statusHistoryId, event));
    pageCount = response.meta.pageCount;
    if (!Number.isSafeInteger(pageCount) || pageCount < 0 || pageCount > 1_000) {
      throw new Error("Invalid manual payment pagination metadata.");
    }
    page += 1;
  } while (page <= pageCount);

  return [...events.values()].sort((left, right) => {
    const timeDifference = Date.parse(right.recordedAt) - Date.parse(left.recordedAt);
    return timeDifference || right.statusHistoryId.localeCompare(left.statusHistoryId);
  });
};
