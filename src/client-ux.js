export const HOME_SCROLL_KEY = "cloudbridge-home-scroll";
export const ORDER_SUMMARY_KEY = "cloudbridge-order-summary";
export const LOOKUP_PREFILL_KEY = "cloudbridge-lookup-prefill";
export const UX_TIMINGS = Object.freeze({
  feedbackDelayMs: 120,
  skeletonDelayMs: 400,
  slowRequestMs: 8000,
  routeEnterMs: 180,
  drawerMs: 220,
  dialogMs: 180,
  toastMs: 160,
  pressMs: 80,
});

export function resolveAsyncViewState({
  hasData = false,
  pending = false,
  failed = false,
  online = true,
} = {}) {
  if (pending) return hasData ? "refreshing" : "initial-loading";
  if (failed && !online) return "offline";
  if (failed) return "error";
  return hasData ? "ready" : "empty";
}

/**
 * @typedef {Object} OrderSummary
 * @property {string} id
 * @property {string} productId
 * @property {string} currencyCode
 * @property {string} reservedUntil
 * @property {"manual"} paymentMode
 * @property {"manualPending"} status
 */

const isStorageLike = (storage) => storage
  && typeof storage.getItem === "function"
  && typeof storage.setItem === "function";

export function validateContact(channel, value, messages) {
  const normalized = value.trim();
  if (!normalized) return messages.required;
  if (channel === "whatsapp" && !/^\+?[0-9\s-]{8,18}$/.test(normalized)) return messages.format;
  if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return messages.format;
  if (channel === "telegram" && !/^@?[A-Za-z0-9_]{5,32}$/.test(normalized)) return messages.format;
  if (channel === "qq" && !/^[0-9]{5,12}$/.test(normalized)) return messages.format;
  if (channel === "wechat" && normalized.length < 4) return messages.format;
  return "";
}

export function validateLookup(orderNo, contact, messages) {
  const normalizedOrder = orderNo.trim().toUpperCase();
  if (!normalizedOrder || !contact.trim()) {
    return { normalizedOrder, error: messages.missing, field: !normalizedOrder ? "orderNo" : "contact" };
  }
  if (!/^CB-\d{6}-[A-Z0-9]{6}$/.test(normalizedOrder)) {
    return { normalizedOrder, error: messages.invalid, field: "orderNo" };
  }
  return { normalizedOrder, error: "", field: "" };
}

export function createOrderId(now = new Date(), randomValue = Math.random()) {
  const date = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = Math.floor(randomValue * 36 ** 8)
    .toString(36)
    .padStart(8, "0")
    .slice(0, 6)
    .toUpperCase();
  return `CB-${date}-${suffix}`;
}

/**
 * @param {{ id: string, product: { id: string }, currency: { code: string }, reservedUntil: string }} order
 * @returns {OrderSummary}
 */
export function orderToSummary(order) {
  return {
    id: order.id,
    productId: order.product.id,
    currencyCode: order.currency.code,
    reservedUntil: order.reservedUntil,
    paymentMode: "manual",
    status: "manualPending",
  };
}

/**
 * @param {unknown} value
 * @returns {value is OrderSummary}
 */
export function isOrderSummary(value) {
  if (!value || typeof value !== "object") return false;
  return /^CB-\d{6}-[A-Z0-9]{6}$/.test(value.id)
    && typeof value.productId === "string"
    && typeof value.currencyCode === "string"
    && typeof value.reservedUntil === "string"
    && (value.paymentMode === undefined || value.paymentMode === "manual")
    && (value.status === undefined || value.status === "manualPending")
    && Number.isFinite(Date.parse(value.reservedUntil));
}

export function saveOrderSummary(storage, order) {
  if (!isStorageLike(storage)) return false;
  storage.setItem(ORDER_SUMMARY_KEY, JSON.stringify(orderToSummary(order)));
  return true;
}

export function readOrderSummary(storage) {
  if (!isStorageLike(storage)) return null;
  try {
    const parsed = JSON.parse(storage.getItem(ORDER_SUMMARY_KEY) || "null");
    return isOrderSummary(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function resolveOrderSummary(summary, productList, currencyList) {
  if (!isOrderSummary(summary)) return null;
  const product = productList.find((item) => item.id === summary.productId);
  const currency = currencyList.find((item) => item.code === summary.currencyCode);
  if (!product || !currency) return null;
  return {
    ...summary,
    paymentMode: summary.paymentMode || "manual",
    status: summary.status || "manualPending",
    product,
    currency,
  };
}

export function saveLookupPrefill(storage, orderNo) {
  if (!isStorageLike(storage)) return false;
  storage.setItem(LOOKUP_PREFILL_KEY, orderNo);
  return true;
}

export function consumeLookupPrefill(storage) {
  if (!isStorageLike(storage)) return "";
  const value = storage.getItem(LOOKUP_PREFILL_KEY) || "";
  storage.removeItem?.(LOOKUP_PREFILL_KEY);
  return value;
}

export function saveHomeScroll(storage, scrollY) {
  if (!isStorageLike(storage)) return false;
  storage.setItem(HOME_SCROLL_KEY, String(Math.max(0, Math.round(scrollY))));
  return true;
}

export function readHomeScroll(storage) {
  if (!isStorageLike(storage)) return 0;
  const value = Number(storage.getItem(HOME_SCROLL_KEY));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function readHorizontalOverflow({ scrollLeft = 0, clientWidth = 0, scrollWidth = 0 }, threshold = 1) {
  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
  const currentScrollLeft = Math.min(maxScrollLeft, Math.max(0, scrollLeft));
  return {
    canScrollBackward: currentScrollLeft > threshold,
    canScrollForward: currentScrollLeft < maxScrollLeft - threshold,
  };
}

export function createCancelableDelay(callback, delay, schedule = setTimeout, cancel = clearTimeout) {
  let active = true;
  const timer = schedule(() => {
    if (!active) return;
    active = false;
    callback();
  }, delay);
  return () => {
    if (!active) return;
    active = false;
    cancel(timer);
  };
}
