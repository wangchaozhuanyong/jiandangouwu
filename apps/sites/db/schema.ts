import {
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
  status: text("status").notNull().default("ACTIVE"),
  sortOrder: integer("sort_order").notNull().default(0),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("categories_slug_unique").on(table.slug),
  index("categories_status_sort_idx").on(table.status, table.sortOrder),
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

export const heroes = sqliteTable("heroes", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  imageKey: text("image_key").notNull(),
  targetSlug: text("target_slug"),
  tone: text("tone").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  sortOrder: integer("sort_order").notNull().default(0),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("heroes_key_unique").on(table.key),
  index("heroes_status_sort_idx").on(table.status, table.sortOrder),
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
