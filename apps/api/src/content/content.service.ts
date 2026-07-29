import type {
  AdminHero,
  HeroTone,
  HeroTranslation,
} from "@cloudbridge/contracts";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service.js";
import type { AdminActor } from "../common/admin-actor.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type {
  CreateHeroDto,
  ReorderHeroesDto,
  UpdateHeroDto,
} from "./content.dto.js";

type HeroRecord = {
  id: string;
  key: string;
  imageKey: string;
  targetSlug: string | null;
  tone: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE";
  sortOrder: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  translations: Array<{
    locale: "ZH" | "EN";
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
  }>;
};

const MAX_HEROES = 100;

const emptyTranslation = (): HeroTranslation => ({
  eyebrow: "",
  title: "",
  body: "",
  cta: "",
});

const mapTranslation = (
  hero: HeroRecord,
  locale: "ZH" | "EN",
): HeroTranslation => {
  const translation = hero.translations.find((item) => item.locale === locale);
  return translation
    ? {
        eyebrow: translation.eyebrow,
        title: translation.title,
        body: translation.body,
        cta: translation.cta,
      }
    : emptyTranslation();
};

const mapHero = (hero: HeroRecord): AdminHero => ({
  id: hero.id,
  key: hero.key,
  imageKey: hero.imageKey,
  targetSlug: hero.targetSlug,
  tone: hero.tone as HeroTone,
  status: hero.status,
  sortOrder: hero.sortOrder,
  version: hero.version,
  translations: {
    zh: mapTranslation(hero, "ZH"),
    en: mapTranslation(hero, "EN"),
  },
  createdAt: hero.createdAt.toISOString(),
  updatedAt: hero.updatedAt.toISOString(),
});

