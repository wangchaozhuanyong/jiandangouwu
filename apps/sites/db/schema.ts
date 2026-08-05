import {
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  parentId: text("parent_id").references((): AnySQLiteColumn => categories.id),
  status: text("status").notNull().default("ACTIVE"),
  sortOrder: integer("sort_order").notNull().default(0),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("categories_slug_unique").on(table.slug),
  index("categories_status_sort_idx").on(table.status, table.sortOrder),
  index("categories_parent_status_sort_idx").on(table.parentId, table.status, table.sortOrder),
]);

export const categoryTranslations = sqliteTable("category_translations", {
  categoryId: text("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  locale: text("locale").notNull(),
  name: text("name").notNull(),
}, (table) => [
  primaryKey({ columns: [table.categoryId, table.locale] }),
  index("category_translations_locale_name_idx").on(table.locale, table.name),
]);

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  categoryId: text("category_id").notNull().references(() => categories.id),
  imageKey: text("image_key").notNull(),
  basePrice: text("base_price").notNull(),
  compareAtPrice: text("compare_at_price"),
  platformKey: text("platform_key"),
  transitPlanType: text("transit_plan_type"),
  stockMode: text("stock_mode").notNull().default("FINITE"),
  stockQuantity: integer("stock_quantity"),
  status: text("status").notNull().default("DRAFT"),
  sortOrder: integer("sort_order").notNull().default(0),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("products_slug_unique").on(table.slug),
  index("products_category_status_sort_idx").on(table.categoryId, table.status, table.sortOrder),
  index("products_status_sort_idx").on(table.status, table.sortOrder),
]);

export const productTranslations = sqliteTable("product_translations", {
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  locale: text("locale").notNull(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  kicker: text("kicker").notNull().default(""),
  description: text("description").notNull(),
  aliasesJson: text("aliases_json"),
}, (table) => [
  primaryKey({ columns: [table.productId, table.locale] }),
  index("product_translations_locale_name_idx").on(table.locale, table.normalizedName),
]);

export const productSurfaces = sqliteTable("product_surfaces", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  surface: text("surface").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isVisible: integer("is_visible", { mode: "boolean" }).notNull().default(true),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("product_surfaces_product_surface_unique").on(table.productId, table.surface),
  index("product_surfaces_surface_visible_sort_idx").on(table.surface, table.isVisible, table.sortOrder),
]);

export const heroes = sqliteTable("heroes", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  imageKey: text("image_key").notNull(),
  placement: text("placement").notNull().default("HOME"),
  mobileImageKey: text("mobile_image_key"),
  targetSlug: text("target_slug"),
  targetType: text("target_type").notNull().default("PRODUCT"),
  targetValue: text("target_value"),
  secondaryCtaZh: text("secondary_cta_zh"),
  secondaryCtaEn: text("secondary_cta_en"),
  secondaryTargetType: text("secondary_target_type"),
  secondaryTargetValue: text("secondary_target_value"),
  tone: text("tone").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  sortOrder: integer("sort_order").notNull().default(0),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("heroes_key_unique").on(table.key),
  index("heroes_status_sort_idx").on(table.status, table.sortOrder),
  index("heroes_placement_status_sort_idx").on(table.placement, table.status, table.sortOrder),
]);

export const heroTranslations = sqliteTable("hero_translations", {
  heroId: text("hero_id").notNull().references(() => heroes.id, { onDelete: "cascade" }),
  locale: text("locale").notNull(),
  eyebrow: text("eyebrow").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  cta: text("cta").notNull(),
}, (table) => [
  primaryKey({ columns: [table.heroId, table.locale] }),
]);

export const skillCategories = sqliteTable("skill_categories", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  sortOrder: integer("sort_order").notNull().default(0),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("skill_categories_slug_unique").on(table.slug),
  index("skill_categories_status_sort_idx").on(table.status, table.sortOrder),
]);

