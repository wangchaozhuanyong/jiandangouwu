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

export const uploadWechatQr = (
  id: string,
  file: File,
  version: number,
  reason: string,
) => {
  const form = new FormData();
  form.set("file", file);
  form.set("version", String(version));
  form.set("reason", reason);
  return request<AdminContactChannel>(`/admin/contact-channels/${encodeURIComponent(id)}/qr`, {
    method: "POST",
    body: form,
  });
};

export const removeWechatQr = (
  id: string,
  version: number,
  reason: string,
) => request<AdminContactChannel>(`/admin/contact-channels/${encodeURIComponent(id)}/qr`, {
  method: "DELETE",
  body: JSON.stringify({ version, reason }),
});

export const reorderContactChannels = (body: ReorderContactChannelsInput) =>
  request<AdminContactChannel[]>("/admin/contact-channels/order", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
