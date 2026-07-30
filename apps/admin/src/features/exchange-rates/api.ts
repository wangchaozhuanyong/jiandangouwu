import type {
  AdminExchangeRateSyncSettings,
  ExchangeRateSyncRun,
  UpdateAdminExchangeRateSyncSettingsInput,
} from "@cloudbridge/contracts";
import { request } from "../../api";

const settingsPath = "/admin/exchange-rate-sync";

export const getExchangeRateSyncSettings = async (
  signal?: AbortSignal,
): Promise<AdminExchangeRateSyncSettings> => (
  await request<AdminExchangeRateSyncSettings>(settingsPath, { signal })
).data;

export const updateExchangeRateSyncSettings = async (
  input: UpdateAdminExchangeRateSyncSettingsInput,
): Promise<AdminExchangeRateSyncSettings> => (
  await request<AdminExchangeRateSyncSettings>(settingsPath, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
).data;

export const runExchangeRateSync = async (
  reason: string,
): Promise<ExchangeRateSyncRun> => (
  await request<ExchangeRateSyncRun>(`${settingsPath}/run`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
).data;
