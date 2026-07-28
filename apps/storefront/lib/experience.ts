export type AsyncViewState =
  | "idle"
  | "initial-loading"
  | "refreshing"
  | "ready"
  | "empty"
  | "offline"
  | "error";

export type MutationState = "idle" | "submitting" | "success" | "error";

export const UX_TIMINGS = {
  feedbackDelayMs: 120,
  skeletonDelayMs: 400,
  slowRequestMs: 8000,
  routeEnterMs: 180,
  drawerMs: 220,
  dialogMs: 180,
  toastMs: 160,
  pressMs: 80,
} as const;

export function resolveAsyncViewState({
  hasData,
  pending,
  failed,
  online = true,
}: {
  hasData: boolean;
  pending: boolean;
  failed: boolean;
  online?: boolean;
}): AsyncViewState {
  if (pending) return hasData ? "refreshing" : "initial-loading";
  if (failed && !online) return "offline";
  if (failed) return "error";
  return hasData ? "ready" : "empty";
}

export function isPendingView(state: AsyncViewState): boolean {
  return state === "initial-loading" || state === "refreshing";
}

export function createListingKey(locale: string, category: string, search: string): string {
  const query = new URLSearchParams();
  if (category) query.set("category", category);
  if (search) query.set("q", search);
  const suffix = query.toString();
  return `/${locale}${suffix ? `?${suffix}` : ""}`;
}
