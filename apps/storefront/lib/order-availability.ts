import type {
  ContactChannelType,
  StorefrontChannel,
  StorefrontConfig,
} from "@cloudbridge/contracts";

export type OrderAvailability =
  | "loading"
  | "available"
  | "paused"
  | "no-channels";

export function resolveOrderAvailability(
  config: StorefrontConfig | null,
): OrderAvailability {
  if (!config) return "loading";
  if (!config.settings.acceptOrders) return "paused";
  return config.channels.length > 0 ? "available" : "no-channels";
}

export function resolveAvailableContactChannel(
  channels: readonly StorefrontChannel[],
  current: ContactChannelType,
): ContactChannelType | null {
  if (channels.some((channel) => channel.type === current)) return current;
  return channels[0]?.type ?? null;
}
