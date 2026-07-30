import type { AssetsBinding } from "./types";

const hashedAssetPattern =
  /-[A-Za-z0-9_-]{8}\.(?:css|js|mjs)$/u;

const contentTypes: Record<string, string> = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export async function serveStaticAsset(
  request: Request,
  assets: AssetsBinding,
): Promise<Response> {
  const response = await assets.fetch(request);
  if (!response.ok) return response;

  const url = new URL(request.url);
  const headers = new Headers(response.headers);
  const extension = url.pathname.match(/\.[a-z0-9]+$/iu)?.[0].toLowerCase();
  const currentType = headers.get("content-type");
  if (
    extension
    && contentTypes[extension]
    && (!currentType || currentType === "application/octet-stream")
  ) {
    headers.set("content-type", contentTypes[extension]);
  }
  headers.set(
    "cache-control",
    hashedAssetPattern.test(url.pathname)
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600, stale-while-revalidate=86400",
  );
  headers.set("vary", mergeVary(headers.get("vary"), "accept-encoding"));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function mergeVary(current: string | null, value: string): string {
  const values = new Set(
    (current ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
  values.add(value);
  return [...values].join(", ");
}
