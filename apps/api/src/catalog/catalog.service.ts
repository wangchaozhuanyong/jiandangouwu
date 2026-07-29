import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CategorySummary,
  Locale,
  PageMeta,
  ProductDetail,
  ProductSummary,
  StorefrontConfig,
} from "@cloudbridge/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { OrderReservationService } from "../orders/order-reservation.service.js";
import { SettingsService } from "../settings/settings.service.js";
import type { CatalogQueryDto, LocaleQueryDto } from "./catalog.dto.js";

const localeCode = (locale: Locale): "ZH" | "EN" => locale === "zh" ? "ZH" : "EN";
const normalizeSearch = (value: string): string => value.normalize("NFKC").trim().toLocaleLowerCase();

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly reservations: OrderReservationService,
  ) {}

  private async getRate(currency: string) {
    const target = await this.prisma.currency.findFirst({
      where: {
        code: currency.toUpperCase(),
        active: true,
      },
    });
    if (!target) throw new NotFoundException("The selected currency is unavailable.");
    const rate = await this.prisma.exchangeRate.findFirst({
      where: {
        fromCode: "MYR",
        toCode: target.code,
      },
      orderBy: { effectiveAt: "desc" },
    });
    if (!rate) throw new NotFoundException("The selected currency rate is unavailable.");
    return { target, rate };
  }

  private async mapProduct(
    product: Awaited<ReturnType<PrismaService["product"]["findFirstOrThrow"]>>,
    locale: Locale,
    currency: string,
  ): Promise<ProductSummary> {
    const detailed = product as typeof product & {
      translations: Array<{ name: string; kicker: string; description: string }>;
      category: {
        id: string;
        slug: string;
        sortOrder: number;
        translations: Array<{ name: string }>;
      };
    };
    const { target, rate } = await this.getRate(currency);
    const translation = detailed.translations[0];
    const categoryTranslation = detailed.category.translations[0];
    if (!translation || !categoryTranslation) {
      throw new NotFoundException(`The ${locale} translation is unavailable.`);
    }
    const amount = detailed.basePrice.mul(rate.rate).toDecimalPlaces(target.digits);
    const compareAt = detailed.compareAtPrice?.mul(rate.rate).toDecimalPlaces(target.digits) ?? null;
    const referenceRate = await this.prisma.exchangeRate.findFirst({
      where: { fromCode: "MYR", toCode: target.code === "USDT" ? "MYR" : "USDT" },
      orderBy: { effectiveAt: "desc" },
      include: { toCurrency: true },
    });
    const referenceAmount = referenceRate
      ? detailed.basePrice.mul(referenceRate.rate).toDecimalPlaces(referenceRate.toCurrency.digits)
      : null;
    return {
      id: detailed.id,
      slug: detailed.slug,
      categoryId: detailed.categoryId,
      name: translation.name,
      kicker: translation.kicker,
      imageUrl: detailed.imageKey,
      price: { amount: amount.toFixed(target.digits), currency: target.code },
      compareAtPrice: compareAt ? { amount: compareAt.toFixed(target.digits), currency: target.code } : null,
      referencePrice: referenceAmount && referenceRate
        ? { amount: referenceAmount.toFixed(referenceRate.toCurrency.digits), currency: referenceRate.toCode }
        : null,
      stockMode: detailed.stockMode,
      stockQuantity: detailed.stockQuantity,
      status: detailed.status,
    };
  }

  async categories(locale: Locale): Promise<CategorySummary[]> {
    const categories = await this.prisma.category.findMany({
      where: { status: "ACTIVE" },
      orderBy: { sortOrder: "asc" },
      include: {
        translations: {
          where: { locale: localeCode(locale) },
          take: 1,
        },
      },
    });
    return categories.flatMap((category) => {
      const translation = category.translations[0];
      return translation
        ? [{
            id: category.id,
            slug: category.slug,
            name: translation.name,
            order: category.sortOrder,
          }]
        : [];
    });
  }

  async products(query: CatalogQueryDto): Promise<{ data: ProductSummary[]; meta: PageMeta }> {
    await this.reservations.reconcileExpired();
    const locale = query.locale as Locale;
    const normalized = query.search ? normalizeSearch(query.search) : undefined;
    const where = {
      status: "ACTIVE" as const,
      ...(query.category ? { category: { slug: query.category, status: "ACTIVE" as const } } : {}),
      ...(normalized
        ? {
            translations: {
              some: {
                locale: localeCode(locale),
                normalizedName: { contains: normalized },
              },
            },
          }
        : {}),
    };
    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { sortOrder: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          translations: {
            where: { locale: localeCode(locale) },
            take: 1,
          },
          category: {
            include: {
              translations: {
                where: { locale: localeCode(locale) },
                take: 1,
              },
            },
          },
        },
      }),
    ]);
    return {
      data: await Promise.all(products.map((product) => this.mapProduct(product, locale, query.currency))),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    };
  }

  async product(slug: string, query: LocaleQueryDto): Promise<ProductDetail> {
    await this.reservations.reconcileExpired();
    const locale = query.locale as Locale;
    const product = await this.prisma.product.findFirst({
      where: { slug, status: "ACTIVE" },
      include: {
        translations: {
          where: { locale: localeCode(locale) },
          take: 1,
        },
        category: {
          include: {
            translations: {
              where: { locale: localeCode(locale) },
              take: 1,
            },
          },
        },
      },
    });
    if (!product) throw new NotFoundException("Product not found.");
    const summary = await this.mapProduct(product, locale, query.currency);
    const translation = product.translations[0];
    const categoryTranslation = product.category.translations[0];
    if (!translation || !categoryTranslation) throw new NotFoundException("Product translation not found.");
    return {
      ...summary,
      description: translation.description,
      category: {
        id: product.category.id,
        slug: product.category.slug,
        name: categoryTranslation.name,
        order: product.category.sortOrder,
      },
    };
  }

  async storefrontConfig(locale: Locale): Promise<StorefrontConfig> {
    const code = localeCode(locale);
    const [heroes, currencies, channels, settings, activeProducts] = await Promise.all([
      this.prisma.hero.findMany({
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        include: { translations: { where: { locale: code }, take: 1 } },
      }),
      this.prisma.currency.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      }),
      this.prisma.merchantChannel.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      }),
      this.settings.publicSettings(),
      this.prisma.product.findMany({
        where: { status: "ACTIVE" },
        select: { slug: true },
      }),
    ]);
    const activeProductSlugs = new Set(activeProducts.map((product) => product.slug));
    return {
      heroes: heroes.flatMap((hero) => {
        if (hero.targetSlug && !activeProductSlugs.has(hero.targetSlug)) return [];
        const content = hero.translations[0];
        return content ? [{
          key: hero.key,
          imageUrl: hero.imageKey,
          targetSlug: hero.targetSlug,
          tone: hero.tone as StorefrontConfig["heroes"][number]["tone"],
          eyebrow: content.eyebrow,
          title: content.title,
          body: content.body,
          cta: content.cta,
        }] : [];
      }),
      currencies: currencies.map((currency) => ({
        code: currency.code,
        token: currency.token,
        name: locale === "zh" ? currency.nameZh : currency.nameEn,
        digits: currency.digits,
      })),
      channels: channels.map((channel) => ({
        type: channel.type,
        mode: channel.mode,
        label: locale === "zh" ? channel.labelZh : channel.labelEn,
        account: channel.publicAccount,
        directTarget: channel.directTarget,
        serviceHours: locale === "zh" ? channel.serviceHoursZh : channel.serviceHoursEn,
      })),
      settings,
    };
  }
}