export const skillCategoryTranslations = sqliteTable("skill_category_translations", {
  categoryId: text("category_id").notNull().references(() => skillCategories.id, { onDelete: "cascade" }),
  locale: text("locale").notNull(),
  name: text("name").notNull(),
}, (table) => [
  primaryKey({ columns: [table.categoryId, table.locale] }),
  index("skill_category_translations_locale_name_idx").on(table.locale, table.name),
]);

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  categoryId: text("category_id").notNull().references(() => skillCategories.id),
  resourceType: text("resource_type").notNull(),
  sourceLevel: text("source_level").notNull(),
  maintainer: text("maintainer").notNull(),
  githubUrl: text("github_url").notNull(),
  documentationUrl: text("documentation_url"),
  license: text("license").notNull(),
  compatibleEnvironmentsJson: text("compatible_environments_json").notNull().default("[]"),
  verifiedAt: text("verified_at").notNull(),
  status: text("status").notNull().default("DRAFT"),
  sortOrder: integer("sort_order").notNull().default(0),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("skills_slug_unique").on(table.slug),
  index("skills_category_status_sort_idx").on(table.categoryId, table.status, table.sortOrder),
  index("skills_status_sort_idx").on(table.status, table.sortOrder),
]);

export const skillTranslations = sqliteTable("skill_translations", {
  skillId: text("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
  locale: text("locale").notNull(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  summary: text("summary").notNull(),
  description: text("description").notNull(),
  suitableForJson: text("suitable_for_json").notNull().default("[]"),
  unsuitableForJson: text("unsuitable_for_json").notNull().default("[]"),
  installHint: text("install_hint").notNull(),
}, (table) => [
  primaryKey({ columns: [table.skillId, table.locale] }),
  index("skill_translations_locale_name_idx").on(table.locale, table.normalizedName),
]);

export const currencies = sqliteTable("currencies", {
  code: text("code").primaryKey(),
  token: text("token").notNull(),
  nameZh: text("name_zh").notNull(),
  nameEn: text("name_en").notNull(),
  digits: integer("digits").notNull().default(2),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("currencies_active_sort_idx").on(table.active, table.sortOrder),
]);

export const exchangeRates = sqliteTable("exchange_rates", {
  id: text("id").primaryKey(),
  fromCode: text("from_code").notNull().references(() => currencies.code),
  toCode: text("to_code").notNull().references(() => currencies.code),
  rate: text("rate").notNull(),
  source: text("source").notNull(),
  effectiveAt: text("effective_at").notNull(),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("exchange_rates_pair_effective_unique").on(
    table.fromCode,
    table.toCode,
    table.effectiveAt,
  ),
  index("exchange_rates_pair_effective_idx").on(
    table.fromCode,
    table.toCode,
    table.effectiveAt,
  ),
]);

export const exchangeRateSyncRuns = sqliteTable("exchange_rate_sync_runs", {
  id: text("id").primaryKey(),
  scheduleKey: text("schedule_key").notNull(),
  trigger: text("trigger").notNull(),
  status: text("status").notNull(),
  providerSummary: text("provider_summary").notNull(),
  updatedCurrenciesJson: text("updated_currencies_json").notNull().default("[]"),
  errorCode: text("error_code"),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
}, (table) => [
  uniqueIndex("exchange_rate_sync_runs_schedule_unique").on(table.scheduleKey),
  index("exchange_rate_sync_runs_started_idx").on(table.startedAt),
]);

export const merchantChannels = sqliteTable("merchant_channels", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  mode: text("mode").notNull(),
  labelZh: text("label_zh").notNull(),
  labelEn: text("label_en").notNull(),
  publicAccount: text("public_account").notNull(),
  directTarget: text("direct_target"),
  serviceHoursZh: text("service_hours_zh").notNull(),
  serviceHoursEn: text("service_hours_en").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("merchant_channels_type_unique").on(table.type),
  index("merchant_channels_active_sort_idx").on(table.active, table.sortOrder),
]);

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  productId: text("product_id").notNull().references(() => products.id),
  productNameSnapshot: text("product_name_snapshot").notNull(),
  currencyCode: text("currency_code").notNull().references(() => currencies.code),
  amount: text("amount").notNull(),
  referenceCurrencyCode: text("reference_currency_code"),
  referenceAmount: text("reference_amount"),
  exchangeRateSnapshot: text("exchange_rate_snapshot").notNull(),
  productVersion: integer("product_version").notNull(),
  contactChannel: text("contact_channel").notNull(),
  contactEncrypted: text("contact_encrypted").notNull(),
  contactHash: text("contact_hash").notNull(),
  maskedContact: text("masked_contact").notNull(),
  contactErasedAt: text("contact_erased_at"),
  contactErasureRequestId: text("contact_erasure_request_id"),
  acceptedPolicyVersion: text("accepted_policy_version").notNull(),
  status: text("status").notNull().default("MANUAL_PENDING"),
  paymentMode: text("payment_mode").notNull().default("MANUAL"),
  reservedUntil: text("reserved_until").notNull(),
  inventoryReserved: integer("inventory_reserved", { mode: "boolean" }).notNull().default(false),
  inventoryReleasedAt: text("inventory_released_at"),
  assignedToId: text("assigned_to_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("orders_number_unique").on(table.orderNumber),
  uniqueIndex("orders_idempotency_unique").on(table.idempotencyKey),
  index("orders_status_created_idx").on(table.status, table.createdAt),
  index("orders_product_created_idx").on(table.productId, table.createdAt),
]);

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id),
  productNameSnapshot: text("product_name_snapshot").notNull(),
  currencyCode: text("currency_code").notNull().references(() => currencies.code),
  amount: text("amount").notNull(),
  referenceCurrencyCode: text("reference_currency_code"),
  referenceAmount: text("reference_amount"),
  exchangeRateSnapshot: text("exchange_rate_snapshot").notNull(),
  productVersion: integer("product_version").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("order_items_order_product_unique").on(table.orderId, table.productId),
  index("order_items_order_sort_idx").on(table.orderId, table.sortOrder),
  index("order_items_product_created_idx").on(table.productId, table.createdAt),
]);

