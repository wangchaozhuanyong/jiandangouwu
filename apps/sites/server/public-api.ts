import {
  DEFAULT_SHARE_TEMPLATE,
  DEFAULT_INVENTORY_RISK_THRESHOLD,
  INVENTORY_RISK_THRESHOLD_MAX,
  INVENTORY_RISK_THRESHOLD_MIN,
  bannerPlacements,
  isConfiguredContactChannel,
  platformKeys,
  productSurfaces,
  skillResourceTypes,
  skillSourceLevels,
  transitPlanTypes,
  type BannerPlacement,
  type CategorySummary,
  type ContactChannelMode,
  type ContactChannelType,
  type Locale,
  type ProductDetail,
  type ProductSurface,
  type ProductSummary,
  type SkillCategorySummary,
  type SkillDetail,
  type SkillResourceType,
  type SkillSourceLevel,
  type SkillSummary,
  type StorefrontBanner,
  type StorefrontConfig,
} from "@cloudbridge/contracts";
import {
  ApiInputError,
  failure,
  pageMeta,
  parsePage,
  readJson,
  success,
} from "./http";
import {
  encryptOrderContact,
  hashOrderContact,
  hashOrderLookupSubject,
} from "./data-protection";
import { assertOrderRatesFresh } from "./exchange-rates";
import { multiplyDecimal, normalizeMoney, sumDecimalAmounts } from "./money";
import { reconcileExpiredOrders } from "./order-expiry";
import { normalizeLegacyLineBreaks } from "./text";
import {
  getTelegramSettings,
  processTelegramDeliveries,
  telegramDeliveryInsert,
} from "./telegram";
import { chinaDateKey } from "./time";
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
const contentCacheControl = "public, max-age=30, s-maxage=120, stale-while-revalidate=300";

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
  platformKey: ProductSummary["platformKey"];
  transitPlanType: ProductSummary["transitPlanType"];
};

type SkillRow = {
  id: string;
  slug: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  categoryOrder: number;
  name: string;
  summary: string;
  description: string;
  resourceType: SkillResourceType;
  sourceLevel: SkillSourceLevel;
  maintainer: string;
  githubUrl: string;
  documentationUrl: string | null;
  license: string;
  compatibleEnvironmentsJson: string;
  suitableForJson: string;
  unsuitableForJson: string;
  installHint: string;
  verifiedAt: string;
};