export function validateHeroImageKey(imageKey: string): void {
  const normalized = imageKey.trim();
  const segments = normalized.split("/");
  const safe = /^\/assets\/[A-Za-z0-9._/-]+\.(?:avif|jpe?g|png|webp)$/u.test(normalized)
    && !segments.some((segment, index) => (
      segment === "."
      || segment === ".."
      || (segment.length === 0 && index > 0)
    ));
  if (!safe) {
    throw new BadRequestException("Hero image must be a safe local image asset.");
  }
}

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async heroes(): Promise<AdminHero[]> {
    const heroes = await this.prisma.hero.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { translations: true },
    });
    return heroes.map((hero) => mapHero(hero));
  }

  async createHero(input: CreateHeroDto, actor: AdminActor): Promise<AdminHero> {
    try {
      const hero = await this.prisma.$transaction(async (transaction) => {
        validateHeroImageKey(input.imageKey);
        await this.assertTargetExists(input.targetSlug, input.status === "ACTIVE", transaction);
        if (await transaction.hero.count() >= MAX_HEROES) {
          throw new BadRequestException(`A maximum of ${MAX_HEROES} hero stories is allowed.`);
        }
        const lastOrder = await transaction.hero.aggregate({
          _max: { sortOrder: true },
        });
        const created = await transaction.hero.create({
          data: {
            key: input.key.trim(),
            imageKey: input.imageKey.trim(),
            targetSlug: input.targetSlug?.trim() || null,
            tone: input.tone,
            status: input.status,
            sortOrder: (lastOrder._max.sortOrder ?? 0) + 1,
            translations: {
              create: [
                {
                  locale: "ZH",
                  ...this.translationData(input.translations.zh),
                },
                {
                  locale: "EN",
                  ...this.translationData(input.translations.en),
                },
              ],
            },
          },
          include: { translations: true },
        });
        await this.audit.record({
          actorId: actor.userId,
          action: "hero.create",
          targetType: "Hero",
          targetId: created.id,
          result: "SUCCEEDED",
          requestId: actor.requestId,
          afterData: mapHero(created),
          ip: actor.ip,
        }, transaction);
        return created;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      return mapHero(hero);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Hero key already exists.");
      }
      throw error;
    }
  }

  async updateHero(
    id: string,
    input: UpdateHeroDto,
    actor: AdminActor,
  ): Promise<AdminHero> {
    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.hero.findUnique({
          where: { id },
          include: { translations: true },
        });
        if (!current) throw new NotFoundException("Hero not found.");
        validateHeroImageKey(input.imageKey);
        await this.assertTargetExists(input.targetSlug, input.status === "ACTIVE", transaction);
        const result = await transaction.hero.updateMany({
          where: { id, version: input.version },
          data: {
            key: input.key.trim(),
            imageKey: input.imageKey.trim(),
            targetSlug: input.targetSlug?.trim() || null,
            tone: input.tone,
            status: input.status,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw new ConflictException("Hero changed. Reload before saving.");
        }
        await Promise.all([
          transaction.heroTranslation.upsert({
            where: { heroId_locale: { heroId: id, locale: "ZH" } },
            update: this.translationData(input.translations.zh),
            create: {
              heroId: id,
              locale: "ZH",
              ...this.translationData(input.translations.zh),
            },
          }),
          transaction.heroTranslation.upsert({
            where: { heroId_locale: { heroId: id, locale: "EN" } },
            update: this.translationData(input.translations.en),
            create: {
              heroId: id,
              locale: "EN",
              ...this.translationData(input.translations.en),
            },
          }),
        ]);
        const saved = await transaction.hero.findUniqueOrThrow({
          where: { id },
          include: { translations: true },
        });
        await this.audit.record({
          actorId: actor.userId,
          action: "hero.update",
          targetType: "Hero",
          targetId: id,
          result: "SUCCEEDED",
          requestId: actor.requestId,
          beforeData: mapHero(current),
          afterData: mapHero(saved),
          ip: actor.ip,
        }, transaction);
        return saved;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      return mapHero(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Hero key already exists.");
      }
      throw error;
    }
  }

  async reorderHeroes(
    input: ReorderHeroesDto,
    actor: AdminActor,
  ): Promise<AdminHero[]> {
    const updated = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.hero.findMany({
        select: { id: true, version: true, sortOrder: true },
      });
      const itemIds = input.items.map((item) => item.id);
      if (
        itemIds.length !== current.length
        || new Set(itemIds).size !== itemIds.length
        || current.some((hero) => !itemIds.includes(hero.id))
      ) {
        throw new BadRequestException("The complete unique hero order is required.");
      }
      for (const [index, item] of input.items.entries()) {
        const result = await transaction.hero.updateMany({
          where: { id: item.id, version: item.version },
          data: {
            sortOrder: index + 1,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw new ConflictException("Hero order changed. Reload before saving.");
        }
      }
      const saved = await transaction.hero.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { translations: true },
      });
      await this.audit.record({
        actorId: actor.userId,
        action: "hero.order.update",
        targetType: "Hero",
        result: "SUCCEEDED",
        requestId: actor.requestId,
        beforeData: current.map((item) => ({
          id: item.id,
          sortOrder: item.sortOrder,
          version: item.version,
        })),
        afterData: saved.map((item) => ({
          id: item.id,
          sortOrder: item.sortOrder,
          version: item.version,
        })),
        ip: actor.ip,
      }, transaction);
      return saved;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    return updated.map((hero) => mapHero(hero));
  }

  private async assertTargetExists(
    targetSlug: string | null,
    requireActive: boolean,
    client: Pick<Prisma.TransactionClient, "product"> = this.prisma,
  ): Promise<void> {
    if (!targetSlug) return;
    const product = await client.product.findFirst({
      where: {
        slug: targetSlug,
        status: requireActive ? "ACTIVE" : { not: "ARCHIVED" },
      },
      select: { id: true },
    });
    if (!product) {
      throw new BadRequestException("Hero target product does not exist.");
    }
  }

  private translationData(input: HeroTranslation): HeroTranslation {
    return {
      eyebrow: input.eyebrow.trim(),
      title: input.title.trim(),
      body: input.body.trim(),
      cta: input.cta.trim(),
    };
  }
}
