import { WarningCircle, X } from "@phosphor-icons/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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
  notify: (message: string, type?: StatusMessage["type"]) => void;
};

const resourceCache = new Map<string, CacheEntry<unknown>>();
const StatusContext = createContext<StatusContextValue | null>(null);

export function invalidateAdminCache(...keys: string[]): void {
  keys.forEach((key) => resourceCache.delete(key));
}

export function invalidateAdminCacheByPrefix(prefix: string): void {
  for (const key of resourceCache.keys()) {
    if (key.startsWith(prefix)) resourceCache.delete(key);
  }
}

export function clearAdminCache(): void {
  resourceCache.clear();
}

export function getCachedAdminResource<T>(key: string): CacheEntry<T> | null {
  return (resourceCache.get(key) as CacheEntry<T> | undefined) ?? null;
}

export function useCachedAdminResource<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
) {
  const initial = getCachedAdminResource<T>(key);
  const [data, setData] = useState<T | null>(initial?.value ?? null);
  const [state, setState] = useState<AsyncViewState>(initial ? "ready" : "initial-loading");
  const loaderRef = useRef(loader);
  const dataRef = useRef(data);
  const controllerRef = useRef<AbortController | null>(null);
  loaderRef.current = loader;
  dataRef.current = data;

  const load = useCallback(async (force = false) => {
    const cached = getCachedAdminResource<T>(key);
    if (!force && cached && Date.now() - cached.updatedAt < UX_TIMINGS.cacheTtlMs) {
      setData(cached.value);
      setState("ready");
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
      resourceCache.set(key, { value, updatedAt: Date.now() });
      setData(value);
      setState(Array.isArray(value) && value.length === 0 ? "empty" : "ready");
      return value;
    } catch (error) {
      if (controller.signal.aborted) return null;
      setState(navigator.onLine ? "error" : "offline");
      return null;
    }
  }, [key]);

  useEffect(() => {
    void load(false);
    return () => controllerRef.current?.abort();
  }, [load]);

  const invalidateAndReload = useCallback(() => {
    invalidateAdminCache(key);
    return load(true);
  }, [key, load]);

  return { data, state, reload: () => load(true), invalidateAndReload };
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
  const notify = useCallback((message: string, type: StatusMessage["type"] = "success") => {
    setStatus({ id: Date.now(), message, type });
  }, []);

  useEffect(() => {
    if (!status || status.type === "error") return undefined;
    const timer = window.setTimeout(() => setStatus(null), 3600);
    return () => window.clearTimeout(timer);
  }, [status]);

  return (
    <StatusContext.Provider value={{ notify }}>
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
