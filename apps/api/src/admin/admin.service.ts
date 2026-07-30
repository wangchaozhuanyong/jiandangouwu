import {
  AUDIT_CSV_EXPORT_LIMIT,
  auditCsvFilename,
  securityAuditActions,
  securityAuditActionsForCategory,
  securityAuditActionsForDefaultSeverity,
  serializeAuditCsv,
  type AdminInventoryRiskItem,
  type AdminInventoryRiskLevel,
  type AdminInventoryRiskSummary,
  type AdminOrderListItem,
  type OrderStatus,
  type SecurityAuditSummary,
  type SecurityEventCategory,
  type SecurityEventSeverity,
} from "@cloudbridge/contracts";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service.js";
import type { AdminActor } from "../common/admin-actor.js";
import type { Prisma } from "../generated/prisma/client.js";
import { deriveManualPaymentStage } from "../orders/orders.admin.service.js";
import { OrderReservationService } from "../orders/order-reservation.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  parseStorefrontSettings,
  STOREFRONT_SETTINGS_KEY,
} from "../settings/settings.model.js";
import type {
  AdminAuditQueryDto,
  AdminAuditExportDto,
  AdminListQueryDto,
  CreateCategoryDto,
  CreateProductDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UpdateRateDto,
} from "./admin.dto.js";

const normalizeName = (value: string): string => value.normalize("NFKC").trim().toLocaleLowerCase();
const auditTimeRangeMs = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
} as const;
const inventoryRiskSampleLimit = 6;
const recentAuthenticationWindowMs = 5 * 60_000;
const inventoryRiskProductSelect = {
  id: true,
  slug: true,
  stockQuantity: true,
  updatedAt: true,
  translations: {
    where: { locale: { in: ["ZH", "EN"] } },
    select: { locale: true, name: true },
  },
} satisfies Prisma.ProductSelect;
type InventoryRiskProductRecord = Prisma.ProductGetPayload<{
  select: typeof inventoryRiskProductSelect;
}>;

