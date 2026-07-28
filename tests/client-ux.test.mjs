import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  consumeLookupPrefill,
  createCancelableDelay,
  createOrderId,
  readHomeScroll,
  readHorizontalOverflow,
  readOrderSummary,
  resolveAsyncViewState,
  resolveOrderSummary,
  saveHomeScroll,
  saveLookupPrefill,
  saveOrderSummary,
  validateContact,
  validateLookup,
} from "../src/client-ux.js";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};

test("validates checkout contacts and identifies the first lookup error", () => {
  const contactMessages = { required: "required", format: "format" };
  assert.equal(validateContact("whatsapp", "", contactMessages), "required");
  assert.equal(validateContact("whatsapp", "abc", contactMessages), "format");
  assert.equal(validateContact("qq", "288661812", contactMessages), "");
  assert.equal(validateContact("email", "support@example.com", contactMessages), "");
  assert.equal(validateContact("email", "not-an-email", contactMessages), "format");
  assert.equal(validateContact("telegram", "@cloudbridge_user", contactMessages), "");

  const lookupMessages = { missing: "missing", invalid: "invalid" };
  assert.deepEqual(validateLookup("", "", lookupMessages), {
    normalizedOrder: "",
    error: "missing",
    field: "orderNo",
  });
  assert.deepEqual(validateLookup("bad-id", "contact", lookupMessages), {
    normalizedOrder: "BAD-ID",
    error: "invalid",
    field: "orderNo",
  });
});

test("persists only the safe order summary and resolves current product data", () => {
  const storage = createStorage();
  const product = { id: "codex", name: "Codex" };
  const currency = { code: "MYR" };
  const order = {
    id: "CB-260727-ABC123",
    product,
    currency,
    reservedUntil: "2026-07-28T00:00:00.000Z",
    contact: "+60123456789",
    channel: "whatsapp",
  };

  assert.equal(saveOrderSummary(storage, order), true);
  const raw = storage.getItem("cloudbridge-order-summary");
  assert.equal(raw.includes("contact"), false);
  assert.deepEqual(readOrderSummary(storage), {
    id: order.id,
    productId: "codex",
    currencyCode: "MYR",
    reservedUntil: order.reservedUntil,
    paymentMode: "manual",
    status: "manualPending",
  });
  assert.equal(resolveOrderSummary(readOrderSummary(storage), [product], [currency]).product, product);
});

test("rejects malformed stored order summaries", () => {
  const storage = createStorage();
  storage.setItem("cloudbridge-order-summary", "{\"id\":\"fake\"}");
  assert.equal(readOrderSummary(storage), null);
});

test("stores home scroll independently from lookup prefill", () => {
  const storage = createStorage();
  saveHomeScroll(storage, 842.6);
  saveLookupPrefill(storage, "CB-260727-ABC123");

  assert.equal(readHomeScroll(storage), 843);
  assert.equal(consumeLookupPrefill(storage), "CB-260727-ABC123");
  assert.equal(consumeLookupPrefill(storage), "");
});

test("reports horizontal category overflow at the start, middle, and end", () => {
  assert.deepEqual(
    readHorizontalOverflow({ scrollLeft: 0, clientWidth: 420, scrollWidth: 420 }),
    { canScrollBackward: false, canScrollForward: false },
  );
  assert.deepEqual(
    readHorizontalOverflow({ scrollLeft: 0, clientWidth: 320, scrollWidth: 760 }),
    { canScrollBackward: false, canScrollForward: true },
  );
  assert.deepEqual(
    readHorizontalOverflow({ scrollLeft: 180, clientWidth: 320, scrollWidth: 760 }),
    { canScrollBackward: true, canScrollForward: true },
  );
  assert.deepEqual(
    readHorizontalOverflow({ scrollLeft: 440, clientWidth: 320, scrollWidth: 760 }),
    { canScrollBackward: true, canScrollForward: false },
  );
});

test("cancels an unfinished async action", () => {
  let callback;
  let cancelledTimer;
  let completed = false;
  const cancel = createCancelableDelay(
    () => { completed = true; },
    850,
    (next) => {
      callback = next;
      return 17;
    },
    (timer) => { cancelledTimer = timer; },
  );

  cancel();
  callback();
  assert.equal(cancelledTimer, 17);
  assert.equal(completed, false);
});

