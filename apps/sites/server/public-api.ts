import {
  ApiInputError,
  pageMeta,
  parsePage,
  readJson,
  success,
} from "./http";
import { multiplyDecimal, normalizeMoney } from "./money";
import type { D1Database, SitesEnv } from "./types";

type Locale = "zh" | "en";
type Money = { amount: string; currency: string };

type ProductRow = {
  id: string;
  slug: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  categoryOrder: number;
  name: string;
  kicker: string;
  description: string;
  imageKey: string;
  basePrice: string;
  compareAtPrice: string | null;
  stockMode: "FINITE" | "UNLIMITED";
  stockQuantity: number | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
  version: number;
};

export async function handlePublicApi(
  request: Request,
  env: SitesEnv,
  pathname: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method === "GET" && pathname === "/v1/storefront/config") {
    return success(await storefrontConfig(env.DB, localeFrom(url)));
  }
  if (request.method === "GET" && pathname === "/v1/categories") {
    return success(await storefrontCategories(env.DB, localeFrom(url)));
  }
  if (request.method === "GET" && pathname === "/v1/products") {
    const locale = localeFrom(url);
    const { page, pageSize, offset } = parsePage(url, { page: 1, pageSize: 48 });
    const currency = currencyFrom(url);
    const category = url.searchParams.get("category")?.trim().slice(0, 80) ?? "";
    const search = normalizeSearch(url.searchParams.get("search") ?? "");
    const result = await storefrontProducts(env.DB, {
      locale,
      currency,
      category,
      search,
      pageSize,
      offset,
    });
    return success(result.items, { meta: pageMeta(page, pageSize, result.total) });
  }
  const productMatch = pathname.match(/^\/v1\/products\/([^/]+)$/u);
  if (request.method === "GET" && productMatch) {
    const product = await storefrontProduct(
      env.DB,
      decodeURIComponent(productMatch[1]),
      localeFrom(url),
      currencyFrom(url),
    );
    if (!product) throw new ApiInputError("PRODUCT_NOT_FOUND", "Product was not found.", 404);
    return success(product);
  }
  if (request.method === "POST" && pathname === "/v1/orders") {
    return createOrder(request, env);
  }
  return null;
}

async function storefrontConfig(db: D1Database, locale: Locale) {
  const localeCode = locale.toUpperCase();
  const settingsRow = await db.prepare(
    "SELECT value_json AS valueJson FROM site_settings WHERE key = 'storefront.settings' LIMIT 1",
  ).first<{ valueJson: string }>();
  const settings = parseSettings(settingsRow?.valueJson);

  const heroes = (await db.prepare(
    `SELECT h.key, h.image_key AS imageUrl, h.target_slug AS targetSlug, h.tone,
      t.eyebrow, t.title, t.body, t.cta
     FROM heroes h
     JOIN hero_translations t ON t.hero_id = h.id AND t.locale = ?
     WHERE h.status = 'ACTIVE'
     ORDER BY h.sort_order ASC, h.id ASC`,
  ).bind(localeCode).all<{
    key: string;
    imageUrl: string;
    targetSlug: string | null;
    tone: "cyan" | "blue" | "violet" | "green";
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
  }>()).results ?? [];

  const currencies = (await db.prepare(
    `SELECT code, token, CASE WHEN ? = 'ZH' THEN name_zh ELSE name_en END AS name, digits
     FROM currencies WHERE active = 1 ORDER BY sort_order ASC, code ASC`,
  ).bind(localeCode).all<{
    code: string;
    token: string;
    name: string;
    digits: number;
  }>()).results ?? [];

  const channels = settings.supportEnabled
    ? (await db.prepare(
        `SELECT type, mode,
          CASE WHEN ? = 'ZH' THEN label_zh ELSE label_en END AS label,
          public_account AS account, direct_target AS directTarget,
          CASE WHEN ? = 'ZH' THEN service_hours_zh ELSE service_hours_en END AS serviceHours
         FROM merchant_channels WHERE active = 1 ORDER BY sort_order ASC, id ASC`,
      ).bind(localeCode, localeCode).all<{
        type: string;
        mode: string;
        label: string;
        account: string;
        directTarget: string | null;
        serviceHours: string;
      }>()).results ?? []
    : [];

  return { heroes, currencies, channels, settings };
}

