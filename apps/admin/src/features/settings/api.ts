import type {
  AdminStorefrontSettings,
  UpdateStorefrontSettingsInput,
} from "@cloudbridge/contracts";
import { request } from "../../api";

export const getSiteSettings = async (signal?: AbortSignal): Promise<AdminStorefrontSettings> =>
  (await request<AdminStorefrontSettings>("/admin/site-settings", { signal })).data;

export const updateSiteSettings = (body: UpdateStorefrontSettingsInput) =>
  request<AdminStorefrontSettings>("/admin/site-settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
