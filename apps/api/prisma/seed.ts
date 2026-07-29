import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  categorySeeds,
  currencySeeds,
  heroSeeds,
  merchantChannelSeeds,
  permissionSeeds,
  productSeeds,
  storefrontSettingsSeedForPolicy,
} from "./seed-data.js";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || "3306"),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: databaseUrl.pathname.replace(/^\//u, ""),
  connectionLimit: 5,
});
const prisma = new PrismaClient({ adapter });

const normalizeName = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase();

async function seed(): Promise<void> {
  const categories = new Map<string, string>();

  for (const category of categorySeeds) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: {
        slug: category.slug,
        sortOrder: category.order,
        status: "ACTIVE",
      },
    });
    categories.set(category.slug, saved.id);
    for (const locale of ["ZH", "EN"] as const) {
      await prisma.categoryTranslation.upsert({
        where: {
          categoryId_locale: {
            categoryId: saved.id,
            locale,
          },
        },
        update: {},
        create: {
          categoryId: saved.id,
          locale,
          name: locale === "ZH" ? category.zh : category.en,
        },
      });
    }
  }

  for (const [index, currency] of currencySeeds.entries()) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: {},
      create: {
        code: currency.code,
        token: currency.token,
        nameZh: currency.zh,
        nameEn: currency.en,
        digits: currency.digits,
        active: true,
        sortOrder: index + 1,
      },
    });
  }

  const effectiveAt = new Date("2026-07-27T00:00:00.000Z");
  for (const currency of currencySeeds) {
    await prisma.exchangeRate.upsert({
      where: {
        fromCode_toCode_effectiveAt: {
          fromCode: "MYR",
          toCode: currency.code,
          effectiveAt,
        },
      },
      update: {},
      create: {
        fromCode: "MYR",
        toCode: currency.code,
        rate: currency.rate,
        source: "prototype-seed",
        effectiveAt,
      },
    });
  }

  for (const [index, product] of productSeeds.entries()) {
    const categoryId = categories.get(product.category);
    if (!categoryId) throw new Error(`Missing category ${product.category}`);
    const saved = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: {
        slug: product.slug,
        categoryId,
        imageKey: product.imageKey,
        basePrice: product.price,
        compareAtPrice: product.compareAt,
        stockMode: product.stock === null ? "UNLIMITED" : "FINITE",
        stockQuantity: product.stock,
        status: "ACTIVE",
        sortOrder: index + 1,
      },
    });
    for (const locale of ["ZH", "EN"] as const) {
      const content = locale === "ZH" ? product.zh : product.en;
      await prisma.productTranslation.upsert({
        where: {
          productId_locale: {
            productId: saved.id,
            locale,
          },
        },
        update: {},
        create: {
          productId: saved.id,
          locale,
          name: content.name,
          normalizedName: normalizeName(content.name),
          kicker: content.kicker,
          description: content.description,
        },
      });
    }
  }

  for (const [index, hero] of heroSeeds.entries()) {
    const saved = await prisma.hero.upsert({
      where: { key: hero.key },
      update: {},
      create: {
        key: hero.key,
        imageKey: hero.imageKey,
        targetSlug: hero.targetSlug,
        tone: hero.tone,
        status: "ACTIVE",
        sortOrder: index + 1,
      },
    });
    for (const locale of ["ZH", "EN"] as const) {
      const content = locale === "ZH" ? hero.zh : hero.en;
      await prisma.heroTranslation.upsert({
        where: {
          heroId_locale: {
            heroId: saved.id,
            locale,
          },
        },
        update: {},
        create: {
          heroId: saved.id,
          locale,
          ...content,
        },
      });
    }
  }

  for (const [index, channel] of merchantChannelSeeds.entries()) {
    await prisma.merchantChannel.upsert({
      where: { type: channel.type },
      update: {},
      create: {
        type: channel.type,
        mode: channel.mode,
        labelZh: channel.zh,
        labelEn: channel.en,
        publicAccount: channel.account,
        directTarget: channel.directTarget,
        serviceHoursZh: channel.hoursZh,
        serviceHoursEn: channel.hoursEn,
        active: true,
        sortOrder: index + 1,
      },
    });
  }

  const role = await prisma.role.upsert({
    where: { key: "SUPER_ADMIN" },
    update: {
      nameZh: "超级管理员",
      nameEn: "Super admin",
    },
    create: {
      key: "SUPER_ADMIN",
      nameZh: "超级管理员",
      nameEn: "Super admin",
      description: "Full CloudBridge administration access",
    },
  });
  for (const key of permissionSeeds) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });
  }

  const policySetting = await prisma.siteSetting.upsert({
    where: { key: "policy.currentVersion" },
    update: {},
    create: {
      key: "policy.currentVersion",
      value: "2026-07-27",
    },
  });
  await prisma.siteSetting.upsert({
    where: { key: "storefront.settings" },
    update: {},
    create: {
      key: "storefront.settings",
      value: storefrontSettingsSeedForPolicy(policySetting.value),
    },
  });
}

seed()
  .then(() => {
    console.log("CloudBridge seed completed.");
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
