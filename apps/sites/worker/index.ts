import {
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  handleImageOptimization,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { ensureDailyBackup } from "../server/backup-api";
import { ensureExchangeRatesFresh } from "../server/exchange-rates";
import { handleCloudBridgeRequest } from "../server/router";
import { processTelegramDeliveries } from "../server/telegram";
import type { SitesEnv, SitesExecutionContext } from "../server/types";

const worker = {
  async fetch(
    request: Request,
    env: SitesEnv,
    context: SitesExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (
      request.method === "GET"
      && ["/v1/storefront/config", "/v1/admin/sites-readiness"].includes(url.pathname)
    ) {
      context.waitUntil(ensureDailyBackup(env).catch((error: unknown) => {
        console.error("[cloudbridge] Automatic daily backup failed", error);
      }));
      context.waitUntil(ensureExchangeRatesFresh(env).catch((error: unknown) => {
        console.error("[cloudbridge] Automatic exchange-rate sync failed", error);
      }));
    }
    if (url.pathname.startsWith("/v1/")) {
      context.waitUntil(processTelegramDeliveries(env).catch((error: unknown) => {
        console.error("[cloudbridge] Telegram delivery processing failed", error);
      }));
    }
    const cloudBridgeResponse = await handleCloudBridgeRequest(request, env, context);
    if (cloudBridgeResponse) return cloudBridgeResponse;

    if (url.pathname === "/_vinext/image") {
      const images = env.IMAGES;
      if (!images) {
        const source = url.searchParams.get("url");
        if (!source || !source.startsWith("/") || source.startsWith("//")) {
          return new Response("Invalid image source", { status: 400 });
        }
        const sourceUrl = new URL(source, request.url);
        if (sourceUrl.origin !== url.origin) {
          return new Response("Invalid image source", { status: 400 });
        }
        return env.ASSETS.fetch(new Request(sourceUrl));
      }
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await images
            .input(body)
            .transform(width > 0 ? { width } : {})
            .output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, context);
  },
};

export default worker;