export const orderLookupRateLimits = sqliteTable("order_lookup_rate_limits", {
  id: text("id").primaryKey(),
  subjectKind: text("subject_kind").notNull(),
  subjectHash: text("subject_hash").notNull(),
  windowStartedAt: text("window_started_at").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  expiresAt: text("expires_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("order_lookup_rate_limits_subject_window_unique").on(
    table.subjectKind,
    table.subjectHash,
    table.windowStartedAt,
  ),
  index("order_lookup_rate_limits_expires_idx").on(table.expiresAt),
]);

export const telegramDeliveries = sqliteTable("telegram_deliveries", {
  id: text("id").primaryKey(),
  orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
  orderNumber: text("order_number").notNull(),
  eventType: text("event_type").notNull(),
  status: text("status").notNull(),
  payloadJson: text("payload_json").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  nextAttemptAt: text("next_attempt_at"),
  deliveredAt: text("delivered_at"),
  telegramMessageId: text("telegram_message_id"),
  errorCode: text("error_code"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("telegram_deliveries_order_event_unique").on(table.orderId, table.eventType),
  index("telegram_deliveries_status_next_idx").on(table.status, table.nextAttemptAt),
  index("telegram_deliveries_created_idx").on(table.createdAt),
]);

export const systemAlertDeliveries = sqliteTable("system_alert_deliveries", {
  id: text("id").primaryKey(),
  dedupeKey: text("dedupe_key").notNull(),
  source: text("source").notNull(),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  titleZh: text("title_zh").notNull(),
  titleEn: text("title_en").notNull(),
  summaryZh: text("summary_zh").notNull(),
  summaryEn: text("summary_en").notNull(),
  payloadJson: text("payload_json").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  nextAttemptAt: text("next_attempt_at"),
  deliveredAt: text("delivered_at"),
  telegramMessageId: text("telegram_message_id"),
  errorCode: text("error_code"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("system_alert_deliveries_dedupe_unique").on(table.dedupeKey),
  index("system_alert_deliveries_status_next_idx").on(table.status, table.nextAttemptAt),
  index("system_alert_deliveries_source_created_idx").on(table.source, table.createdAt),
]);

export const orderStatusHistory = sqliteTable("order_status_history", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reason: text("reason"),
  actorEmail: text("actor_email"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("order_status_history_order_created_idx").on(table.orderId, table.createdAt),
]);

export const adminMembers = sqliteTable("admin_members", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  permissionsJson: text("permissions_json").notNull(),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("admin_members_email_unique").on(table.email),
  index("admin_members_status_idx").on(table.status),
]);

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  traceId: text("trace_id").notNull(),
  action: text("action").notNull(),
  result: text("result").notNull(),
  actorEmail: text("actor_email"),
  actorDisplayName: text("actor_display_name"),
  targetType: text("target_type"),
  targetId: text("target_id"),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("audit_events_created_idx").on(table.createdAt),
  index("audit_events_action_result_idx").on(table.action, table.result),
]);

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
  updatedByEmail: text("updated_by_email"),
});