test("creates stable order ids from injected clock and randomness", () => {
  assert.equal(createOrderId(new Date("2026-07-27T12:00:00Z"), 0.5), "CB-260727-I00000");
});

test("resolves initial, refresh, empty, offline, and error view states", () => {
  assert.equal(resolveAsyncViewState({ pending: true, hasData: false }), "initial-loading");
  assert.equal(resolveAsyncViewState({ pending: true, hasData: true }), "refreshing");
  assert.equal(resolveAsyncViewState({ pending: false, hasData: false }), "empty");
  assert.equal(resolveAsyncViewState({ failed: true, online: false }), "offline");
  assert.equal(resolveAsyncViewState({ failed: true, online: true }), "error");
  assert.equal(resolveAsyncViewState({ hasData: true }), "ready");
});

test("product cards and detail pages omit auxiliary kicker labels", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const start = source.indexOf("function ProductCard");
  const end = source.indexOf("function ContactSection", start);
  const productCard = source.slice(start, end);
  const detailStart = source.indexOf("function ProductDetail");
  const detailEnd = source.indexOf("function CurrencyDrawer", detailStart);
  const productDetail = source.slice(detailStart, detailEnd);

  assert.equal(productCard.includes("product-kicker"), false);
  assert.equal(productCard.includes("product.kicker"), false);
  assert.equal(productDetail.includes("product.kicker"), false);
});

test("product cards group stock with the purchase action and details keep compact service metadata", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  ]);
  const cardStart = source.indexOf("function ProductCard");
  const cardEnd = source.indexOf("function ContactSection", cardStart);
  const card = source.slice(cardStart, cardEnd);
  const detailStart = source.indexOf("function ProductDetail");
  const detailEnd = source.indexOf("function CurrencyDrawer", detailStart);
  const detail = source.slice(detailStart, detailEnd);

  assert.match(card, /className="price-block"[\s\S]*?className="product-card__footer"[\s\S]*?<StockLabel product=\{product\} lang=\{lang\} \/>[\s\S]*?className="product-cta"/u);
  assert.match(detail, /className="detail-price"[\s\S]*?className="detail-status-row"[\s\S]*?className="detail-time"[\s\S]*?<StockLabel product=\{product\} lang=\{lang\} \/>[\s\S]*?className="detail-actions"/u);
  assert.doesNotMatch(`${card}\n${detail}\n${styles}`, /product-price-stock|detail-price-stock|product-card__status/u);
  assert.match(styles, /\.product-card__footer\s*\{[^}]*justify-content:\s*space-between;[^}]*margin-top:\s*auto;/u);
  assert.match(styles, /\.detail-status-row\s*\{[^}]*flex-wrap:\s*wrap;[^}]*justify-content:\s*flex-start;/u);
  assert.match(styles, /\.price-line\s*\{[^}]*flex-wrap:\s*wrap;/u);
  assert.match(styles, /grid-template-rows:\s*40px 68px minmax\(72px,\s*1fr\);/u);
  assert.match(styles, /\.product-card__footer > \.stock-label\s*\{[^}]*justify-self:\s*start;/u);
  assert.match(styles, /\.price-line strong\s*\{[^}]*overflow:\s*visible;[^}]*text-overflow:\s*clip;/u);
});

test("public stock copy hides normal quantities and keeps exact low-stock urgency", async () => {
  const [source, data] = await Promise.all([
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/data.js", import.meta.url), "utf8"),
  ]);
  const start = source.indexOf("function StockLabel");
  const end = source.indexOf("function ProductCard", start);
  const stockLabel = source.slice(start, end);

  assert.match(stockLabel, /stock <= 3[\s\S]*?lowStock\.replace\("\{count\}", product\.stock\)/u);
  assert.match(stockLabel, /return <span className="stock-label"><i \/>\{t\.inStock\}<\/span>/u);
  assert.doesNotMatch(stockLabel, /\{t\.stock\}/u);
  assert.match(data, /lowStock:\s*"仅剩 \{count\}"/u);
  assert.match(data, /lowStock:\s*"Only \{count\} left"/u);
});
