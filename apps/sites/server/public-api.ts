import {
  DEFAULT_SHARE_TEMPLATE,
  DEFAULT_INVENTORY_RISK_THRESHOLD,
  INVENTORY_RISK_THRESHOLD_MAX,
  INVENTORY_RISK_THRESHOLD_MIN,
  isConfiguredContactChannel,
  type CategorySummary,
  type ContactChannelMode,
  type ContactChannelType,
  type Locale,
  type ProductDetail,
  type ProductSummary,
  type StorefrontConfig,
} from "@cloudbridge/contracts";
import {
  ApiInputError,
  pageMeta,
  parsePage,
  readJson,
  success,
} from "./http";
import { encryptOrderContact, hashOrderContact } from "./data-protection";
import { assertOrderRatesFresh } from "./exchange-rates";
import { multiplyDecimal, normalizeMoney } from "./money";
import { reconcileExpiredOrders } from "./order-expiry";
import { normalizeLegacyLineBreaks } from "./text";
import {
  getTelegramSettings,
  processTelegramDeliveries,
  telegramDeliveryInsert,
} from "./telegram";
import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
  SitesEnv,
  SitesExecutionContext,
} from "./types";

type Money = { amount: string; currency: string };

const configCacheControl = "public, max-age=15, s-maxage=60, stale-while-revalidate=120";
const categoriesCacheControl = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";
const productCacheControl = "public, max-age=5, s-maxage=15, stale-while-revalidate=30";

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

type PublicChannelRow = {
  type: ContactChannelType;
  mode: ContactChannelMode;
  label: string;
  account: string;
  directTarget: string | null;
  serviceHours: string;
};

export async function handlePublicApi(
  request: Request,
  env: SitesEnv,
  pathname: string,
  context?: SitesExecutionContext,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method === "GET" && pathname === "/v1/storefront/config") {
    return publicSuccess(
      await storefrontConfig(env.DB, localeFrom(url)),
      configCacheControl,
    );
  }
  if (request.method === "GET" && pathname === "/v1/categories") {
    return publicSuccess(
      await storefrontCategories(env.DB, localeFrom(url)),
      categoriesCacheControl,
    );
  }
  if (request.method === "GET" && pathname === "/v1/products") {
    scheduleExpiredOrderReconciliation(env.DB, context);
    const input = storefrontListingInput(url);
    const result = await storefrontProducts(env.DB, {
      locale: input.locale,
      currency: input.currency,
      category: input.category,
      search: input.search,
      pageSize: input.pageSize,
      offset: input.offset,
    });
    return publicSuccess(result.items, productCacheControl, {
      meta: pageMeta(input.page, input.pageSize, result.total),
    });
  }
  const productMatch = pathname.match(/^\/v1\/products\/([^/]+)$/u);
  if (request.method === "GET" && productMatch) {
    scheduleExpiredOrderReconciliation(env.DB, context);
    const product = await storefrontProduct(
      env.DB,
      decodeURIComponent(productMatch[1]),
      localeFrom(url),
      currencyFrom(url),
    );
    if (!product) throw new ApiInputError("PRODUCT_NOT_FOUND", "Product was not found.", 404);
    return publicSuccess(product, productCacheControl);
  }
  if (request.method === "POST" && pathname === "/v1/orders") {
    await reconcileExpiredOrders(env.DB);
    return createOrder(request, env, context);
  }
  return null;
}

