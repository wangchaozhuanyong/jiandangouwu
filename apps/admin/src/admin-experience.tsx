import { WarningCircle, X } from "@phosphor-icons/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { ApiError } from "./api";
import { UX_TIMINGS, type AsyncViewState } from "./admin-model";

type CacheEntry<T> = {
  value: T;
  updatedAt: number;
};

type StatusMessage = {
  id: number;
  message: string;
  type: "success" | "error" | "info";
};

type StatusContextValue = {
  confirmNavigation: (locale: "zh" | "en") => boolean;
  notify: (message: string, type?: StatusMessage["type"]) => void;
  setPageDirty: (source: string, dirty: boolean) => void;
};

const resourceCache = new Map<string, CacheEntry<unknown>>();
const StatusContext = createContext<StatusContextValue | null>(null);
let adminCacheScope = "anonymous";

const scopedCacheKey = (key: string): string => `${adminCacheScope}:${key}`;

export function setAdminCacheScope(scope: string | null): void {
  const nextScope = scope?.trim() || "anonymous";
  if (nextScope === adminCacheScope) return;
  resourceCache.clear();
  adminCacheScope = nextScope;
}

export function invalidateAdminCache(...keys: string[]): void {
  keys.forEach((key) => resourceCache.delete(scopedCacheKey(key)));
}

export function invalidateAdminCacheByPrefix(prefix: string): void {
  const scopedPrefix = scopedCacheKey(prefix);
  for (const key of resourceCache.keys()) {
    if (key.startsWith(scopedPrefix)) resourceCache.delete(key);
  }
}

export function clearAdminCache(): void {
  resourceCache.clear();
}

export function getCachedAdminResource<T>(key: string): CacheEntry<T> | null {
  return (resourceCache.get(scopedCacheKey(key)) as CacheEntry<T> | undefined) ?? null;
}

export function useCachedAdminResource<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
) {
  const cacheKey = scopedCacheKey(key);
  const initial = (resourceCache.get(cacheKey) as CacheEntry<T> | undefined) ?? null;
  const [data, setData] = useState<T | null>(initial?.value ?? null);
  const [state, setState] = useState<AsyncViewState>(initial ? "ready" : "initial-loading");
  const [error, setError] = useState<unknown>(null);
  const loaderRef = useRef(loader);
  const dataRef = useRef(data);
  const controllerRef = useRef<AbortController | null>(null);
  loaderRef.current = loader;
  dataRef.current = data;

  const load = useCallback(async (force = false) => {
    const cached = (resourceCache.get(cacheKey) as CacheEntry<T> | undefined) ?? null;
    if (!force && cached && Date.now() - cached.updatedAt < UX_TIMINGS.cacheTtlMs) {
      setData(cached.value);
      setState("ready");
      setError(null);
      return cached.value;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState(dataRef.current || cached ? "refreshing" : "initial-loading");
    if (cached && !dataRef.current) setData(cached.value);
    try {
      const value = await loaderRef.current(controller.signal);
      if (controller.signal.aborted) return null;
      resourceCache.set(cacheKey, { value, updatedAt: Date.now() });
      setError(null);
      setData(value);
      setState(Array.isArray(value) && value.length === 0 ? "empty" : "ready");
      return value;
    } catch (error) {
      if (controller.signal.aborted) return null;
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        resourceCache.delete(cacheKey);
        dataRef.current = null;
        setData(null);
      }
      setError(error);
      setState(
        error instanceof ApiError && error.status === 403
          ? "forbidden"
          : navigator.onLine
            ? "error"
            : "offline",
      );
      return null;
    }
  }, [cacheKey]);

  useEffect(() => {
    void load(false);
    return () => controllerRef.current?.abort();
  }, [load]);

  const invalidateAndReload = useCallback(() => {
    resourceCache.delete(cacheKey);
    return load(true);
  }, [cacheKey, load]);

  const commit = useCallback((value: T) => {
    controllerRef.current?.abort();
    resourceCache.set(cacheKey, { value, updatedAt: Date.now() });
    dataRef.current = value;
    setData(value);
    setError(null);
    setState(Array.isArray(value) && value.length === 0 ? "empty" : "ready");
  }, [cacheKey]);

  return { data, state, error, reload: () => load(true), invalidateAndReload, commit };
}

export function useSlowAdminRequest(state: AsyncViewState): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (state !== "initial-loading" && state !== "refreshing") {
      setSlow(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setSlow(true), UX_TIMINGS.slowRequestMs);
    return () => window.clearTimeout(timer);
  }, [state]);
  return slow;
}

export function AdminExperienceProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [pageDirty, setPageDirtyState] = useState(false);
  const dirtySources = useRef(new Set<string>());
  const setPageDirty = useCallback((source: string, dirty: boolean) => {
    if (dirty) dirtySources.current.add(source);
    else dirtySources.current.delete(source);
    setPageDirtyState(dirtySources.current.size > 0);
  }, []);
  const notify = useCallback((message: string, type: StatusMessage["type"] = "success") => {
    setStatus({ id: Date.now(), message, type });
  }, []);
  const confirmNavigation = useCallback((locale: "zh" | "en") => (
    !pageDirty || window.confirm(
      locale === "zh"
        ? "当前页面有未保存的更改，离开后会丢失。确定离开吗？"
        : "This page has unsaved changes. Leave and discard them?",
    )
  ), [pageDirty]);

  useEffect(() => {
    if (!status || status.type === "error") return undefined;
    const timer = window.setTimeout(() => setStatus(null), 3600);
    return () => window.clearTimeout(timer);
  }, [status]);

  return (
    <StatusContext.Provider value={{ confirmNavigation, notify, setPageDirty }}>
      {children}
      <div className={`admin-toast is-${status?.type ?? "info"} ${status ? "is-visible" : ""}`} aria-hidden="true">
        {status?.type === "error" && <WarningCircle size={17} />}
        <span>{status?.message ?? ""}</span>
        {status?.type === "error" && <button onClick={() => setStatus(null)} aria-label="Dismiss"><X size={15} /></button>}
      </div>
      <div className="sr-only" role={status?.type === "error" ? "alert" : "status"} aria-live={status?.type === "error" ? "assertive" : "polite"} aria-atomic="true">
        {status?.message ?? ""}
      </div>
    </StatusContext.Provider>
  );
}

export function useAdminStatus(): StatusContextValue {
  const value = useContext(StatusContext);
  if (!value) throw new Error("useAdminStatus must be used within AdminExperienceProvider");
  return value;
}

export function useAdminPageDirty(dirty: boolean): void {
  const { setPageDirty } = useAdminStatus();
  const source = useId();
  useEffect(() => {
    setPageDirty(source, dirty);
    return () => setPageDirty(source, false);
  }, [dirty, setPageDirty, source]);
}