export const privacyRequests = sqliteTable("privacy_requests", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  requesterReference: text("requester_reference").notNull(),
  requesterLookupHash: text("requester_lookup_hash").notNull(),
  reason: text("reason").notNull(),
  resultJson: text("result_json"),
  identityVerifiedAt: text("identity_verified_at"),
  completedAt: text("completed_at"),
  createdByEmail: text("created_by_email").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("privacy_requests_status_created_idx").on(table.status, table.createdAt),
  index("privacy_requests_lookup_idx").on(table.requesterLookupHash),
]);

export const dataKeyVersions = sqliteTable("data_key_versions", {
  keyId: text("key_id").primaryKey(),
  slot: text("slot").notNull(),
  status: text("status").notNull(),
  contactsMigrated: integer("contacts_migrated").notNull().default(0),
  backupsMigrated: integer("backups_migrated").notNull().default(0),
  errorCode: text("error_code"),
  createdAt: text("created_at").notNull(),
  activatedAt: text("activated_at"),
  completedAt: text("completed_at"),
}, (table) => [
  index("data_key_versions_status_created_idx").on(table.status, table.createdAt),
]);

export const mediaObjects = sqliteTable("media_objects", {
  key: text("key").primaryKey(),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  uploadedByEmail: text("uploaded_by_email").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("media_objects_created_idx").on(table.createdAt),
]);

export const backupSnapshots = sqliteTable("backup_snapshots", {
  id: text("id").primaryKey(),
  scheduleKey: text("schedule_key").notNull(),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  objectKey: text("object_key").notNull(),
  schemaVersion: integer("schema_version").notNull(),
  recordCountsJson: text("record_counts_json").notNull(),
  byteSize: integer("byte_size"),
  checksumSha256: text("checksum_sha256"),
  createdByEmail: text("created_by_email"),
  reason: text("reason").notNull(),
  errorCode: text("error_code"),
  createdAt: text("created_at").notNull(),
  verifiedAt: text("verified_at"),
  restoreValidationStatus: text("restore_validation_status").notNull().default("NOT_RUN"),
  restoreValidationJson: text("restore_validation_json").notNull().default("{}"),
  restoreValidatedAt: text("restore_validated_at"),
  restoreValidatedByEmail: text("restore_validated_by_email"),
  restoreValidationReason: text("restore_validation_reason"),
  restoreValidationErrorCode: text("restore_validation_error_code"),
}, (table) => [
  uniqueIndex("backup_snapshots_schedule_key_unique").on(table.scheduleKey),
  index("backup_snapshots_created_idx").on(table.createdAt),
  index("backup_snapshots_status_created_idx").on(table.status, table.createdAt),
]);
