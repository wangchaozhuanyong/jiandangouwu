import assert from "node:assert/strict";
import test from "node:test";
import {
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import {
  ContentService,
  validateHeroImageKey,
} from "../src/content/content.service.js";

const hero = (id: string, version: number, sortOrder: number) => ({
  id,
  key: id,
  imageKey: `/assets/hero-${id}.webp`,
  targetSlug: null,
  tone: "cyan",
  status: "ACTIVE" as const,
  sortOrder,
  version,
  createdAt: new Date(`2026-07-2${sortOrder}T00:00:00.000Z`),
  updatedAt: new Date(`2026-07-2${sortOrder}T00:00:00.000Z`),
  translations: [
    { locale: "ZH" as const, eyebrow: "中文", title: "中文", body: "中文", cta: "查看" },
    { locale: "EN" as const, eyebrow: "English", title: "English", body: "English", cta: "View" },
  ],
});

function contentHarness() {
  const rows = [hero("first", 1, 1), hero("second", 1, 2)];
  const auditEvents: unknown[] = [];
  const transaction = {
    hero: {
      updateMany: async ({ where, data }: {
        where: { id: string; version: number };
        data: { sortOrder: number; version: { increment: number } };
      }) => {
        const row = rows.find((item) => item.id === where.id && item.version === where.version);
        if (!row) return { count: 0 };
        row.sortOrder = data.sortOrder;
        row.version += data.version.increment;
        row.updatedAt = new Date("2026-07-28T00:00:00.000Z");
        return { count: 1 };
      },
      findMany: async () => [...rows].sort((a, b) => a.sortOrder - b.sortOrder),
    },
  };
  const prisma = {
    hero: {
      findMany: async () => rows.map(({ id, version, sortOrder }) => ({ id, version, sortOrder })),
    },
    $transaction: async (callback: (client: typeof transaction) => unknown) => callback(transaction),
  };
  const audit = {
    record: async (event: unknown) => {
      auditEvents.push(event);
    },
  };
  return {
    service: new ContentService(prisma as never, audit as never),
    rows,
    auditEvents,
  };
}

test("hero reordering requires every hero exactly once", async () => {
  const { service } = contentHarness();
  await assert.rejects(
    service.reorderHeroes(
      { items: [{ id: "first", version: 1 }, { id: "first", version: 1 }] },
      { userId: "admin", requestId: "request" },
    ),
    BadRequestException,
  );
});

test("hero images accept only safe local raster assets", () => {
  assert.doesNotThrow(() => validateHeroImageKey("/assets/heroes/cloudbridge.v2.webp"));
  for (const imageKey of [
    "https://example.com/hero.webp",
    "/assets/../secret.webp",
    "/assets//hero.webp",
    "/assets/hero.svg",
  ]) {
    assert.throws(() => validateHeroImageKey(imageKey), BadRequestException);
  }
});

test("hero creation appends after the current highest order", async () => {
  let createData: { sortOrder: number } | undefined;
  const transaction = {
    product: {
      findFirst: async () => ({ id: "product" }),
    },
    hero: {
      count: async () => 2,
      aggregate: async () => ({ _max: { sortOrder: 7 } }),
      create: async ({ data }: {
        data: {
          key: string;
          imageKey: string;
          targetSlug: string | null;
          tone: string;
          status: "DRAFT" | "ACTIVE" | "INACTIVE";
          sortOrder: number;
          translations: {
            create: Array<{
              locale: "ZH" | "EN";
              eyebrow: string;
              title: string;
              body: string;
              cta: string;
            }>;
          };
        };
      }) => {
        createData = data;
        return {
          ...hero(data.key, 1, data.sortOrder),
          key: data.key,
          imageKey: data.imageKey,
          targetSlug: data.targetSlug,
          tone: data.tone,
          status: data.status,
          translations: data.translations.create,
        };
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof transaction) => unknown) => callback(transaction),
  };
  const audit = { record: async () => undefined };
  const service = new ContentService(prisma as never, audit as never);

  const created = await service.createHero({
    key: "new-hero",
    imageKey: "/assets/hero-new.webp",
    targetSlug: null,
    tone: "cyan",
    status: "ACTIVE",
    sortOrder: 999,
    translations: {
      zh: { eyebrow: "中文", title: "中文", body: "中文", cta: "查看" },
      en: { eyebrow: "English", title: "English", body: "English", cta: "View" },
    },
  }, { userId: "admin", requestId: "request" });

  assert.equal(createData?.sortOrder, 8);
  assert.equal(created.sortOrder, 8);
});

test("hero update preserves order and records complete before and after values", async () => {
  const current = hero("existing", 1, 4);
  const saved = {
    ...current,
    key: "updated-hero",
    version: 2,
    updatedAt: new Date("2026-07-28T00:00:00.000Z"),
  };
  let updateData: Record<string, unknown> | undefined;
  const auditEvents: Array<Record<string, unknown>> = [];
  const transaction = {
    product: {
      findFirst: async () => ({ id: "product" }),
    },
    hero: {
      findUnique: async () => current,
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return { count: 1 };
      },
      findUniqueOrThrow: async () => saved,
    },
    heroTranslation: {
      upsert: async () => undefined,
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof transaction) => unknown) => callback(transaction),
  };
  const audit = {
    record: async (event: Record<string, unknown>) => {
      auditEvents.push(event);
    },
  };
  const service = new ContentService(prisma as never, audit as never);

  const updated = await service.updateHero("existing", {
    key: "updated-hero",
    imageKey: current.imageKey,
    targetSlug: null,
    tone: "cyan",
    status: "ACTIVE",
    sortOrder: 999,
    version: 1,
    translations: {
      zh: { eyebrow: "中文", title: "中文", body: "中文", cta: "查看" },
      en: { eyebrow: "English", title: "English", body: "English", cta: "View" },
    },
  }, { userId: "admin", requestId: "request" });

  assert.equal(Object.hasOwn(updateData ?? {}, "sortOrder"), false);
  assert.equal(updated.sortOrder, 4);
  assert.deepEqual(auditEvents[0]?.beforeData, {
    ...auditEvents[0]?.beforeData as Record<string, unknown>,
    sortOrder: 4,
  });
  assert.deepEqual(auditEvents[0]?.afterData, {
    ...auditEvents[0]?.afterData as Record<string, unknown>,
    sortOrder: 4,
  });
});

test("hero reordering checks versions and records the committed order", async () => {
  const { service, auditEvents } = contentHarness();
  const reordered = await service.reorderHeroes(
    { items: [{ id: "second", version: 1 }, { id: "first", version: 1 }] },
    { userId: "admin", requestId: "request" },
  );
  assert.deepEqual(reordered.map((item) => item.id), ["second", "first"]);
  assert.deepEqual(reordered.map((item) => item.sortOrder), [1, 2]);
  assert.equal(auditEvents.length, 1);

  await assert.rejects(
    service.reorderHeroes(
      { items: [{ id: "first", version: 1 }, { id: "second", version: 1 }] },
      { userId: "admin", requestId: "request-2" },
    ),
    ConflictException,
  );
});
