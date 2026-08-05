export const PREVIEW_V2_PREFIX = "/admin/__preview/v2";

export const PREVIEW_V2_PAGE_IDS = [
  "products",
  "categories",
  "banners",
  "skills",
  "settings",
] as const;

export type PreviewV2PageId = (typeof PREVIEW_V2_PAGE_IDS)[number];
export type PreviewLocale = "zh" | "en";

export type PreviewScenario =
  | "ready"
  | "initial-loading"
  | "empty"
  | "offline"
  | "error"
  | "forbidden"
  | "conflict";

export type PreviewV2Route = {
  requested: boolean;
  pageId: PreviewV2PageId | null;
};

export function previewV2PagePath(pageId: PreviewV2PageId): string {
  return `${PREVIEW_V2_PREFIX}/${pageId}`;
}

export function matchPreviewV2Route(pathname: string): PreviewV2Route {
  const normalized = pathname.replace(/\/+$/u, "") || "/";
  if (normalized !== PREVIEW_V2_PREFIX && !normalized.startsWith(`${PREVIEW_V2_PREFIX}/`)) {
    return { requested: false, pageId: null };
  }
  const candidate = normalized.slice(PREVIEW_V2_PREFIX.length + 1);
  return {
    requested: true,
    pageId: PREVIEW_V2_PAGE_IDS.find((pageId) => pageId === candidate) ?? null,
  };
}

export function canLoadPreviewV2(
  development: boolean,
  route: PreviewV2Route,
): route is PreviewV2Route & { requested: true; pageId: PreviewV2PageId } {
  return development && route.requested && route.pageId !== null;
}
