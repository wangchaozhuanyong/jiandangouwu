import type {
  AdminTelegramNewOrderSettings,
  TelegramNewOrderSimulation,
  UpdateAdminTelegramNewOrderSettingsInput,
} from "@cloudbridge/contracts";
import { request } from "../../api";

const settingsPath = "/admin/telegram-new-order-settings";

const requireUnconnectedSettings = (
  settings: AdminTelegramNewOrderSettings,
): AdminTelegramNewOrderSettings => {
  if (
    settings.connectionState !== "NOT_CONNECTED"
    || settings.effectiveEnabled !== false
    || settings.tokenConfigured !== false
    || settings.externalDeliveryVerified !== false
  ) {
    throw new Error("Telegram settings response failed the unconnected-state contract.");
  }
  return settings;
};

export const getTelegramNewOrderSettings = async (
  signal?: AbortSignal,
): Promise<AdminTelegramNewOrderSettings> => {
  const settings = (
    await request<AdminTelegramNewOrderSettings>(settingsPath, { signal })
  ).data;
  return requireUnconnectedSettings(settings);
};

export const updateTelegramNewOrderSettings = async (
  body: UpdateAdminTelegramNewOrderSettingsInput,
) => {
  const response = await request<AdminTelegramNewOrderSettings>(settingsPath, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return {
    ...response,
    data: requireUnconnectedSettings(response.data),
  };
};

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
