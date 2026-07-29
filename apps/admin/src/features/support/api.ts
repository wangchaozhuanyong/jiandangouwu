import type {
  AdminContactChannel,
  ReorderContactChannelsInput,
  UpdateContactChannelInput,
} from "@cloudbridge/contracts";
import { request } from "../../api";

export const getContactChannels = async (signal?: AbortSignal): Promise<AdminContactChannel[]> =>
  (await request<AdminContactChannel[]>("/admin/contact-channels", { signal })).data;

export const updateContactChannel = (id: string, body: UpdateContactChannelInput) =>
  request<AdminContactChannel>(`/admin/contact-channels/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const reorderContactChannels = (body: ReorderContactChannelsInput) =>
  request<AdminContactChannel[]>("/admin/contact-channels/order", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
