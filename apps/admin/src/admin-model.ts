export type Page =
  | "dashboard"
  | "orders"
  | "disputes"
  | "products"
  | "categories"
  | "banners"
  | "media"
  | "translations"
  | "contacts"
  | "notifications"
  | "telegram-bot"
  | "currencies"
  | "payments"
  | "reconciliation"
  | "team"
  | "roles"
  | "security"
  | "security-events"
  | "data-security"
  | "secrets"
  | "logs"
  | "backups"
  | "integrations"
  | "settings";

export type AdminNavigationGroupId =
  | "orders-after-sales"
  | "catalog-management"
  | "content-storefront"
  | "support-notifications"
  | "finance-settlement"
  | "team-access"
  | "security-compliance"
  | "systems-operations";

type AdminNavigationLabelKey =
  | "workspace"
  | "ordersAfterSales"
  | "catalogManagement"
  | "contentStorefront"
  | "supportNotifications"
  | "financeSettlement"
  | "teamAccess"
  | "securityCompliance"
  | "systemsOperations";

type AdminNavigationLink = {
  kind: "link";
  id: "dashboard";
  labelKey: AdminNavigationLabelKey;
};

export type AdminNavigationGroup = {
  kind: "group";
  id: AdminNavigationGroupId;
  labelKey: AdminNavigationLabelKey;
  items: readonly Page[];
};

export const ADMIN_NAVIGATION = [
  { kind: "link", id: "dashboard", labelKey: "workspace" },
  { kind: "group", id: "orders-after-sales", labelKey: "ordersAfterSales", items: ["orders", "disputes"] },
  { kind: "group", id: "catalog-management", labelKey: "catalogManagement", items: ["products", "categories"] },
  { kind: "group", id: "content-storefront", labelKey: "contentStorefront", items: ["banners", "media", "translations"] },
  { kind: "group", id: "support-notifications", labelKey: "supportNotifications", items: ["contacts", "notifications", "telegram-bot"] },
  { kind: "group", id: "finance-settlement", labelKey: "financeSettlement", items: ["currencies", "payments", "reconciliation"] },
  { kind: "group", id: "team-access", labelKey: "teamAccess", items: ["team", "roles"] },
  { kind: "group", id: "security-compliance", labelKey: "securityCompliance", items: ["security", "security-events", "data-security", "secrets"] },
  { kind: "group", id: "systems-operations", labelKey: "systemsOperations", items: ["logs", "backups", "integrations", "settings"] },
] as const satisfies readonly (AdminNavigationLink | AdminNavigationGroup)[];

export function findAdminNavigationGroup(page: Page): AdminNavigationGroup | null {
  return ADMIN_NAVIGATION.find(
    (entry): entry is (typeof ADMIN_NAVIGATION)[number] & AdminNavigationGroup => (
      entry.kind === "group" && entry.items.some((item) => item === page)
    ),
  ) ?? null;
}

export function toggleAdminNavigationGroup(
  currentGroupId: AdminNavigationGroupId | null,
  nextGroupId: AdminNavigationGroupId,
): AdminNavigationGroupId | null {
  return currentGroupId === nextGroupId ? null : nextGroupId;
}

export type AsyncViewState =
  | "idle"
  | "initial-loading"
  | "refreshing"
  | "ready"
  | "empty"
  | "forbidden"
  | "offline"
  | "error";

export type MutationState = "idle" | "submitting" | "success" | "error";

export const ADMIN_PAGES: readonly Page[] = [
  "dashboard",
  "orders",
  "disputes",
  "products",
  "categories",
  "banners",
  "media",
  "translations",
  "contacts",
  "notifications",
  "telegram-bot",
  "currencies",
  "payments",
  "reconciliation",
  "team",
  "roles",
  "security",
  "security-events",
  "data-security",
  "secrets",
  "logs",
  "backups",
  "integrations",
  "settings",
];

export const UX_TIMINGS = {
  feedbackDelayMs: 120,
  skeletonDelayMs: 400,
  slowRequestMs: 8000,
  routeEnterMs: 180,
  drawerMs: 220,
  dialogMs: 180,
  toastMs: 160,
  pressMs: 80,
  cacheTtlMs: 30_000,
} as const;

export function isAdminPage(value: string | undefined): value is Page {
  return Boolean(value && ADMIN_PAGES.includes(value as Page));
}

export function pageFromPath(pathname: string): Page {
  const segments = pathname.split("/").filter(Boolean);
  const candidate = segments[0] === "admin" ? segments[1] : segments[0];
  if (candidate === "audit") return "logs";
  return isAdminPage(candidate) ? candidate : "dashboard";
}

export function pagePath(page: Page): string {
  return `/admin/${page}`;
}

export function isPendingView(state: AsyncViewState): boolean {
  return state === "initial-loading" || state === "refreshing";
}
