import { handleAdminApi, handleSitesHealth } from "./admin-api";
import { ApiInputError, failure } from "./http";
import { isPublicMediaObjectKey } from "./media-api";
import { handlePublicApi } from "./public-api";
import type { SitesEnv } from "./types";

export async function handleCloudBridgeRequest(
  request: Request,
  env: SitesEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/u, "") || "/";

  if (request.method === "GET" && pathname === "/v1/health") {
    return handleSitesHealth(env);
  }

  if (pathname.startsWith("/media/") && request.method === "GET") {
    let key: string;
    try {
      key = decodeURIComponent(pathname.slice("/media/".length));
    } catch {
      return new Response("Not found", { status: 404 });
    }
    if (!isPublicMediaObjectKey(key)) {
      return new Response("Not found", { status: 404 });
    }
    const object = await env.MEDIA.get(key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    headers.set("x-content-type-options", "nosniff");
    return new Response(object.body, { headers });
  }

  if (!pathname.startsWith("/v1/")) return null;

  try {
    const admin = await handleAdminApi(request, env, pathname);
    if (admin) return admin;
    const storefront = await handlePublicApi(request, env, pathname);
    if (storefront) return storefront;
    return failure(404, "ROUTE_NOT_FOUND", "The requested API route was not found.");
  } catch (error) {
    if (error instanceof ApiInputError) {
      return failure(error.status, error.code, error.message, undefined, error.details);
    }
    return failure(500, "INTERNAL_ERROR", "The request could not be completed.");
  }
}
