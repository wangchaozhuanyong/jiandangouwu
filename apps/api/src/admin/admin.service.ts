import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service.js";
import { ContactProtectionService } from "../orders/contact-protection.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type {
  AdminListQueryDto,
  CreateCategoryDto,
  CreateProductDto,
  UpdateCategoryDto,
  UpdateOrderStatusDto,
  UpdateProductDto,
  UpdateRateDto,
} from "./admin.dto.js";

type Actor = {
  userId: string;
  requestId: string;
  ip?: string;
  reauthenticatedAt?: number | null;
};

const normalizeName = (value: string): string => value.normalize("NFKC").trim().toLocaleLowerCase();

const transitions: Record<string, ReadonlySet<string>> = {
  MANUAL_PENDING: new Set(["CONTACTED", "CANCELLED"]),
  CONTACTED: new Set(["AWAITING_PAYMENT", "CANCELLED"]),
  AWAITING_PAYMENT: new Set(["PAYMENT_PROCESSING", "PAID", "CANCELLED"]),
  PAYMENT_PROCESSING: new Set(["PAID", "CANCELLED", "DISPUTED"]),
  PAID: new Set(["FULFILLING", "REFUND_PENDING", "DISPUTED"]),
  FULFILLING: new Set(["COMPLETED", "REFUND_PENDING", "DISPUTED"]),
  COMPLETED: new Set(["REFUND_PENDING", "DISPUTED"]),
  REFUND_PENDING: new Set(["REFUNDED", "DISPUTED"]),
  REFUNDED: new Set(),
  CANCELLED: new Set(),
  DISPUTED: new Set(["REFUND_PENDING", "REFUNDED"]),
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly contacts: ContactProtectionService,
  ) {}

  async overview() {
    const [productCount, activeProducts, openOrders, categoryCount, latestOrders] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: "ACTIVE" } }),
      this.prisma.order.count({ where: { status: { notIn: ["COMPLETED", "CANCELLED", "REFUNDED"] } } }),
      this.prisma.category.count({ where: { status: { not: "ARCHIVED" } } }),
      this.prisma.order.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          productNameSnapshot: true,
          currencyCode: true,
          amount: true,
          maskedContact: true,
          contactChannel: true,
          status: true,
          createdAt: true,
          currency: { select: { digits: true } },
        },
      }),
    ]);
    return {
      metrics: { productCount, activeProducts, openOrders, categoryCount },
      latestOrders: latestOrders.map(({ currency, ...order }) => ({
        ...order,
        amount: order.amount.toFixed(currency.digits),
      })),
    };
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

  async createCategory(input: CreateCategoryDto, actor: Actor) {
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

  async updateCategory(id: string, input: UpdateCategoryDto, actor: Actor) {
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
    const normalized = query.search?.normalize("NFKC").trim();
    const where = {
      ...(query.status ? { status: query.status as "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED" } : {}),
      ...(normalized
        ? {
            OR: [
              { slug: { contains: normalized } },
              { translations: { some: { name: { contains: normalized } } } },
            ],
          }
        : {}),
    };
    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
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

  createProduct(input: CreateProductDto, actor: Actor) {
    return this.saveNewProduct(input, actor);
  }

  async updateProduct(id: string, input: UpdateProductDto, actor: Actor) {
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

  async orders(query: AdminListQueryDto) {
    const where = {
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.search
        ? {
            OR: [
              { orderNumber: { contains: query.search } },
              { productNameSnapshot: { contains: query.search } },
              { maskedContact: { contains: query.search } },
            ],
          }
        : {}),
    };
    const [total, orders, currencies] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          currency: { select: { digits: true } },
          statusHistory: { orderBy: { createdAt: "desc" }, take: 5 },
        },
      }),
      this.prisma.currency.findMany({ select: { code: true, digits: true } }),
    ]);
    const currencyDigits = new Map(currencies.map((currency) => [currency.code, currency.digits]));
    return {
      data: orders.map(({
        contactEncrypted: _contactEncrypted,
        contactHash: _contactHash,
        currency,
        ...order
      }) => ({
        ...order,
        amount: order.amount.toFixed(currency.digits),
        referenceAmount: order.referenceAmount?.toFixed(
          currencyDigits.get(order.referenceCurrencyCode ?? "") ?? 2,
        ) ?? null,
        exchangeRateSnapshot: order.exchangeRateSnapshot.toFixed(10),
      })),
      meta: { page: query.page, pageSize: query.pageSize, total, pageCount: Math.ceil(total / query.pageSize) },
    };
  }

  async updateOrderStatus(id: string, input: UpdateOrderStatusDto, actor: Actor) {
    const current = await this.prisma.order.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Order not found.");
    if (!transitions[current.status]?.has(input.status)) {
      throw new ConflictException(`Order cannot move from ${current.status} to ${input.status}.`);
    }
    const updated = await this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.update({ where: { id }, data: { status: input.status } });
      await transaction.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: current.status,
          toStatus: input.status,
          reason: input.reason,
          actorId: actor.userId,
        },
      });
      return order;
    });
    await this.audit.record({
      actorId: actor.userId,
      action: "order.status.update",
      targetType: "Order",
      targetId: id,
      result: "SUCCEEDED",
      reason: input.reason,
      beforeData: { status: current.status },
      afterData: { status: updated.status },
      ...actor,
    });
    return { id: updated.id, orderNumber: updated.orderNumber, status: updated.status };
  }

  async revealContact(id: string, actor: Actor) {
    if (!actor.reauthenticatedAt || Date.now() - actor.reauthenticatedAt > 5 * 60_000) {
      throw new ForbiddenException("Recent reauthentication is required.");
    }
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("Order not found.");
    await this.audit.record({
      actorId: actor.userId,
      action: "order.contact.reveal",
      targetType: "Order",
      targetId: id,
      result: "SUCCEEDED",
      ...actor,
    });
    return { contact: this.contacts.reveal(order.contactEncrypted), channel: order.contactChannel };
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

  async updateRate(code: string, input: UpdateRateDto, actor: Actor) {
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

  async auditEvents(query: AdminListQueryDto) {
    const [total, events] = await this.prisma.$transaction([
      this.prisma.auditEvent.count(),
      this.prisma.auditEvent.findMany({
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { displayName: true, email: true } } },
      }),
    ]);
    return {
      data: events,
      meta: { page: query.page, pageSize: query.pageSize, total, pageCount: Math.ceil(total / query.pageSize) },
    };
  }

  private async saveNewProduct(input: CreateProductDto, actor: Actor) {
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