export async function storefrontConfig(
  db: D1Database,
  locale: Locale,
): Promise<StorefrontConfig> {
  const localeCode = locale.toUpperCase();
  const [settingsResult, heroesResult, currenciesResult, channelsResult] =
    await db.batch<unknown>([
      db.prepare(
        "SELECT value_json AS valueJson FROM site_settings WHERE key = 'storefront.settings' LIMIT 1",
      ),
      db.prepare(
        `SELECT h.key, h.image_key AS imageUrl, h.target_slug AS targetSlug, h.tone,
          t.eyebrow, t.title, t.body, t.cta
         FROM heroes h
         JOIN hero_translations t ON t.hero_id = h.id AND t.locale = ?
         WHERE h.status = 'ACTIVE'
         ORDER BY h.sort_order ASC, h.id ASC`,
      ).bind(localeCode),
      db.prepare(
        `SELECT code, token, CASE WHEN ? = 'ZH' THEN name_zh ELSE name_en END AS name, digits
         FROM currencies WHERE active = 1 ORDER BY sort_order ASC, code ASC`,
      ).bind(localeCode),
      db.prepare(
        `SELECT type, mode,
          CASE WHEN ? = 'ZH' THEN label_zh ELSE label_en END AS label,
          public_account AS account, direct_target AS directTarget,
          CASE WHEN ? = 'ZH' THEN service_hours_zh ELSE service_hours_en END AS serviceHours
         FROM merchant_channels WHERE active = 1 ORDER BY sort_order ASC, id ASC`,
      ).bind(localeCode, localeCode),
    ]);
  const settingsRow = settingsResult?.results?.[0] as
    | { valueJson: string }
    | undefined;
  const storedSettings = parseSettings(settingsRow?.valueJson);
  const heroRows = (heroesResult?.results ?? []) as Array<{
    key: string;
    imageUrl: string;
    targetSlug: string | null;
    tone: "cyan" | "blue" | "violet" | "green";
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
  }>;
  const heroes = heroRows.map((hero) => ({
    ...hero,
    eyebrow: normalizeLegacyLineBreaks(hero.eyebrow),
    title: normalizeLegacyLineBreaks(hero.title),
    body: normalizeLegacyLineBreaks(hero.body),
    cta: normalizeLegacyLineBreaks(hero.cta),
  }));
  const currencies = (currenciesResult?.results ?? []) as Array<{
    code: string;
    token: string;
    name: string;
    digits: number;
  }>;
  const activeChannels = (channelsResult?.results ?? []) as PublicChannelRow[];
  const configuredChannels = activeChannels.filter((channel) => isConfiguredContactChannel({
    type: channel.type,
    mode: channel.mode,
    publicAccount: channel.account,
    directTarget: channel.directTarget,
  }));
  const supportEnabled = storedSettings.supportEnabled && configuredChannels.length > 0;
  const settings = {
    ...storedSettings,
    supportEnabled,
    acceptOrders: storedSettings.acceptOrders && supportEnabled,
  };
  const channels = supportEnabled ? configuredChannels.map((channel) => ({
    ...channel,
    directTarget: channel.type === "WECHAT" ? null : channel.directTarget,
    qrImageUrl: channel.type === "WECHAT" ? channel.directTarget : null,
  })) : [];

  return { heroes, currencies, channels, settings };
}

