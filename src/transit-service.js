export const TRANSIT_SERVICE_STORAGE_KEY = "cloudbridge-transit-service";

export const DEFAULT_TRANSIT_SERVICE_CONFIG = Object.freeze({
  enabled: true,
  url: "",
});

export function normalizeTransitServiceUrl(value) {
  const candidate = String(value ?? "").trim();
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function validateTransitServiceUrl(value) {
  return Boolean(normalizeTransitServiceUrl(value));
}

export function normalizeTransitServiceConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (typeof value.enabled !== "boolean" || typeof value.url !== "string") return null;
  const trimmedUrl = value.url.trim();
  const normalizedUrl = normalizeTransitServiceUrl(trimmedUrl);
  if (trimmedUrl && !normalizedUrl) return null;
  return {
    enabled: value.enabled,
    url: normalizedUrl,
  };
}

export function isTransitServiceVisible(config) {
  const normalized = normalizeTransitServiceConfig(config);
  return Boolean(normalized?.enabled);
}

export function isTransitServiceConfigured(config) {
  const normalized = normalizeTransitServiceConfig(config);
  return Boolean(normalized?.enabled && normalized.url);
}

export function readTransitServiceConfig(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(TRANSIT_SERVICE_STORAGE_KEY) || "null");
    return normalizeTransitServiceConfig(parsed) || { ...DEFAULT_TRANSIT_SERVICE_CONFIG };
  } catch {
    return { ...DEFAULT_TRANSIT_SERVICE_CONFIG };
  }
}

export function saveTransitServiceConfig(storage, config) {
  const normalized = normalizeTransitServiceConfig(config);
  if (!normalized || !storage?.setItem) return false;
  try {
    storage.setItem(TRANSIT_SERVICE_STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}