type CreateOrderBody = {
  locale?: unknown;
  productId?: unknown;
  items?: unknown;
  currency?: unknown;
  contactChannel?: unknown;
  contactValue?: unknown;
  acceptedPolicyVersion?: unknown;
  expectedPrice?: { amount?: unknown; currency?: unknown };
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
    const surface = optionalEnumParam(url, "surface", productSurfaces);
    if (surface || url.searchParams.get("hierarchy") === "tree") {
      return publicSuccess(
        await storefrontCategoryTree(env.DB, localeFrom(url), surface),
        categoriesCacheControl,
      );
    }
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
      surface: input.surface,
      platform: input.platform,
      transitPlanType: input.transitPlanType,
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
  if (request.method === "GET" && pathname === "/v1/banners") {
    const placement = optionalEnumParam(url, "placement", bannerPlacements) ?? "HOME";
    return publicSuccess(
      await storefrontBanners(env.DB, localeFrom(url), placement),
      contentCacheControl,
    );
  }
  if (request.method === "GET" && pathname === "/v1/skills/categories") {
    return publicSuccess(
      await storefrontSkillCategories(env.DB, localeFrom(url)),
      categoriesCacheControl,
    );
  }
  if (request.method === "GET" && pathname === "/v1/skills") {
    const input = storefrontSkillListingInput(url);
    const result = await storefrontSkills(env.DB, input);
    return publicSuccess(result.items, contentCacheControl, {
      meta: pageMeta(input.page, input.pageSize, result.total),
    });
  }
  const skillMatch = pathname.match(/^\/v1\/skills\/([^/]+)$/u);
  if (request.method === "GET" && skillMatch) {
    const skill = await storefrontSkill(
      env.DB,
      decodeURIComponent(skillMatch[1]),
      localeFrom(url),
    );
    if (!skill) throw new ApiInputError("SKILL_NOT_FOUND", "Skill was not found.", 404);
    return publicSuccess(skill, contentCacheControl);
  }
  if (request.method === "POST" && pathname === "/v1/orders/lookup") {
    return orderLookupResponse(request, env);
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
         WHERE h.status = 'ACTIVE' AND h.placement = 'HOME'
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
     JOIN categories parent ON parent.id = c.parent_id
     WHERE c.status = 'ACTIVE' AND parent.status = 'ACTIVE'
     ORDER BY c.sort_order ASC, c.id ASC`,
  ).bind(locale.toUpperCase()).all<{
    id: string;
    slug: string;
    name: string;
    order: number;
  }>();
  return rows.results ?? [];
}

export async function storefrontCategoryTree(
  db: D1Database,
  locale: Locale,
  surface: ProductSurface | null,
): Promise<CategorySummary[]> {
  const localeCode = locale.toUpperCase();
  const categoryStatement = db.prepare(
    `SELECT c.id, c.slug, c.parent_id AS parentId, t.name, c.sort_order AS "order"
     FROM categories c
     JOIN category_translations t ON t.category_id = c.id AND t.locale = ?
     LEFT JOIN categories parent ON parent.id = c.parent_id
     WHERE c.status = 'ACTIVE' AND (c.parent_id IS NULL OR parent.status = 'ACTIVE')
     ORDER BY c.sort_order ASC, c.id ASC`,
  ).bind(localeCode);
  const populatedStatement = surface
    ? db.prepare(
        `SELECT DISTINCT p.category_id AS categoryId
         FROM products p
         JOIN product_surfaces ps ON ps.product_id = p.id
         WHERE p.status = 'ACTIVE' AND ps.surface = ? AND ps.is_visible = 1`,
      ).bind(surface)
    : db.prepare(
        "SELECT DISTINCT category_id AS categoryId FROM products WHERE status = 'ACTIVE'",
      );
  const [categoryResult, populatedResult] = await db.batch<unknown>([
    categoryStatement,
    populatedStatement,
  ]);
  const rows = (categoryResult?.results ?? []) as Array<CategorySummary & { parentId: string | null }>;
  const populated = new Set(
    ((populatedResult?.results ?? []) as Array<{ categoryId: string }>).map((row) => row.categoryId),
  );
  const parents = rows.filter((row) => row.parentId === null);
  return parents.flatMap((parent) => {
    const children = rows.filter((row) => row.parentId === parent.id && populated.has(row.id));
    if (children.length === 0) return [];
    return [{ ...parent, children }];
  });
}

export async function storefrontBanners(
  db: D1Database,
  locale: Locale,
  placement: BannerPlacement,
): Promise<StorefrontBanner[]> {
  const localeCode = locale.toUpperCase();
  const bannerStatement = db.prepare(
    `SELECT h.key, h.image_key AS imageUrl, h.mobile_image_key AS mobileImageUrl,
      h.target_slug AS targetSlug, h.target_type AS targetType,
      COALESCE(h.target_value, h.target_slug) AS targetValue,
      h.secondary_target_type AS secondaryTargetType,
      h.secondary_target_value AS secondaryTargetValue,
      CASE WHEN ? = 'ZH' THEN h.secondary_cta_zh ELSE h.secondary_cta_en END AS secondaryCta,
      h.tone, h.placement, t.eyebrow, t.title, t.body, t.cta
     FROM heroes h
     JOIN hero_translations t ON t.hero_id = h.id AND t.locale = ?
     WHERE h.status = 'ACTIVE' AND h.placement = ?
     ORDER BY h.sort_order ASC, h.id ASC`,
  ).bind(localeCode, localeCode, placement);
  const settingsStatement = db.prepare(
    "SELECT value_json AS valueJson FROM site_settings WHERE key = 'storefront.settings' LIMIT 1",
  );
  const [bannerResult, settingsResult] = await db.batch<unknown>([
    bannerStatement,
    settingsStatement,
  ]);
  const settings = parseSettings(
    (settingsResult?.results?.[0] as { valueJson?: string } | undefined)?.valueJson,
  );
  if (!settings.bannerVisibility[placement]) return [];
  return ((bannerResult?.results ?? []) as StorefrontBanner[]).map((banner) => ({
    ...banner,
    eyebrow: normalizeLegacyLineBreaks(banner.eyebrow),
    title: normalizeLegacyLineBreaks(banner.title),
    body: normalizeLegacyLineBreaks(banner.body),
    cta: normalizeLegacyLineBreaks(banner.cta),
  }));
}

export async function storefrontSkillCategories(
  db: D1Database,
  locale: Locale,
): Promise<SkillCategorySummary[]> {
  const rows = await db.prepare(
    `SELECT c.id, c.slug, t.name, c.sort_order AS "order"
     FROM skill_categories c
     JOIN skill_category_translations t ON t.category_id = c.id AND t.locale = ?
     WHERE c.status = 'ACTIVE'
       AND EXISTS (
         SELECT 1 FROM skills s
         WHERE s.category_id = c.id AND s.status = 'ACTIVE'
           AND s.github_url GLOB 'https://github.com/*'
       )
     ORDER BY c.sort_order ASC, c.id ASC`,
  ).bind(locale.toUpperCase()).all<SkillCategorySummary>();
  return rows.results ?? [];
}

export async function storefrontSkills(
  db: D1Database,
  input: ReturnType<typeof storefrontSkillListingInput>,
): Promise<{ items: SkillSummary[]; total: number }> {
  const localeCode = input.locale.toUpperCase();
  const conditions = [
    "s.status = 'ACTIVE'",
    "c.status = 'ACTIVE'",
    "s.github_url GLOB 'https://github.com/*'",
  ];
  const bindings: unknown[] = [localeCode, localeCode];
  if (input.category) {
    conditions.push("c.slug = ?");
    bindings.push(input.category);
  }
  if (input.resourceType) {
    conditions.push("s.resource_type = ?");
    bindings.push(input.resourceType);
  }
  if (input.sourceLevel) {
    conditions.push("s.source_level = ?");
    bindings.push(input.sourceLevel);
  }
  if (input.search) {
    conditions.push("(st.normalized_name LIKE ? OR LOWER(st.name) LIKE ? OR LOWER(st.summary) LIKE ?)");
    const pattern = `%${input.search}%`;
    bindings.push(pattern, pattern, pattern);
  }
  const where = conditions.join(" AND ");
  const countStatement = db.prepare(
    `SELECT COUNT(*) AS total
     FROM skills s
     JOIN skill_translations st ON st.skill_id = s.id AND st.locale = ?
     JOIN skill_categories c ON c.id = s.category_id
     JOIN skill_category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE ${where}`,
  ).bind(...bindings);
  const rowsStatement = db.prepare(
    `SELECT s.id, s.slug, s.category_id AS categoryId, c.slug AS categorySlug,
      ct.name AS categoryName, c.sort_order AS categoryOrder,
      st.name, st.summary, st.description, st.suitable_for_json AS suitableForJson,
      st.unsuitable_for_json AS unsuitableForJson, st.install_hint AS installHint,
      s.resource_type AS resourceType, s.source_level AS sourceLevel,
      s.maintainer, s.github_url AS githubUrl, s.documentation_url AS documentationUrl,
      s.license, s.compatible_environments_json AS compatibleEnvironmentsJson,
      s.verified_at AS verifiedAt
     FROM skills s
     JOIN skill_translations st ON st.skill_id = s.id AND st.locale = ?
     JOIN skill_categories c ON c.id = s.category_id
     JOIN skill_category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE ${where}
     ORDER BY s.sort_order ASC, s.id ASC
     LIMIT ? OFFSET ?`,
  ).bind(...bindings, input.pageSize, input.offset);
  const [countResult, rowsResult] = await db.batch<unknown>([countStatement, rowsStatement]);
  const total = Number((countResult?.results?.[0] as { total?: number } | undefined)?.total ?? 0);
  const rows = (rowsResult?.results ?? []) as SkillRow[];
  return { items: rows.map(skillSummary), total };
}

export async function storefrontSkill(
  db: D1Database,
  slug: string,
  locale: Locale,
): Promise<SkillDetail | null> {
  const row = await db.prepare(
    `SELECT s.id, s.slug, s.category_id AS categoryId, c.slug AS categorySlug,
      ct.name AS categoryName, c.sort_order AS categoryOrder,
      st.name, st.summary, st.description, st.suitable_for_json AS suitableForJson,
      st.unsuitable_for_json AS unsuitableForJson, st.install_hint AS installHint,
      s.resource_type AS resourceType, s.source_level AS sourceLevel,
      s.maintainer, s.github_url AS githubUrl, s.documentation_url AS documentationUrl,
      s.license, s.compatible_environments_json AS compatibleEnvironmentsJson,
      s.verified_at AS verifiedAt
     FROM skills s
     JOIN skill_translations st ON st.skill_id = s.id AND st.locale = ?
     JOIN skill_categories c ON c.id = s.category_id
     JOIN skill_category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE s.slug = ? AND s.status = 'ACTIVE' AND c.status = 'ACTIVE'
       AND s.github_url GLOB 'https://github.com/*'
     LIMIT 1`,
  ).bind(locale.toUpperCase(), locale.toUpperCase(), slug).first<SkillRow>();
  if (!row || !isSafeGitHubUrl(row.githubUrl)) return null;
  return {
    ...skillSummary(row),
    description: row.description,
    suitableFor: safeJsonStringArray(row.suitableForJson),
    unsuitableFor: safeJsonStringArray(row.unsuitableForJson),
    installHint: row.installHint,
    documentationUrl: safeOptionalHttpsUrl(row.documentationUrl),
    license: row.license,
  };
}

export async function storefrontProducts(
  db: D1Database,
  input: {
    locale: Locale;
    currency: string;
    category: string;
    surface?: ProductSurface | null;
    platform?: ProductSummary["platformKey"];
    transitPlanType?: ProductSummary["transitPlanType"];
    search: string;
    pageSize: number;
    offset: number;
  },
): Promise<{ items: ProductSummary[]; total: number }> {
  const localeCode = input.locale.toUpperCase();
  const conditions = [
    "p.status = 'ACTIVE'",
    "c.status = 'ACTIVE'",
    "(c.parent_id IS NULL OR parent.status = 'ACTIVE')",
  ];
  const bindings: unknown[] = [localeCode, localeCode];
  if (input.category) {
    conditions.push("(c.slug = ? OR parent.slug = ?)");
    bindings.push(input.category, input.category);
  }
  if (input.surface) {
    conditions.push("ps.surface = ? AND ps.is_visible = 1");
    bindings.push(input.surface);
  }
  if (input.platform) {
    conditions.push("p.platform_key = ?");
    bindings.push(input.platform);
  }
  if (input.transitPlanType) {
    conditions.push("p.transit_plan_type = ?");
    bindings.push(input.transitPlanType);
  }
  if (input.search) {
    conditions.push("(pt.normalized_name LIKE ? OR LOWER(pt.name) LIKE ? OR LOWER(COALESCE(pt.aliases_json, '')) LIKE ?)");
    const pattern = `%${input.search}%`;
    bindings.push(pattern, pattern, pattern);
  }
  const where = conditions.join(" AND ");
  const surfaceJoin = input.surface
    ? "JOIN product_surfaces ps ON ps.product_id = p.id"
    : "";
  const countStatement = db.prepare(
    `SELECT COUNT(*) AS total
     FROM products p
     JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = ?
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN categories parent ON parent.id = c.parent_id
     JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     ${surfaceJoin}
     WHERE ${where}`,
  ).bind(...bindings);

  const rowsStatement = db.prepare(
    `SELECT p.id, p.slug, p.category_id AS categoryId, c.slug AS categorySlug,
      ct.name AS categoryName, c.sort_order AS categoryOrder,
      pt.name, pt.kicker, pt.description, p.image_key AS imageKey,
      p.base_price AS basePrice, p.compare_at_price AS compareAtPrice,
      p.platform_key AS platformKey, p.transit_plan_type AS transitPlanType,
      p.stock_mode AS stockMode, p.stock_quantity AS stockQuantity,
      p.status, p.version
     FROM products p
     JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = ?
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN categories parent ON parent.id = c.parent_id
     JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     ${surfaceJoin}
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
      p.platform_key AS platformKey, p.transit_plan_type AS transitPlanType,
      p.stock_mode AS stockMode, p.stock_quantity AS stockQuantity,
      p.status, p.version
     FROM products p
     JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = ?
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN categories parent ON parent.id = c.parent_id
     JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE p.slug = ? AND p.status = 'ACTIVE' AND c.status = 'ACTIVE'
       AND (c.parent_id IS NULL OR parent.status = 'ACTIVE')
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

async function orderLookupResponse(request: Request, env: SitesEnv): Promise<Response> {
  try {
    const body = await readJson<{
      locale?: unknown;
      mode?: unknown;
      orderNumber?: unknown;
    }>(request);
    if (body.locale !== "zh" && body.locale !== "en") {
      return noStore(failure(422, "ORDER_LOOKUP_VALIDATION_FAILED", "The lookup details are incomplete."));
    }
    if (body.mode !== "ORDER_NUMBER") {
      return noStore(failure(
        409,
        "ORDER_LOOKUP_VERIFICATION_REQUIRED",
        "This lookup method requires an approved ownership-verification channel.",
      ));
    }
    const orderNumber = typeof body.orderNumber === "string"
      ? body.orderNumber.normalize("NFKC").trim().toUpperCase()
      : "";
    if (!/^CB\d{8}[A-F0-9]{24}$/u.test(orderNumber)) {
      return noStore(failure(404, "ORDER_LOOKUP_NOT_FOUND", "No matching order was found."));
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const windowMs = 15 * 60_000;
    const windowStartedAt = new Date(Math.floor(now.getTime() / windowMs) * windowMs).toISOString();
    const expiresAt = new Date(new Date(windowStartedAt).getTime() + windowMs).toISOString();
    const requesterSource = request.headers.get("cf-connecting-ip")?.trim()
      || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || `anonymous:${request.headers.get("user-agent")?.slice(0, 120) ?? "unknown"}`;
    const [clientHash, orderHash] = await Promise.all([
      hashOrderLookupSubject(
        `client:${requesterSource}`,
        env.CLOUDBRIDGE_DATA_KEY,
        env.CLOUDBRIDGE_DATA_KEY_NEXT,
      ),
      hashOrderLookupSubject(
        `order:${orderNumber}`,
        env.CLOUDBRIDGE_DATA_KEY,
        env.CLOUDBRIDGE_DATA_KEY_NEXT,
      ),
    ]);
    const [clientLimit, orderLimit] = await Promise.all([
      env.DB.prepare(
        `SELECT attempt_count AS attemptCount, failure_count AS failureCount
         FROM order_lookup_rate_limits
         WHERE subject_kind = 'CLIENT' AND subject_hash = ? AND window_started_at = ?
         LIMIT 1`,
      ).bind(clientHash, windowStartedAt).first<{ attemptCount: number; failureCount: number }>(),
      env.DB.prepare(
        `SELECT attempt_count AS attemptCount, failure_count AS failureCount
         FROM order_lookup_rate_limits
         WHERE subject_kind = 'ORDER' AND subject_hash = ? AND window_started_at = ?
         LIMIT 1`,
      ).bind(orderHash, windowStartedAt).first<{ attemptCount: number; failureCount: number }>(),
    ]);
    if (Number(clientLimit?.attemptCount ?? 0) >= 10 || Number(orderLimit?.failureCount ?? 0) >= 5) {
      const retryAfter = Math.max(1, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 1000));
      const response = noStore(failure(
        429,
        "ORDER_LOOKUP_RATE_LIMITED",
        "Too many lookup attempts. Try again later.",
      ));
      response.headers.set("retry-after", String(retryAfter));
      return response;
    }

    const order = await env.DB.prepare(
      `SELECT id, order_number AS orderNumber, status, amount,
        currency_code AS currency, masked_contact AS maskedContact,
        created_at AS createdAt, updated_at AS updatedAt
       FROM orders
       WHERE order_number = ? AND contact_erased_at IS NULL
       LIMIT 1`,
    ).bind(orderNumber).first<{
      id: string;
      orderNumber: string;
      status: string;
      amount: string;
      currency: string;
      maskedContact: string;
      createdAt: string;
      updatedAt: string;
    }>();
    const failed = order ? 0 : 1;
    await env.DB.batch([
      env.DB.prepare("DELETE FROM order_lookup_rate_limits WHERE expires_at <= ?").bind(nowIso),
      lookupRateLimitUpsert(env.DB, "CLIENT", clientHash, windowStartedAt, expiresAt, 0, nowIso),
      lookupRateLimitUpsert(env.DB, "ORDER", orderHash, windowStartedAt, expiresAt, failed, nowIso),
    ]);
    if (!order) {
      return noStore(failure(404, "ORDER_LOOKUP_NOT_FOUND", "No matching order was found."));
    }
    const itemRows = await env.DB.prepare(
      `SELECT product_id AS productId, product_name_snapshot AS productName,
        amount, currency_code AS currency, reference_amount AS referenceAmount,
        reference_currency_code AS referenceCurrency
       FROM order_items WHERE order_id = ? ORDER BY sort_order ASC, id ASC`,
    ).bind(order.id).all<{
      productId: string;
      productName: string;
      amount: string;
      currency: string;
      referenceAmount: string | null;
      referenceCurrency: string | null;
    }>();
    return noStore(success({
      orderNumber: order.orderNumber,
      status: order.status,
      amount: { amount: order.amount, currency: order.currency },
      maskedContact: order.maskedContact,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: (itemRows.results ?? []).map((item) => ({
        productId: item.productId,
        productName: item.productName,
        amount: { amount: item.amount, currency: item.currency },
        referenceAmount: item.referenceAmount && item.referenceCurrency
          ? { amount: item.referenceAmount, currency: item.referenceCurrency }
          : null,
      })),
    }));
  } catch (error) {
    if (error instanceof ApiInputError) {
      return noStore(failure(error.status, error.code, error.message, undefined, error.details));
    }
    return noStore(failure(503, "ORDER_LOOKUP_UNAVAILABLE", "Order lookup is temporarily unavailable."));
  }
}

function lookupRateLimitUpsert(
  db: D1Database,
  subjectKind: "CLIENT" | "ORDER",
  subjectHash: string,
  windowStartedAt: string,
  expiresAt: string,
  failureIncrement: number,
  updatedAt: string,
): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO order_lookup_rate_limits (
      id, subject_kind, subject_hash, window_started_at,
      attempt_count, failure_count, expires_at, updated_at
    ) VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(subject_kind, subject_hash, window_started_at)
    DO UPDATE SET
      attempt_count = attempt_count + 1,
      failure_count = failure_count + excluded.failure_count,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at`,
  ).bind(
    crypto.randomUUID(),
    subjectKind,
    subjectHash,
    windowStartedAt,
    failureIncrement,
    expiresAt,
    updatedAt,
  );
}

function noStore(response: Response): Response {
  response.headers.set("cache-control", "no-store");
  response.headers.set("pragma", "no-cache");
  return response;
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

  const body = await readJson<CreateOrderBody>(request);
  if (Array.isArray(body.items)) {
    return createCartOrder(body, idempotencyKey, env, context);
  }
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
  const orderNumber = `CB${chinaDateKey(now).replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "").slice(0, 24).toUpperCase()}`;
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
  const insertOrderItem = env.DB.prepare(
    `INSERT INTO order_items (
      id, order_id, product_id, product_name_snapshot, currency_code, amount,
      reference_currency_code, reference_amount, exchange_rate_snapshot,
      product_version, sort_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  ).bind(
    crypto.randomUUID(),
    id,
    product.id,
    product.name,
    currency,
    amount,
    referenceAmount?.currency ?? null,
    referenceAmount?.amount ?? null,
    pricing.rate,
    product.version,
    now.toISOString(),
  );
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
      insertOrderItem,
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

async function createCartOrder(
  body: CreateOrderBody,
  idempotencyKey: string,
  env: SitesEnv,
  context?: SitesExecutionContext,
): Promise<Response> {
  const locale = body.locale === "en" ? "en" : body.locale === "zh" ? "zh" : null;
  const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
  const contactChannel = typeof body.contactChannel === "string"
    ? body.contactChannel.trim().toUpperCase()
    : "";
  const contactValue = typeof body.contactValue === "string" ? body.contactValue.trim() : "";
  const policyVersion = typeof body.acceptedPolicyVersion === "string"
    ? body.acceptedPolicyVersion.trim()
    : "";
  const rawItems = body.items as unknown[];
  if (
    !locale
    || !currency
    || !contactValue
    || contactValue.length > 240
    || rawItems.length === 0
    || rawItems.length > 10
  ) {
    throw new ApiInputError("ORDER_VALIDATION_FAILED", "The order details are incomplete.", 422);
  }
  const requestedItems = rawItems.map((item) => {
    const candidate = item && typeof item === "object"
      ? item as { productId?: unknown; expectedPrice?: { amount?: unknown; currency?: unknown } }
      : {};
    const productId = typeof candidate.productId === "string" ? candidate.productId.trim() : "";
    const expectedAmount = typeof candidate.expectedPrice?.amount === "string"
      ? candidate.expectedPrice.amount
      : "";
    const expectedCurrency = typeof candidate.expectedPrice?.currency === "string"
      ? candidate.expectedPrice.currency.trim().toUpperCase()
      : "";
    if (!productId || expectedCurrency !== currency || !expectedAmount) {
      throw new ApiInputError("ORDER_VALIDATION_FAILED", "The cart items are incomplete.", 422);
    }
    return { productId, expectedAmount };
  });
  if (new Set(requestedItems.map((item) => item.productId)).size !== requestedItems.length) {
    throw new ApiInputError("DUPLICATE_ORDER_ITEM", "Each product can appear only once.", 422);
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

  const placeholders = requestedItems.map(() => "?").join(", ");
  const productRows = await env.DB.prepare(
    `SELECT p.id, p.base_price AS basePrice, p.stock_mode AS stockMode,
      p.stock_quantity AS stockQuantity, p.status, p.version, pt.name
     FROM products p
     JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = ?
     WHERE p.id IN (${placeholders})`,
  ).bind(locale.toUpperCase(), ...requestedItems.map((item) => item.productId)).all<{
    id: string;
    basePrice: string;
    stockMode: "FINITE" | "UNLIMITED";
    stockQuantity: number | null;
    status: string;
    version: number;
    name: string;
  }>();
  const byId = new Map((productRows.results ?? []).map((product) => [product.id, product]));
  const products = requestedItems.map((requested) => {
    const product = byId.get(requested.productId);
    if (!product || product.status !== "ACTIVE") {
      throw new ApiInputError("PRODUCT_UNAVAILABLE", "A selected product is unavailable.", 409);
    }
    if (product.stockMode === "FINITE" && Number(product.stockQuantity ?? 0) <= 0) {
      throw new ApiInputError("OUT_OF_STOCK", "A selected product is sold out.", 409);
    }
    return { ...product, expectedAmount: requested.expectedAmount };
  });

  await assertOrderRatesFresh(env.DB, currency);
  const pricing = await pricingContext(env.DB, currency);
  const pricedItems = products.map((product) => {
    const amount = multiplyDecimal(product.basePrice, pricing.rate, pricing.digits);
    try {
      if (normalizeMoney(product.expectedAmount, pricing.digits) !== amount) {
        throw new ApiInputError("PRICE_CHANGED", "A product price changed. Review and try again.", 409);
      }
    } catch (error) {
      if (error instanceof ApiInputError) throw error;
      throw new ApiInputError("ORDER_VALIDATION_FAILED", "A product price is invalid.", 422);
    }
    return {
      ...product,
      amount,
      referenceAmount: currency === "USDT"
        ? null
        : multiplyDecimal(product.basePrice, pricing.referenceRate, pricing.referenceDigits),
    };
  });
  const amount = sumDecimalAmounts(pricedItems.map((item) => item.amount), pricing.digits);
  const referenceAmount = currency === "USDT"
    ? null
    : {
        amount: sumDecimalAmounts(
          pricedItems.map((item) => item.referenceAmount ?? "0"),
          pricing.referenceDigits,
        ),
        currency: "USDT",
      };
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
  const nowIso = now.toISOString();
  const reservedUntil = new Date(now.getTime() + 30 * 60_000).toISOString();
  const id = crypto.randomUUID();
  const orderNumber = `CB${chinaDateKey(now).replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "").slice(0, 24).toUpperCase()}`;
  const firstProduct = pricedItems[0];
  const productSummaryText = pricedItems.map((item) => item.name).join(" + ");
  const inventoryReserved = pricedItems.some((item) => item.stockMode === "FINITE") ? 1 : 0;
  const eligibleProductsGuard = `(
    SELECT COUNT(*) FROM products guarded
    WHERE guarded.id IN (${placeholders})
      AND guarded.status = 'ACTIVE'
      AND (guarded.stock_mode = 'UNLIMITED' OR COALESCE(guarded.stock_quantity, 0) > 0)
  ) = ?`;
  const insertOrder = env.DB.prepare(
    `INSERT INTO orders (
      id, order_number, idempotency_key, product_id, product_name_snapshot,
      currency_code, amount, reference_currency_code, reference_amount,
      exchange_rate_snapshot, product_version, contact_channel, contact_encrypted,
      contact_hash, masked_contact, accepted_policy_version, status, payment_mode,
      reserved_until, inventory_reserved, inventory_released_at, assigned_to_id,
      created_at, updated_at
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      'MANUAL_PENDING', 'MANUAL', ?, ?, NULL, NULL, ?, ?
    WHERE ${eligibleProductsGuard}`,
  ).bind(
    id,
    orderNumber,
    idempotencyKey,
    firstProduct.id,
    productSummaryText,
    currency,
    amount,
    referenceAmount?.currency ?? null,
    referenceAmount?.amount ?? null,
    pricing.rate,
    firstProduct.version,
    contactChannel,
    contactEncrypted,
    contactHash,
    maskedContact,
    policyVersion,
    reservedUntil,
    inventoryReserved,
    nowIso,
    nowIso,
    ...pricedItems.map((item) => item.id),
    pricedItems.length,
  );
  const itemStatements = pricedItems.map((item, index) => env.DB.prepare(
    `INSERT INTO order_items (
      id, order_id, product_id, product_name_snapshot, currency_code, amount,
      reference_currency_code, reference_amount, exchange_rate_snapshot,
      product_version, sort_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    id,
    item.id,
    item.name,
    currency,
    item.amount,
    item.referenceAmount ? "USDT" : null,
    item.referenceAmount,
    pricing.rate,
    item.version,
    index,
    nowIso,
  ));
  const decrementStatements = pricedItems.map((item) => env.DB.prepare(
    `UPDATE products
     SET stock_quantity = stock_quantity - 1, version = version + 1, updated_at = ?
     WHERE id = ? AND stock_mode = 'FINITE' AND stock_quantity > 0`,
  ).bind(nowIso, item.id));
  const historyStatement = env.DB.prepare(
    "INSERT INTO order_status_history (id, order_id, from_status, to_status, reason, actor_email, created_at) VALUES (?, ?, NULL, 'MANUAL_PENDING', ?, NULL, ?)",
  ).bind(crypto.randomUUID(), id, "Storefront cart order created", nowIso);
  const telegramSettings = await getTelegramSettings(env);
  const queueTelegram = telegramDeliveryInsert(env.DB, telegramSettings, {
    orderId: id,
    orderNumber,
    product: productSummaryText,
    amount,
    currency,
    status: "MANUAL_PENDING",
    createdAt: nowIso,
    contactChannel,
    maskedContact,
  });

  try {
    await env.DB.batch([
      insertOrder,
      ...itemStatements,
      historyStatement,
      ...decrementStatements,
      ...(queueTelegram ? [queueTelegram] : []),
    ]);
  } catch {
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
    productName: productSummaryText,
    amount: { amount, currency },
    referenceAmount,
    contactChannel,
    maskedContact,
    reservedUntil,
    items: pricedItems.map((item) => ({
      productId: item.id,
      productName: item.name,
      amount: { amount: item.amount, currency },
      referenceAmount: item.referenceAmount
        ? { amount: item.referenceAmount, currency: "USDT" }
        : null,
    })),
  }, { status: 201 });
}

async function orderReceiptByIdempotency(db: D1Database, idempotencyKey: string) {
  const row = await db.prepare(
    `SELECT id AS orderId, order_number AS orderNumber, status, product_name_snapshot AS productName,
      amount, currency_code AS currency, reference_amount AS referenceAmount,
      reference_currency_code AS referenceCurrency, contact_channel AS contactChannel,
      masked_contact AS maskedContact, reserved_until AS reservedUntil
     FROM orders WHERE idempotency_key = ? LIMIT 1`,
  ).bind(idempotencyKey).first<{
    orderId: string;
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
  const itemRows = await db.prepare(
    `SELECT product_id AS productId, product_name_snapshot AS productName,
      amount, currency_code AS currency, reference_amount AS referenceAmount,
      reference_currency_code AS referenceCurrency
     FROM order_items WHERE order_id = ? ORDER BY sort_order ASC, id ASC`,
  ).bind(row.orderId).all<{
    productId: string;
    productName: string;
    amount: string;
    currency: string;
    referenceAmount: string | null;
    referenceCurrency: string | null;
  }>();
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
    items: (itemRows.results ?? []).map((item) => ({
      productId: item.productId,
      productName: item.productName,
      amount: { amount: item.amount, currency: item.currency },
      referenceAmount: item.referenceAmount && item.referenceCurrency
        ? { amount: item.referenceAmount, currency: item.referenceCurrency }
        : null,
    })),
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
    platformKey: row.platformKey ?? null,
    transitPlanType: row.transitPlanType ?? null,
  };
}

export function storefrontListingInput(url: URL): {
  locale: Locale;
  currency: string;
  category: string;
  surface: ProductSurface | null;
  platform: ProductSummary["platformKey"];
  transitPlanType: ProductSummary["transitPlanType"];
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
    surface: optionalEnumParam(url, "surface", productSurfaces),
    platform: optionalEnumParam(url, "platform", platformKeys),
    transitPlanType: optionalEnumParam(url, "transitPlanType", transitPlanTypes),
    search: normalizeSearch(url.searchParams.get("search") ?? ""),
    page,
    pageSize,
    offset,
  };
}

export function storefrontSkillListingInput(url: URL): {
  locale: Locale;
  category: string;
  resourceType: SkillResourceType | null;
  sourceLevel: SkillSourceLevel | null;
  search: string;
  page: number;
  pageSize: number;
  offset: number;
} {
  const { page, pageSize, offset } = parsePage(url, {
    page: 1,
    pageSize: 24,
  });
  return {
    locale: localeFrom(url),
    category: url.searchParams.get("category")?.trim().slice(0, 80) ?? "",
    resourceType: optionalEnumParam(url, "resourceType", skillResourceTypes),
    sourceLevel: optionalEnumParam(url, "sourceLevel", skillSourceLevels),
    search: normalizeSearch(url.searchParams.get("search") ?? ""),
    page,
    pageSize,
    offset,
  };
}

function skillSummary(row: SkillRow): SkillSummary {
  if (!isSafeGitHubUrl(row.githubUrl)) {
    throw new ApiInputError("SKILL_SOURCE_INVALID", "Skill source is unavailable.", 503);
  }
  return {
    id: row.id,
    slug: row.slug,
    categoryId: row.categoryId,
    category: {
      id: row.categoryId,
      slug: row.categorySlug,
      name: row.categoryName,
      order: row.categoryOrder,
    },
    name: row.name,
    summary: row.summary,
    resourceType: row.resourceType,
    sourceLevel: row.sourceLevel,
    maintainer: row.maintainer,
    githubUrl: row.githubUrl,
    compatibleEnvironments: safeJsonStringArray(row.compatibleEnvironmentsJson),
    verifiedAt: row.verifiedAt,
  };
}

function optionalEnumParam<const T extends readonly string[]>(
  url: URL,
  name: string,
  allowed: T,
): T[number] | null {
  const raw = url.searchParams.get(name)?.trim().toUpperCase() ?? "";
  if (!raw) return null;
  if ((allowed as readonly string[]).includes(raw)) return raw as T[number];
  throw new ApiInputError("VALIDATION_FAILED", `${name} is invalid.`, 422, [
    { field: name, code: "INVALID_ENUM", message: `${name} is invalid.` },
  ]);
}

function safeJsonStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 24);
  } catch {
    return [];
  }
}

function isSafeGitHubUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "github.com"
      && url.username === ""
      && url.password === ""
      && url.pathname.split("/").filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}

function safeOptionalHttpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.username === "" && url.password === ""
      ? url.toString()
      : null;
  } catch {
    return null;
  }
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
    bannerVisibility: {
      HOME: true,
      TRANSIT_SUBSCRIPTIONS: true,
      AI_RECHARGE: true,
    },
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
      bannerVisibility: {
        HOME: parsed.bannerVisibility?.HOME !== false,
        TRANSIT_SUBSCRIPTIONS: parsed.bannerVisibility?.TRANSIT_SUBSCRIPTIONS !== false,
        AI_RECHARGE: parsed.bannerVisibility?.AI_RECHARGE !== false,
      },
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