export async function storefrontCategories(
  db: D1Database,
  locale: Locale,
): Promise<CategorySummary[]> {
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

export async function storefrontProducts(
  db: D1Database,
  input: {
    locale: Locale;
    currency: string;
    category: string;
    search: string;
    pageSize: number;
    offset: number;
  },
): Promise<{ items: ProductSummary[]; total: number }> {
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
  const countStatement = db.prepare(
    `SELECT COUNT(*) AS total
     FROM products p
     JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = ?
     JOIN categories c ON c.id = p.category_id
     JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE ${where}`,
  ).bind(...bindings);

  const rowsStatement = db.prepare(
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
  ).bind(...bindings, input.pageSize, input.offset);

  const [currencyStatement, referenceStatement] = pricingStatements(
    db,
    input.currency,
  );
  const [countResult, rowsResult, currencyResult, referenceResult] =
    await db.batch<unknown>([
      countStatement,
      rowsStatement,
      currencyStatement,
      referenceStatement,
    ]);
  const countRow = countResult?.results?.[0] as { total: number } | undefined;
  const rows = (rowsResult?.results ?? []) as ProductRow[];
  const pricing = pricingContextFromResults(currencyResult, referenceResult);
  return {
    items: rows.map((row) => productSummary(row, pricing)),
    total: Number(countRow?.total ?? 0),
  };
}

export async function storefrontProduct(
  db: D1Database,
  slug: string,
  locale: Locale,
  currency: string,
): Promise<ProductDetail | null> {
  const localeCode = locale.toUpperCase();
  const productStatement = db.prepare(
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
  ).bind(localeCode, localeCode, slug);
  const [currencyStatement, referenceStatement] = pricingStatements(db, currency);
  const [productResult, currencyResult, referenceResult] =
    await db.batch<unknown>([
      productStatement,
      currencyStatement,
      referenceStatement,
    ]);
  const row = productResult?.results?.[0] as ProductRow | undefined;
  if (!row) return null;
  const pricing = pricingContextFromResults(currencyResult, referenceResult);
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

async function createOrder(
  request: Request,
  env: SitesEnv,
  context?: SitesExecutionContext,
): Promise<Response> {
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
  if (!settings.acceptOrders || !settings.supportEnabled) {
    throw new ApiInputError("ORDERS_PAUSED", "Orders are currently paused.", 409);
  }
  if (policyVersion !== settings.policyVersion) {
    throw new ApiInputError("POLICY_VERSION_CHANGED", "The policy version changed. Review and try again.", 409);
  }

  const channel = await env.DB.prepare(
    `SELECT type, mode, public_account AS publicAccount, direct_target AS directTarget
     FROM merchant_channels WHERE type = ? AND active = 1 LIMIT 1`,
  ).bind(contactChannel).first<{
    type: ContactChannelType;
    mode: ContactChannelMode;
    publicAccount: string;
    directTarget: string | null;
  }>();
  if (!channel || !isConfiguredContactChannel(channel)) {
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

  await assertOrderRatesFresh(env.DB, currency);
  const pricing = await pricingContext(env.DB, currency);
  const amount = multiplyDecimal(product.basePrice, pricing.rate, pricing.digits);
  if (
    body.expectedPrice?.currency !== currency
    || typeof body.expectedPrice.amount !== "string"
    || normalizeMoney(body.expectedPrice.amount, pricing.digits) !== amount
  ) {
    throw new ApiInputError("PRICE_CHANGED", "The current price changed. Review and try again.", 409);
  }

  const contactEncrypted = await encryptOrderContact(
    contactValue,
    env.CLOUDBRIDGE_DATA_KEY,
    env.CLOUDBRIDGE_DATA_KEY_NEXT,
  );
  const contactHash = await hashOrderContact(
    contactValue,
    env.CLOUDBRIDGE_DATA_KEY,
    env.CLOUDBRIDGE_DATA_KEY_NEXT,
  );
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
  const telegramSettings = await getTelegramSettings(env);
  const queueTelegram = telegramDeliveryInsert(env.DB, telegramSettings, {
    orderId: id,
    orderNumber,
    product: product.name,
    amount,
    currency,
    status: "MANUAL_PENDING",
    createdAt: now.toISOString(),
    contactChannel,
    maskedContact,
  });

  try {
    await env.DB.batch([
      insertOrder,
      insertHistory,
      decrementStock,
      ...(queueTelegram ? [queueTelegram] : []),
    ]);
  } catch (error) {
    const concurrent = await orderReceiptByIdempotency(env.DB, idempotencyKey);
    if (concurrent) return success(concurrent);
    throw new ApiInputError("ORDER_CONFLICT", "The order could not be reserved. Refresh and try again.", 409);
  }
  if (queueTelegram) {
    const delivery = processTelegramDeliveries(env).catch(() => undefined);
    if (context) context.waitUntil(delivery);
    else await delivery;
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

type PricingContext = {
  currency: string;
  digits: number;
  rate: string;
  referenceDigits: number;
  referenceRate: string;
};

function pricingStatements(
  db: D1Database,
  currency: string,
): [D1PreparedStatement, D1PreparedStatement] {
  return [
    db.prepare(
    `SELECT c.code, c.digits, r.rate
     FROM currencies c
     JOIN exchange_rates r ON r.to_code = c.code AND r.from_code = 'MYR'
     WHERE c.code = ? AND c.active = 1
     ORDER BY r.effective_at DESC LIMIT 1`,
    ).bind(currency),
    db.prepare(
      `SELECT c.digits, r.rate
       FROM currencies c
       JOIN exchange_rates r ON r.to_code = c.code AND r.from_code = 'MYR'
       WHERE c.code = 'USDT' AND c.active = 1
       ORDER BY r.effective_at DESC LIMIT 1`,
    ),
  ];
}

function pricingContextFromResults(
  currencyResult: D1Result<unknown> | undefined,
  referenceResult: D1Result<unknown> | undefined,
): PricingContext {
  const currencyRow = currencyResult?.results?.[0] as
    | { code: string; digits: number; rate: string }
    | undefined;
  if (!currencyRow) {
    throw new ApiInputError("CURRENCY_UNAVAILABLE", "The selected currency is unavailable.", 422);
  }
  const reference = referenceResult?.results?.[0] as
    | { digits: number; rate: string }
    | undefined;
  return {
    currency: currencyRow.code,
    digits: currencyRow.digits,
    rate: currencyRow.rate,
    referenceDigits: reference?.digits ?? 2,
    referenceRate: reference?.rate ?? "1.0000000000",
  };
}

async function pricingContext(
  db: D1Database,
  currency: string,
): Promise<PricingContext> {
  const [currencyStatement, referenceStatement] = pricingStatements(db, currency);
  const [currencyResult, referenceResult] = await db.batch<unknown>([
    currencyStatement,
    referenceStatement,
  ]);
  return pricingContextFromResults(currencyResult, referenceResult);
}

function productSummary(
  row: ProductRow,
  pricing: PricingContext,
): ProductSummary {
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

export function storefrontListingInput(url: URL): {
  locale: Locale;
  currency: string;
  category: string;
  search: string;
  page: number;
  pageSize: number;
  offset: number;
} {
  const { page, pageSize, offset } = parsePage(url, {
    page: 1,
    pageSize: 48,
  });
  return {
    locale: localeFrom(url),
    currency: currencyFrom(url),
    category: url.searchParams.get("category")?.trim().slice(0, 80) ?? "",
    search: normalizeSearch(url.searchParams.get("search") ?? ""),
    page,
    pageSize,
    offset,
  };
}

let lastReconciliationStartedAt = 0;
let activeReconciliation: Promise<unknown> | null = null;

export function scheduleExpiredOrderReconciliation(
  db: D1Database,
  context?: SitesExecutionContext,
): void {
  if (!context) return;
  const now = Date.now();
  if (activeReconciliation || now - lastReconciliationStartedAt < 30_000) return;
  lastReconciliationStartedAt = now;
  activeReconciliation = reconcileExpiredOrders(db)
    .catch((error: unknown) => {
      console.error("[cloudbridge] Expired order reconciliation failed", error);
    })
    .finally(() => {
      activeReconciliation = null;
    });
  context.waitUntil(activeReconciliation);
}

function publicSuccess<T>(
  data: T,
  cacheControl: string,
  options?: {
    meta?: { page: number; pageSize: number; total: number; pageCount: number };
  },
): Response {
  const response = success(data, options);
  response.headers.set("cache-control", cacheControl);
  response.headers.set("vary", "accept-encoding");
  return response;
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
    inventoryRiskThreshold: DEFAULT_INVENTORY_RISK_THRESHOLD,
    transitServiceEnabled: true,
    transitServiceUrl: null,
    shareTemplate: DEFAULT_SHARE_TEMPLATE,
  };
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as Partial<typeof fallback>;
    const policyVersion = typeof parsed.policyVersion === "string"
      && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(parsed.policyVersion.trim())
      ? parsed.policyVersion.trim()
      : fallback.policyVersion;
    return {
      ...fallback,
      ...parsed,
      siteName: { ...fallback.siteName, ...parsed.siteName },
      seoDescription: { ...fallback.seoDescription, ...parsed.seoDescription },
      shareTemplate: { ...fallback.shareTemplate, ...parsed.shareTemplate },
      policyVersion,
      acceptOrders: parsed.acceptOrders === true,
      supportEnabled: parsed.supportEnabled === true,
      inventoryRiskThreshold: Number.isSafeInteger(parsed.inventoryRiskThreshold)
        && Number(parsed.inventoryRiskThreshold) >= INVENTORY_RISK_THRESHOLD_MIN
        && Number(parsed.inventoryRiskThreshold) <= INVENTORY_RISK_THRESHOLD_MAX
        ? Number(parsed.inventoryRiskThreshold)
        : DEFAULT_INVENTORY_RISK_THRESHOLD,
      transitServiceEnabled: parsed.transitServiceEnabled !== false,
      transitServiceUrl: typeof parsed.transitServiceUrl === "string"
        ? parsed.transitServiceUrl
        : null,
    };
  } catch {
    return fallback;
  }
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
