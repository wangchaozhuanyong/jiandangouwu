import type {
  AdminTelegramNewOrderSettings,
  TelegramConnectionTest,
  TelegramDeliveryItem,
  TelegramNewOrderSimulation,
  UpdateAdminTelegramNewOrderSettingsInput,
} from "@cloudbridge/contracts";
import { request } from "../../api";

const settingsPath = "/admin/telegram-new-order-settings";

export const getTelegramNewOrderSettings = async (
  signal?: AbortSignal,
): Promise<AdminTelegramNewOrderSettings> => {
  const settings = (
    await request<AdminTelegramNewOrderSettings>(settingsPath, { signal })
  ).data;
  return settings;
};

export const updateTelegramNewOrderSettings = async (
  body: UpdateAdminTelegramNewOrderSettingsInput,
) => {
  const response = await request<AdminTelegramNewOrderSettings>(settingsPath, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return response;
};

export const testTelegramConnection = async (
  reason: string,
): Promise<TelegramConnectionTest> => (
  await request<TelegramConnectionTest>(`${settingsPath}/test`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
).data;

export const getTelegramDeliveries = async (
  signal?: AbortSignal,
): Promise<TelegramDeliveryItem[]> => (
  await request<TelegramDeliveryItem[]>("/admin/telegram-deliveries", { signal })
).data;

export const retryTelegramDelivery = async (
  id: string,
  reason: string,
): Promise<TelegramDeliveryItem> => (
  await request<TelegramDeliveryItem>(
    `/admin/telegram-deliveries/${encodeURIComponent(id)}/retry`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  )
).data;

export const simulateTelegramNewOrder = async (): Promise<TelegramNewOrderSimulation> => {
  const simulation = (
    await request<TelegramNewOrderSimulation>(`${settingsPath}/simulation`, {
      method: "POST",
    })
  ).data;
  if (
    simulation.mode !== "SIMULATED"
    || simulation.deliveryAttempted !== false
    || simulation.externalDeliveryVerified !== false
  ) {
    throw new Error("Telegram simulation response failed the no-delivery contract.");
  }
  return simulation;
};