async function storefrontCategories(db: D1Database, locale: Locale) {
  const rows = await db.prepare(
    `SELECT c.id, c.slug, t.name, c.sort_order AS "order"
     FROM categories c
     JOIN category_translations t ON t.category_id = c.id AND t.locale = ?
     WHERE c.status = 'ACTIVE'
     ORDER BY c.sort_order ASC, c.id ASC`,
  ).bind(locale.toUpperCase()).all<{
    id: string;
    slug: string;
    name: string;
    order: number;
  }>();
  return rows.results ?? [];
}

async function storefrontProducts(
  db: D1Database,
  input: {
    locale: Locale;
    currency: string;
    category: string;
    search: string;
    pageSize: number;
    offset: number;
  },
): Promise<{ items: unknown[]; total: number }> {
  const localeCode = input.locale.toUpperCase();
  const conditions = ["p.status = 'ACTIVE'"];
  const bindings: unknown[] = [localeCode, localeCode];
  if (input.category) {
    conditions.push("c.slug = ?");
    bindings.push(input.category);
  }
  if (input.search) {
    conditions.push("(pt.normalized_name LIKE ? OR LOWER(pt.name) LIKE ? OR LOWER(COALESCE(pt.aliases_json, '')) LIKE ?)");
    const pattern = `%${input.search}%`;
    bindings.push(pattern, pattern, pattern);
  }
  const where = conditions.join(" AND ");
  const countRow = await db.prepare(
    `SELECT COUNT(*) AS total
     FROM products p
     JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = ?
     JOIN categories c ON c.id = p.category_id
     JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE ${where}`,
  ).bind(...bindings).first<{ total: number }>();

  const rows = await db.prepare(
    `SELECT p.id, p.slug, p.category_id AS categoryId, c.slug AS categorySlug,
      ct.name AS categoryName, c.sort_order AS categoryOrder,
      pt.name, pt.kicker, pt.description, p.image_key AS imageKey,
      p.base_price AS basePrice, p.compare_at_price AS compareAtPrice,
      p.stock_mode AS stockMode, p.stock_quantity AS stockQuantity,
      p.status, p.version
     FROM products p
     JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = ?
     JOIN categories c ON c.id = p.category_id
     JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE ${where}
     ORDER BY p.sort_order ASC, p.id ASC
     LIMIT ? OFFSET ?`,
  ).bind(...bindings, input.pageSize, input.offset).all<ProductRow>();

  const pricing = await pricingContext(db, input.currency);
  return {
    items: (rows.results ?? []).map((row) => productSummary(row, pricing)),
    total: Number(countRow?.total ?? 0),
  };
}

async function storefrontProduct(
  db: D1Database,
  slug: string,
  locale: Locale,
  currency: string,
) {
  const localeCode = locale.toUpperCase();
  const row = await db.prepare(
    `SELECT p.id, p.slug, p.category_id AS categoryId, c.slug AS categorySlug,
      ct.name AS categoryName, c.sort_order AS categoryOrder,
      pt.name, pt.kicker, pt.description, p.image_key AS imageKey,
      p.base_price AS basePrice, p.compare_at_price AS compareAtPrice,
      p.stock_mode AS stockMode, p.stock_quantity AS stockQuantity,
      p.status, p.version
     FROM products p
     JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = ?
     JOIN categories c ON c.id = p.category_id
     JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE p.slug = ? AND p.status = 'ACTIVE'
     LIMIT 1`,
  ).bind(localeCode, localeCode, slug).first<ProductRow>();
  if (!row) return null;
  const pricing = await pricingContext(db, currency);
  return {
    ...productSummary(row, pricing),
    description: row.description,
    category: {
      id: row.categoryId,
      slug: row.categorySlug,
      name: row.categoryName,
      order: row.categoryOrder,
    },
  };
}

