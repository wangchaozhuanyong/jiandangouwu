import type {
  AdminOrderAssignee,
  AdminOrderDetail,
  AdminOrderListItem,
  AdminOrderListQuery,
  AssignAdminOrderInput,
  RevealAdminOrderContactInput,
  RevealedAdminOrderContact,
  UpdateAdminOrderStatusInput,
} from "@cloudbridge/contracts";
import { request, type PageMeta } from "../../api";

export type AdminOrderPage = {
  items: AdminOrderListItem[];
  meta: PageMeta;
};

const orderQueryString = (query: AdminOrderListQuery): string => {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 30));
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.scope) params.set("scope", query.scope);
  if (query.status) params.set("status", query.status);
  if (query.assigneeId) params.set("assigneeId", query.assigneeId);
  if (query.contactChannel) params.set("contactChannel", query.contactChannel);
  return params.toString();
};

export const getAdminOrders = async (
  query: AdminOrderListQuery,
  signal?: AbortSignal,
): Promise<AdminOrderPage> => {
  const response = await request<AdminOrderListItem[]>(
    `/admin/orders?${orderQueryString(query)}`,
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

export const getAdminOrderDetail = async (
  id: string,
  signal?: AbortSignal,
): Promise<AdminOrderDetail> =>
  (await request<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(id)}`, { signal })).data;

export const getAdminOrderAssignees = async (
  signal?: AbortSignal,
): Promise<AdminOrderAssignee[]> =>
  (await request<AdminOrderAssignee[]>("/admin/orders/assignees", { signal })).data;

export const updateAdminOrderStatus = async (
  id: string,
  input: UpdateAdminOrderStatusInput,
): Promise<AdminOrderDetail> =>
  (await request<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })).data;

export const assignAdminOrder = async (
  id: string,
  input: AssignAdminOrderInput,
): Promise<AdminOrderDetail> =>
  (await request<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(id)}/assignment`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })).data;

export const revealAdminOrderContact = async (
  id: string,
  input: RevealAdminOrderContactInput,
): Promise<RevealedAdminOrderContact> =>
  (await request<RevealedAdminOrderContact>(`/admin/orders/${encodeURIComponent(id)}/reveal-contact`, {
    method: "POST",
    body: JSON.stringify(input),
    cache: "no-store",
  })).data;