const inventoryRiskItem = (
  product: InventoryRiskProductRecord,
  risk: AdminInventoryRiskLevel,
): AdminInventoryRiskItem => ({
  id: product.id,
  slug: product.slug,
  name: {
    zh: product.translations.find((translation) => translation.locale === "ZH")?.name ?? "",
    en: product.translations.find((translation) => translation.locale === "EN")?.name ?? "",
  },
  stockQuantity: product.stockQuantity,
  risk,
  updatedAt: product.updatedAt.toISOString(),
});

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reservations: OrderReservationService,
  ) {}

  async overview() {
    await this.reservations.reconcileExpired();
    const [
      productCount,
      activeProducts,
      openOrders,
      categoryCount,
      inventoryRisk,
      latestOrders,
      currencies,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: "ACTIVE" } }),
      this.prisma.order.count({ where: { status: { notIn: ["COMPLETED", "CANCELLED", "REFUNDED"] } } }),
      this.prisma.category.count({ where: { status: { not: "ARCHIVED" } } }),
      this.inventoryRisk(),
      this.prisma.order.findMany({
        take: 6,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          orderNumber: true,
          productId: true,
          productNameSnapshot: true,
          currencyCode: true,
          amount: true,
          referenceCurrencyCode: true,
          referenceAmount: true,
          maskedContact: true,
          contactChannel: true,
          status: true,
          paymentMode: true,
          reservedUntil: true,
          assignedTo: {
            select: {
              id: true,
              displayName: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.currency.findMany({
        select: {
          code: true,
          digits: true,
        },
      }),
    ]);
    const currencyDigits = new Map(currencies.map((currency) => [currency.code, currency.digits]));
    return {
      metrics: { productCount, activeProducts, openOrders, categoryCount },
      inventoryRisk,
      latestOrders: latestOrders.map((order): AdminOrderListItem => ({
        id: order.id,
        orderNumber: order.orderNumber,
        productId: order.productId,
        productNameSnapshot: order.productNameSnapshot,
        amount: {
          amount: order.amount.toFixed(currencyDigits.get(order.currencyCode) ?? 2),
          currency: order.currencyCode,
        },
        referenceAmount: order.referenceAmount && order.referenceCurrencyCode
          ? {
              amount: order.referenceAmount.toFixed(
                currencyDigits.get(order.referenceCurrencyCode) ?? 2,
              ),
              currency: order.referenceCurrencyCode,
            }
          : null,
        contactChannel: order.contactChannel,
        maskedContact: order.maskedContact,
        status: order.status as OrderStatus,
        paymentMode: order.paymentMode,
        paymentStage: deriveManualPaymentStage(order.status),
        reservedUntil: order.reservedUntil.toISOString(),
        assignedTo: order.assignedTo,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      })),
    };
  }

  private async inventoryRisk(): Promise<AdminInventoryRiskSummary> {
    return this.prisma.$transaction(async (transaction) => {
      const settingsRow = await transaction.siteSetting.findUnique({
        where: { key: STOREFRONT_SETTINGS_KEY },
        select: { value: true },
      });
      const threshold = parseStorefrontSettings(settingsRow?.value).inventoryRiskThreshold;
      const invalidStockWhere = {
        status: "ACTIVE",
        OR: [
          { stockMode: "FINITE", stockQuantity: null },
          { stockMode: "FINITE", stockQuantity: { lt: 0 } },
          { stockMode: "UNLIMITED", stockQuantity: { not: null } },
        ],
      } satisfies Prisma.ProductWhereInput;
      const soldOutWhere = {
        status: "ACTIVE",
        stockMode: "FINITE",
        stockQuantity: 0,
      } satisfies Prisma.ProductWhereInput;
      const lowStockWhere = {
        status: "ACTIVE",
        stockMode: "FINITE",
        stockQuantity: { gt: 0, lte: threshold },
      } satisfies Prisma.ProductWhereInput;
      const [
        evaluatedProductCount,
        soldOutCount,
        lowStockCount,
        invalidStockCount,
        invalidProducts,
        soldOutProducts,
        lowStockProducts,
      ] = await Promise.all([
        transaction.product.count({ where: { status: "ACTIVE" } }),
        transaction.product.count({ where: soldOutWhere }),
        transaction.product.count({ where: lowStockWhere }),
        transaction.product.count({ where: invalidStockWhere }),
        transaction.product.findMany({
          where: invalidStockWhere,
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          take: inventoryRiskSampleLimit,
          select: inventoryRiskProductSelect,
        }),
        transaction.product.findMany({
          where: soldOutWhere,
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          take: inventoryRiskSampleLimit,
          select: inventoryRiskProductSelect,
        }),
        transaction.product.findMany({
          where: lowStockWhere,
          orderBy: [{ stockQuantity: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
          take: inventoryRiskSampleLimit,
          select: inventoryRiskProductSelect,
        }),
      ]);
      const affectedProductCount = soldOutCount + lowStockCount + invalidStockCount;
      const items = [
        ...invalidProducts.map((product) => inventoryRiskItem(product, "INVALID_STOCK")),
        ...soldOutProducts.map((product) => inventoryRiskItem(product, "SOLD_OUT")),
        ...lowStockProducts.map((product) => inventoryRiskItem(product, "LOW_STOCK")),
      ].slice(0, inventoryRiskSampleLimit);

      return {
        source: "LIVE_DATABASE_QUERY",
        threshold,
        evaluatedProductCount,
        affectedProductCount,
        soldOutCount,
        lowStockCount,
        invalidStockCount,
        sampleLimit: inventoryRiskSampleLimit,
        items,
      };
    });
  }

  async categories() {
    const categories = await this.prisma.category.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { translations: true, _count: { select: { products: true } } },
    });
    return categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      status: category.status,
      sortOrder: category.sortOrder,
      version: category.version,
      name: {
        zh: category.translations.find((item) => item.locale === "ZH")?.name ?? "",
        en: category.translations.find((item) => item.locale === "EN")?.name ?? "",
      },
      productCount: category._count.products,
      updatedAt: category.updatedAt,
    }));
  }

  async createCategory(input: CreateCategoryDto, actor: AdminActor) {
    const category = await this.prisma.category.create({
      data: {
        slug: input.slug,
        status: input.status,
        sortOrder: input.sortOrder,
        translations: {
          create: [
            { locale: "ZH", name: input.nameZh },
            { locale: "EN", name: input.nameEn },
          ],
        },
      },
      include: { translations: true },
    }).catch(() => {
      throw new ConflictException("Category slug already exists.");
    });
    await this.audit.record({
      actorId: actor.userId,
      action: "category.create",
      targetType: "Category",
      targetId: category.id,
      result: "SUCCEEDED",
      afterData: { slug: category.slug, status: category.status },
      ...actor,
    });
    return category;
  }

  async updateCategory(id: string, input: UpdateCategoryDto, actor: AdminActor) {
    const current = await this.prisma.category.findUnique({ where: { id }, include: { translations: true } });
    if (!current) throw new NotFoundException("Category not found.");
    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.category.updateMany({
        where: { id, version: input.version },
        data: {
          slug: input.slug,
          status: input.status,
          sortOrder: input.sortOrder,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException("Category changed. Reload before saving.");
      if (input.nameZh) {
        await transaction.categoryTranslation.update({
          where: { categoryId_locale: { categoryId: id, locale: "ZH" } },
          data: { name: input.nameZh },
        });
      }
      if (input.nameEn) {
        await transaction.categoryTranslation.update({
          where: { categoryId_locale: { categoryId: id, locale: "EN" } },
          data: { name: input.nameEn },
        });
      }
      return transaction.category.findUniqueOrThrow({ where: { id }, include: { translations: true } });
    });
    await this.audit.record({
      actorId: actor.userId,
      action: "category.update",
      targetType: "Category",
      targetId: id,
      result: "SUCCEEDED",
      beforeData: { slug: current.slug, status: current.status, version: current.version },
      afterData: { slug: updated.slug, status: updated.status, version: updated.version },
      ...actor,
    });
    return updated;
  }

  async products(query: AdminListQueryDto) {
    const normalized = query.search ? normalizeName(query.search) : undefined;
    const where: Prisma.ProductWhereInput = {
      status: query.status ?? { not: "ARCHIVED" },
      ...(normalized
        ? {
            OR: [
              { slug: { contains: normalized } },
              { translations: { some: { normalizedName: { contains: normalized } } } },
            ],
          }
        : {}),
    };
    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          translations: true,
          category: { include: { translations: true } },
        },
      }),
    ]);
    return {
      data: products.map((product) => ({
        id: product.id,
        slug: product.slug,
        imageKey: product.imageKey,
        basePrice: product.basePrice.toFixed(2),
        compareAtPrice: product.compareAtPrice?.toFixed(2) ?? null,
        stockMode: product.stockMode,
        stockQuantity: product.stockQuantity,
        status: product.status,
        sortOrder: product.sortOrder,
        version: product.version,
        category: {
          id: product.category.id,
          slug: product.category.slug,
          name: {
            zh: product.category.translations.find((item) => item.locale === "ZH")?.name ?? "",
            en: product.category.translations.find((item) => item.locale === "EN")?.name ?? "",
          },
        },
        translations: Object.fromEntries(product.translations.map((translation) => [
          translation.locale.toLocaleLowerCase(),
          {
            name: translation.name,
            kicker: translation.kicker,
            description: translation.description,
          },
        ])),
        updatedAt: product.updatedAt,
      })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    };
  }

  createProduct(input: CreateProductDto, actor: AdminActor) {
    return this.saveNewProduct(input, actor);
  }

  async updateProduct(id: string, input: UpdateProductDto, actor: AdminActor) {
    const current = await this.prisma.product.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Product not found.");
    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.product.updateMany({
        where: { id, version: input.version },
        data: {
          slug: input.slug,
          categoryId: input.categoryId,
          imageKey: input.imageKey,
          basePrice: input.basePrice,
          compareAtPrice: input.compareAtPrice,
          stockMode: input.stockMode,
          stockQuantity: input.stockMode === "UNLIMITED" ? null : input.stockQuantity,
          status: input.status,
          sortOrder: input.sortOrder,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException("Product changed. Reload before saving.");
      await Promise.all([
        transaction.productTranslation.update({
          where: { productId_locale: { productId: id, locale: "ZH" } },
          data: {
            name: input.nameZh,
            normalizedName: normalizeName(input.nameZh),
            kicker: input.kickerZh,
            description: input.descriptionZh,
          },
        }),
        transaction.productTranslation.update({
          where: { productId_locale: { productId: id, locale: "EN" } },
          data: {
            name: input.nameEn,
            normalizedName: normalizeName(input.nameEn),
            kicker: input.kickerEn,
            description: input.descriptionEn,
          },
        }),
      ]);
      return transaction.product.findUniqueOrThrow({ where: { id } });
    });
    await this.audit.record({
      actorId: actor.userId,
      action: "product.update",
      targetType: "Product",
      targetId: id,
      result: "SUCCEEDED",
      beforeData: { slug: current.slug, status: current.status, version: current.version },
      afterData: { slug: updated.slug, status: updated.status, version: updated.version },
      ...actor,
    });
    return updated;
  }

  async currencies() {
    const currencies = await this.prisma.currency.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        ratesTo: {
          where: { fromCode: "MYR" },
          orderBy: { effectiveAt: "desc" },
          take: 1,
        },
      },
    });
    return currencies.map((currency) => ({
      code: currency.code,
      token: currency.token,
      name: { zh: currency.nameZh, en: currency.nameEn },
      digits: currency.digits,
      active: currency.active,
      rate: currency.ratesTo[0]?.rate.toFixed(10) ?? null,
      effectiveAt: currency.ratesTo[0]?.effectiveAt ?? null,
    }));
  }

  async updateRate(code: string, input: UpdateRateDto, actor: AdminActor) {
    const currency = await this.prisma.currency.findUnique({ where: { code } });
    if (!currency) throw new NotFoundException("Currency not found.");
    const previous = await this.prisma.exchangeRate.findFirst({
      where: { fromCode: "MYR", toCode: code },
      orderBy: { effectiveAt: "desc" },
    });
    const rate = await this.prisma.exchangeRate.create({
      data: {
        fromCode: "MYR",
        toCode: code,
        rate: input.rate,
        source: "admin-manual",
        effectiveAt: new Date(),
      },
    });
    await this.audit.record({
      actorId: actor.userId,
      action: "currency.rate.update",
      targetType: "Currency",
      targetId: code,
      result: "SUCCEEDED",
      reason: input.reason,
      beforeData: { rate: previous?.rate.toString() ?? null },
      afterData: { rate: rate.rate.toString() },
      ...actor,
    });
    return { code, rate: rate.rate.toFixed(10), effectiveAt: rate.effectiveAt };
  }

  async auditEvents(query: AdminAuditQueryDto) {
    const where = auditWhere(query);
    const [total, events, targetTypes] = await this.prisma.$transaction([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          requestId: true,
          action: true,
          targetType: true,
          targetId: true,
          result: true,
          reason: true,
          createdAt: true,
          actor: {
            select: {
              displayName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.auditEvent.groupBy({
        by: ["targetType"],
        orderBy: { targetType: "asc" },
      }),
    ]);
    let securitySummary: SecurityAuditSummary | undefined;
    if (query.scope === "security" || query.category || query.severity) {
      const now = Date.now();
      const [
        securityTotal,
        last24Hours,
        needsReview,
        deniedOrFailed,
      ] = await this.prisma.$transaction([
        this.prisma.auditEvent.count({
          where: auditWhere({ scope: "security", timeRange: "all" }, now),
        }),
        this.prisma.auditEvent.count({
          where: auditWhere({ scope: "security", timeRange: "24h" }, now),
        }),
        this.prisma.auditEvent.count({
          where: auditWhere({
            scope: "security",
            severity: "high",
            timeRange: "all",
          }, now),
        }),
        this.prisma.auditEvent.count({
          where: auditWhere({
            scope: "security",
            timeRange: "all",
          }, now, { deniedOrFailedOnly: true }),
        }),
      ]);
      securitySummary = {
        total: securityTotal,
        last24Hours,
        needsReview,
        deniedOrFailed,
      };
    }
    return {
      data: {
        items: events,
        facets: {
          targetTypes: targetTypes.map((row) => row.targetType),
          ...(securitySummary ? { securitySummary } : {}),
        },
      },
      meta: { page: query.page, pageSize: query.pageSize, total, pageCount: Math.ceil(total / query.pageSize) },
    };
  }

  async exportAuditEvents(input: AdminAuditExportDto, actor: AdminActor) {
    await this.requireRecentAuthentication(input.reason, actor);
    const where = auditWhere(input);
    const total = await this.prisma.auditEvent.count({ where });
    if (total > AUDIT_CSV_EXPORT_LIMIT) {
      await this.audit.record({
        actorId: actor.userId,
        action: "audit.export.csv",
        targetType: "AuditExport",
        targetId: actor.requestId,
        result: "DENIED",
        requestId: actor.requestId,
        reason: input.reason,
        afterData: {
          matchedRecords: total,
          exportLimit: AUDIT_CSV_EXPORT_LIMIT,
          filters: safeAuditExportFilters(input),
        },
        ip: actor.ip,
      });
      throw new ConflictException({
        code: "AUDIT_EXPORT_LIMIT_EXCEEDED",
        message: `The current filter matches more than ${AUDIT_CSV_EXPORT_LIMIT} records. Narrow the filter before exporting.`,
      });
    }
    const events = await this.prisma.auditEvent.findMany({
      where,
      take: AUDIT_CSV_EXPORT_LIMIT + 1,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        requestId: true,
        action: true,
        targetType: true,
        targetId: true,
        result: true,
        reason: true,
        createdAt: true,
        actor: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    });
    if (events.length > AUDIT_CSV_EXPORT_LIMIT) {
      await this.audit.record({
        actorId: actor.userId,
        action: "audit.export.csv",
        targetType: "AuditExport",
        targetId: actor.requestId,
        result: "DENIED",
        requestId: actor.requestId,
        reason: input.reason,
        afterData: {
          matchedRecords: `more_than_${AUDIT_CSV_EXPORT_LIMIT}`,
          exportLimit: AUDIT_CSV_EXPORT_LIMIT,
          filters: safeAuditExportFilters(input),
        },
        ip: actor.ip,
      });
      throw new ConflictException({
        code: "AUDIT_EXPORT_LIMIT_EXCEEDED",
        message: `The current filter matches more than ${AUDIT_CSV_EXPORT_LIMIT} records. Narrow the filter before exporting.`,
      });
    }
    const csv = serializeAuditCsv(events.map((event) => ({
      id: event.id,
      requestId: event.requestId,
      createdAt: event.createdAt.toISOString(),
      action: event.action,
      actorDisplayName: event.actor?.displayName ?? null,
      actorEmail: event.actor?.email ?? null,
      targetType: event.targetType,
      targetId: event.targetId,
      result: event.result,
      reason: event.reason,
    })));
    await this.audit.record({
      actorId: actor.userId,
      action: "audit.export.csv",
      targetType: "AuditExport",
      targetId: actor.requestId,
      result: "SUCCEEDED",
      requestId: actor.requestId,
      reason: input.reason,
      afterData: {
        recordCount: events.length,
        filters: safeAuditExportFilters(input),
      },
      ip: actor.ip,
    });
    return {
      csv,
      filename: auditCsvFilename(),
      recordCount: events.length,
    };
  }

  private async requireRecentAuthentication(
    reason: string,
    actor: AdminActor,
  ): Promise<void> {
    const now = Date.now();
    if (
      Number.isFinite(actor.reauthenticatedAt)
      && actor.reauthenticatedAt
      && actor.reauthenticatedAt <= now
      && now - actor.reauthenticatedAt <= recentAuthenticationWindowMs
    ) return;
    await this.audit.record({
      actorId: actor.userId,
      action: "audit.export.csv",
      targetType: "AuditExport",
      targetId: actor.requestId,
      result: "DENIED",
      requestId: actor.requestId,
      reason,
      ip: actor.ip,
    });
    throw new ForbiddenException({
      code: "RECENT_AUTHENTICATION_REQUIRED",
      message: "Recent reauthentication is required.",
    });
  }

  private async saveNewProduct(input: CreateProductDto, actor: AdminActor) {
    const product = await this.prisma.product.create({
      data: {
        slug: input.slug,
        categoryId: input.categoryId,
        imageKey: input.imageKey,
        basePrice: input.basePrice,
        compareAtPrice: input.compareAtPrice,
        stockMode: input.stockMode,
        stockQuantity: input.stockMode === "UNLIMITED" ? null : input.stockQuantity,
        status: input.status,
        sortOrder: input.sortOrder,
        translations: {
          create: [
            {
              locale: "ZH",
              name: input.nameZh,
              normalizedName: normalizeName(input.nameZh),
              kicker: input.kickerZh,
              description: input.descriptionZh,
            },
            {
              locale: "EN",
              name: input.nameEn,
              normalizedName: normalizeName(input.nameEn),
              kicker: input.kickerEn,
              description: input.descriptionEn,
            },
          ],
        },
      },
    }).catch(() => {
      throw new ConflictException("Product slug or relation is invalid.");
    });
    await this.audit.record({
      actorId: actor.userId,
      action: "product.create",
      targetType: "Product",
      targetId: product.id,
      result: "SUCCEEDED",
      afterData: { slug: product.slug, status: product.status },
      ...actor,
    });
    return product;
  }
}

type AuditFilterInput = Pick<
  AdminAuditQueryDto,
  | "search"
  | "result"
  | "actor"
  | "targetType"
  | "timeRange"
  | "scope"
  | "category"
  | "severity"
>;

const securityScopeWhere = (): Prisma.AuditEventWhereInput => ({
  OR: [
    { action: { in: [...securityAuditActions] } },
    { result: "DENIED" },
  ],
});

const securityCategoryWhere = (
  category: SecurityEventCategory,
): Prisma.AuditEventWhereInput => {
  const categoryActions = securityAuditActionsForCategory(category);
  if (category !== "authorization") {
    return { action: { in: categoryActions } };
  }
  return {
    OR: [
      { action: { in: categoryActions } },
      {
        AND: [
          { result: "DENIED" },
          { action: { notIn: [...securityAuditActions] } },
        ],
      },
    ],
  };
};

const securitySeverityWhere = (
  severity: SecurityEventSeverity,
): Prisma.AuditEventWhereInput => {
  const defaultActions = securityAuditActionsForDefaultSeverity(severity);
  if (severity !== "high") {
    return {
      AND: [
        { result: "SUCCEEDED" },
        { action: { in: defaultActions } },
      ],
    };
  }
  return {
    OR: [
      { result: { in: ["FAILED", "DENIED"] } },
      {
        AND: [
          { result: "SUCCEEDED" },
          { action: { in: defaultActions } },
        ],
      },
    ],
  };
};

const auditWhere = (
  query: AuditFilterInput,
  now = Date.now(),
  options: { deniedOrFailedOnly?: boolean } = {},
): Prisma.AuditEventWhereInput => {
  const search = query.search?.normalize("NFKC").trim();
  const timeRange = query.timeRange ?? "all";
  const baseWhere: Prisma.AuditEventWhereInput = {
    ...(query.result ? { result: query.result } : {}),
    ...(query.actor === "administrator"
      ? { actorId: { not: null } }
      : query.actor === "system"
        ? { actorId: null }
        : {}),
    ...(query.targetType ? { targetType: query.targetType.trim() } : {}),
    ...(timeRange === "all"
      ? {}
      : { createdAt: { gte: new Date(now - auditTimeRangeMs[timeRange]) } }),
    ...(search
      ? {
          OR: [
            { id: { contains: search } },
            { requestId: { contains: search } },
            { action: { contains: search } },
            { targetType: { contains: search } },
            { targetId: { contains: search } },
            { reason: { contains: search } },
            {
              actor: {
                is: {
                  OR: [
                    { displayName: { contains: search } },
                    { email: { contains: search } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };
  const usesSecurityScope = query.scope === "security"
    || query.category !== undefined
    || query.severity !== undefined
    || options.deniedOrFailedOnly === true;
  if (!usesSecurityScope) return baseWhere;
  return {
    AND: [
      baseWhere,
      securityScopeWhere(),
      ...(query.category ? [securityCategoryWhere(query.category)] : []),
      ...(query.severity ? [securitySeverityWhere(query.severity)] : []),
      ...(options.deniedOrFailedOnly
        ? [{ result: { in: ["FAILED", "DENIED"] } } satisfies Prisma.AuditEventWhereInput]
        : []),
    ],
  };
};

const safeAuditExportFilters = (input: AuditFilterInput) => ({
  ...(input.search ? { search: input.search } : {}),
  ...(input.result ? { result: input.result } : {}),
  ...(input.actor ? { actor: input.actor } : {}),
  ...(input.targetType ? { targetType: input.targetType } : {}),
  timeRange: input.timeRange ?? "all",
});