async function createOrder(request: Request, env: SitesEnv): Promise<Response> {
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 120) {
    throw new ApiInputError("IDEMPOTENCY_KEY_REQUIRED", "A valid idempotency key is required.", 400);
  }

  const existing = await orderReceiptByIdempotency(env.DB, idempotencyKey);
  if (existing) return success(existing);

  const body = await readJson<{
    locale?: unknown;
    productId?: unknown;
    currency?: unknown;
    contactChannel?: unknown;
    contactValue?: unknown;
    acceptedPolicyVersion?: unknown;
    expectedPrice?: { amount?: unknown; currency?: unknown };
  }>(request);
  const locale = body.locale === "en" ? "en" : body.locale === "zh" ? "zh" : null;
  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
  const contactChannel = typeof body.contactChannel === "string" ? body.contactChannel.trim().toUpperCase() : "";
  const contactValue = typeof body.contactValue === "string" ? body.contactValue.trim() : "";
  const policyVersion = typeof body.acceptedPolicyVersion === "string"
    ? body.acceptedPolicyVersion.trim()
    : "";
  if (!locale || !productId || !currency || !contactValue || contactValue.length > 240) {
    throw new ApiInputError("ORDER_VALIDATION_FAILED", "The order details are incomplete.", 422);
  }

  const settingsRow = await env.DB.prepare(
    "SELECT value_json AS valueJson FROM site_settings WHERE key = 'storefront.settings' LIMIT 1",
  ).first<{ valueJson: string }>();
  const settings = parseSettings(settingsRow?.valueJson);
  if (!settings.acceptOrders) {
    throw new ApiInputError("ORDERS_PAUSED", "Orders are currently paused.", 409);
  }
  if (policyVersion !== settings.policyVersion) {
    throw new ApiInputError("POLICY_VERSION_CHANGED", "The policy version changed. Review and try again.", 409);
  }

  const channel = await env.DB.prepare(
    "SELECT type FROM merchant_channels WHERE type = ? AND active = 1 LIMIT 1",
  ).bind(contactChannel).first<{ type: string }>();
  if (!channel) {
    throw new ApiInputError("CONTACT_CHANNEL_UNAVAILABLE", "The selected contact channel is unavailable.", 422);
  }

  const product = await env.DB.prepare(
    `SELECT p.id, p.slug, p.base_price AS basePrice, p.stock_mode AS stockMode,
      p.stock_quantity AS stockQuantity, p.status, p.version, pt.name
     FROM products p
     JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = ?
     WHERE p.id = ? LIMIT 1`,
  ).bind(locale.toUpperCase(), productId).first<{
    id: string;
    slug: string;
    basePrice: string;
    stockMode: "FINITE" | "UNLIMITED";
    stockQuantity: number | null;
    status: string;
    version: number;
    name: string;
  }>();
  if (!product || product.status !== "ACTIVE") {
    throw new ApiInputError("PRODUCT_UNAVAILABLE", "The selected product is unavailable.", 409);
  }
  if (product.stockMode === "FINITE" && Number(product.stockQuantity ?? 0) <= 0) {
    throw new ApiInputError("OUT_OF_STOCK", "The selected product is sold out.", 409);
  }

  const pricing = await pricingContext(env.DB, currency);
  const amount = multiplyDecimal(product.basePrice, pricing.rate, pricing.digits);
  if (
    body.expectedPrice?.currency !== currency
    || typeof body.expectedPrice.amount !== "string"
    || normalizeMoney(body.expectedPrice.amount, pricing.digits) !== amount
  ) {
    throw new ApiInputError("PRICE_CHANGED", "The current price changed. Review and try again.", 409);
  }

  const contactEncrypted = await encryptContact(contactValue, env.CLOUDBRIDGE_DATA_KEY);
  const contactHash = await sha256(contactValue.toLocaleLowerCase());
  const maskedContact = maskContact(contactValue);
  const now = new Date();
  const reservedUntil = new Date(now.getTime() + 30 * 60_000).toISOString();
  const id = crypto.randomUUID();
  const historyId = crypto.randomUUID();
  const orderNumber = `CB${now.toISOString().slice(0, 10).replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  const referenceAmount = currency === "USDT"
    ? null
    : {
        amount: multiplyDecimal(product.basePrice, pricing.referenceRate, pricing.referenceDigits),
        currency: "USDT",
      };

  const insertOrder = env.DB.prepare(
    `INSERT INTO orders (
      id, order_number, idempotency_key, product_id, product_name_snapshot,
      currency_code, amount, reference_currency_code, reference_amount,
      exchange_rate_snapshot, product_version, contact_channel, contact_encrypted,
      contact_hash, masked_contact, accepted_policy_version, status, payment_mode,
      reserved_until, inventory_reserved, inventory_released_at, assigned_to_id,
      created_at, updated_at
    )
    SELECT ?, ?, ?, p.id, ?, ?, ?, ?, ?, ?, p.version, ?, ?, ?, ?, ?,
      'MANUAL_PENDING', 'MANUAL', ?, CASE WHEN p.stock_mode = 'FINITE' THEN 1 ELSE 0 END,
      NULL, NULL, ?, ?
    FROM products p
    WHERE p.id = ? AND p.status = 'ACTIVE'
      AND (p.stock_mode = 'UNLIMITED' OR COALESCE(p.stock_quantity, 0) > 0)`,
  ).bind(
    id,
    orderNumber,
    idempotencyKey,
    product.name,
    currency,
    amount,
    referenceAmount?.currency ?? null,
    referenceAmount?.amount ?? null,
    pricing.rate,
    contactChannel,
    contactEncrypted,
    contactHash,
    maskedContact,
    policyVersion,
    reservedUntil,
    now.toISOString(),
    now.toISOString(),
    product.id,
  );
  const insertHistory = env.DB.prepare(
    "INSERT INTO order_status_history (id, order_id, from_status, to_status, reason, actor_email, created_at) VALUES (?, ?, NULL, 'MANUAL_PENDING', ?, NULL, ?)",
  ).bind(historyId, id, "Storefront order created", now.toISOString());
  const decrementStock = env.DB.prepare(
    `UPDATE products
     SET stock_quantity = stock_quantity - 1, version = version + 1, updated_at = ?
     WHERE id = ? AND stock_mode = 'FINITE' AND stock_quantity > 0`,
  ).bind(now.toISOString(), product.id);

  try {
    await env.DB.batch([insertOrder, insertHistory, decrementStock]);
  } catch (error) {
    const concurrent = await orderReceiptByIdempotency(env.DB, idempotencyKey);
    if (concurrent) return success(concurrent);
    throw new ApiInputError("ORDER_CONFLICT", "The order could not be reserved. Refresh and try again.", 409);
  }

  return success({
    orderNumber,
    status: "MANUAL_PENDING",
    productName: product.name,
    amount: { amount, currency },
    referenceAmount,
    contactChannel,
    maskedContact,
    reservedUntil,
  }, { status: 201 });
}

async function orderReceiptByIdempotency(db: D1Database, idempotencyKey: string) {
  const row = await db.prepare(
    `SELECT order_number AS orderNumber, status, product_name_snapshot AS productName,
      amount, currency_code AS currency, reference_amount AS referenceAmount,
      reference_currency_code AS referenceCurrency, contact_channel AS contactChannel,
      masked_contact AS maskedContact, reserved_until AS reservedUntil
     FROM orders WHERE idempotency_key = ? LIMIT 1`,
  ).bind(idempotencyKey).first<{
    orderNumber: string;
    status: string;
    productName: string;
    amount: string;
    currency: string;
    referenceAmount: string | null;
    referenceCurrency: string | null;
    contactChannel: string;
    maskedContact: string;
    reservedUntil: string;
  }>();
  if (!row) return null;
  return {
    orderNumber: row.orderNumber,
    status: row.status,
    productName: row.productName,
    amount: { amount: row.amount, currency: row.currency },
    referenceAmount: row.referenceAmount && row.referenceCurrency
      ? { amount: row.referenceAmount, currency: row.referenceCurrency }
      : null,
    contactChannel: row.contactChannel,
    maskedContact: row.maskedContact,
    reservedUntil: row.reservedUntil,
  };
}

async function pricingContext(db: D1Database, currency: string) {
  const currencyRow = await db.prepare(
    `SELECT c.code, c.digits, r.rate
     FROM currencies c
     JOIN exchange_rates r ON r.to_code = c.code AND r.from_code = 'MYR'
     WHERE c.code = ? AND c.active = 1
     ORDER BY r.effective_at DESC LIMIT 1`,
  ).bind(currency).first<{ code: string; digits: number; rate: string }>();
  if (!currencyRow) {
    throw new ApiInputError("CURRENCY_UNAVAILABLE", "The selected currency is unavailable.", 422);
  }
  const reference = await db.prepare(
    `SELECT c.digits, r.rate
     FROM currencies c
     JOIN exchange_rates r ON r.to_code = c.code AND r.from_code = 'MYR'
     WHERE c.code = 'USDT' AND c.active = 1
     ORDER BY r.effective_at DESC LIMIT 1`,
  ).first<{ digits: number; rate: string }>();
  return {
    currency: currencyRow.code,
    digits: currencyRow.digits,
    rate: currencyRow.rate,
    referenceDigits: reference?.digits ?? 2,
    referenceRate: reference?.rate ?? "1.0000000000",
  };
}

function productSummary(
  row: ProductRow,
  pricing: Awaited<ReturnType<typeof pricingContext>>,
) {
  const price: Money = {
    amount: multiplyDecimal(row.basePrice, pricing.rate, pricing.digits),
    currency: pricing.currency,
  };
  const compareAtPrice = row.compareAtPrice
    ? {
        amount: multiplyDecimal(row.compareAtPrice, pricing.rate, pricing.digits),
        currency: pricing.currency,
      }
    : null;
  const referencePrice = pricing.currency === "USDT"
    ? null
    : {
        amount: multiplyDecimal(row.basePrice, pricing.referenceRate, pricing.referenceDigits),
        currency: "USDT",
      };
  return {
    id: row.id,
    slug: row.slug,
    categoryId: row.categoryId,
    name: row.name,
    kicker: row.kicker,
    imageUrl: row.imageKey,
    price,
    compareAtPrice,
    referencePrice,
    stockMode: row.stockMode,
    stockQuantity: row.stockQuantity,
    status: row.status,
  };
}

function localeFrom(url: URL): Locale {
  return url.searchParams.get("locale") === "en" ? "en" : "zh";
}

function currencyFrom(url: URL): string {
  return (url.searchParams.get("currency") ?? "CNY").trim().toUpperCase().slice(0, 4);
}

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase().slice(0, 120);
}

function parseSettings(value: string | undefined) {
  const fallback = {
    siteName: { zh: "云桥", en: "CloudBridge" },
    defaultLocale: "zh" as const,
    seoDescription: {
      zh: "精选全球 AI 工具，以清楚的价格、库存与人工服务连接需求。",
      en: "Global AI services with clear pricing, availability, and human support.",
    },
    policyVersion: "2026-07-29",
    acceptOrders: false,
    supportEnabled: false,
    transitServiceEnabled: false,
    transitServiceUrl: null,
  };
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as typeof fallback;
    return {
      ...fallback,
      ...parsed,
      siteName: { ...fallback.siteName, ...parsed.siteName },
      seoDescription: { ...fallback.seoDescription, ...parsed.seoDescription },
    };
  } catch {
    return fallback;
  }
}

async function encryptContact(value: string, encodedKey: string | undefined): Promise<string> {
  if (!encodedKey) {
    throw new ApiInputError(
      "ORDER_ENCRYPTION_NOT_CONFIGURED",
      "Order encryption is not configured. Orders remain paused.",
      503,
    );
  }
  const keyBytes = decodeBase64Url(encodedKey);
  if (keyBytes.byteLength !== 32) {
    throw new ApiInputError("ORDER_ENCRYPTION_INVALID", "Order encryption is unavailable.", 503);
  }
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
  return `v1.${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(encrypted))}`;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function maskContact(value: string): string {
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
  }
  const compact = value.replace(/\s+/gu, "");
  if (compact.length <= 4) return "*".repeat(compact.length);
  return `${compact.slice(0, 2)}${"*".repeat(Math.max(3, compact.length - 4))}${compact.slice(-2)}`;
}

function decodeBase64Url(value: string): ArrayBuffer {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0)).buffer as ArrayBuffer;
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
