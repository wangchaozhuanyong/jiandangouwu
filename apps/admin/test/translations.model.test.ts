import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTranslationEntries,
  draftFromEntry,
  entryCompletion,
  filterTranslationEntries,
  localeCompletion,
  normalizeTranslationDraft,
  translationDraftChanged,
  type TranslationWorkspaceData,
} from "../src/features/translations/model.js";

const workspace = (): TranslationWorkspaceData => ({
  products: [{
    id: "product-1",
    slug: "codex",
    imageKey: "/assets/product-codex.webp",
    basePrice: "89.00",
    compareAtPrice: null,
    stockMode: "FINITE",
    stockQuantity: 8,
    status: "ACTIVE",
    sortOrder: 1,
    version: 2,
    category: {
      id: "category-1",
      slug: "development",
      name: { zh: "编码开发", en: "Development" },
    },
    translations: {
      zh: {
        name: "Codex 专业版",
        kicker: "开发工作流",
        description: "中文说明",
      },
      en: {
        name: "Codex Professional",
        kicker: "Developer workflow",
        description: "",
      },
    },
    updatedAt: "2026-07-29T10:00:00.000Z",
  }],
  categories: [{
    id: "category-1",
    slug: "development",
    status: "ACTIVE",
    sortOrder: 1,
    version: 1,
    name: { zh: "编码开发", en: "Development" },
    productCount: 1,
    updatedAt: "2026-07-29T10:00:00.000Z",
  }],
  heroes: [{
    id: "hero-1",
    key: "main",
    imageKey: "/assets/hero-main.webp",
    targetSlug: null,
    tone: "cyan",
    status: "ACTIVE",
    sortOrder: 1,
    version: 1,
    translations: {
      zh: {
        eyebrow: "云桥 / 01",
        title: "中文标题",
        body: "中文正文",
        cta: "查看",
      },
      en: {
        eyebrow: "CloudBridge / 01",
        title: "English title",
        body: "English body",
        cta: "View",
      },
    },
    createdAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-07-29T10:00:00.000Z",
  }],
  contacts: [{
    id: "contact-1",
    type: "EMAIL",
    mode: "DIRECT_LINK",
    label: { zh: "电子邮件", en: "Email" },
    publicAccount: "support@example.invalid",
    directTarget: "mailto:support@example.invalid",
    serviceHours: { zh: "10:00–22:00", en: "10:00–22:00" },
    active: true,
    sortOrder: 1,
    version: 1,
    updatedAt: "2026-07-29T10:00:00.000Z",
  }],
  settings: {
    version: 1,
    siteName: { zh: "云桥", en: "CloudBridge" },
    defaultLocale: "zh",
    seoDescription: { zh: "中文 SEO", en: "English SEO" },
    policyVersion: "2026-07-29",
    acceptOrders: true,
    supportEnabled: true,
    transitServiceEnabled: true,
    transitServiceUrl: null,
    updatedAt: "2026-07-29T10:00:00.000Z",
    orderReadiness: {
      activeContactChannels: 1,
      configuredActiveContactChannels: 1,
    },
  },
});

test("translation entries cover every readable bilingual domain without widening write access", () => {
  const entries = buildTranslationEntries(workspace(), [
    "catalog.read",
    "catalog.write",
    "content.read",
    "support.read",
    "settings.read",
  ]);

  assert.deepEqual(entries.map((entry) => entry.kind), [
    "product",
    "category",
    "hero",
    "contact",
    "settings",
  ]);
  assert.equal(entries.find((entry) => entry.kind === "product")?.canWrite, true);
  assert.equal(entries.find((entry) => entry.kind === "category")?.canWrite, true);
  assert.equal(entries.find((entry) => entry.kind === "hero")?.canWrite, false);
  assert.equal(entries.find((entry) => entry.kind === "contact")?.canWrite, false);
  assert.equal(entries.find((entry) => entry.kind === "settings")?.canWrite, false);
});

test("translation completion counts blank locale values and remains language-specific", () => {
  const entries = buildTranslationEntries(workspace(), ["catalog.read"]);
  const product = entries.find((entry) => entry.kind === "product");
  assert.ok(product);
  assert.deepEqual(entryCompletion(product), {
    complete: 5,
    missing: 1,
    percentage: 83,
    total: 6,
  });
  assert.equal(localeCompletion(entries, "zh").missing, 0);
  assert.equal(localeCompletion(entries, "en").missing, 1);
});

test("translation filters combine kind, missing state, and normalized bilingual search", () => {
  const entries = buildTranslationEntries(workspace(), ["catalog.read", "content.read"]);
  assert.deepEqual(
    filterTranslationEntries(entries, {
      kind: "product",
      missingOnly: true,
      search: " CODEX ",
    }).map((entry) => entry.stableName),
    ["codex"],
  );
  assert.deepEqual(
    filterTranslationEntries(entries, {
      kind: "all",
      missingOnly: false,
      search: "中文标题",
    }).map((entry) => entry.stableName),
    ["main"],
  );
  assert.equal(filterTranslationEntries(entries, {
    kind: "hero",
    missingOnly: true,
    search: "",
  }).length, 0);
});

test("translation drafts trim accepted copy and reject blanks or over-limit values", () => {
  const product = buildTranslationEntries(workspace(), ["catalog.write"])
    .find((entry) => entry.kind === "product");
  assert.ok(product);
  const draft = draftFromEntry(product);
  draft.description = {
    zh: "  更新后的中文说明  ",
    en: "  Updated English description  ",
  };
  assert.equal(translationDraftChanged(product, draft), true);
  const normalized = normalizeTranslationDraft(product, draft);
  assert.equal(normalized.ok, true);
  if (normalized.ok) {
    assert.equal(normalized.value.description?.zh, "更新后的中文说明");
    assert.equal(normalized.value.description?.en, "Updated English description");
  }

  draft.name = { zh: "   ", en: "Codex Professional" };
  assert.deepEqual(normalizeTranslationDraft(product, draft), {
    ok: false,
    fieldKey: "name",
    locale: "zh",
    reason: "blank",
  });

  draft.name = { zh: "中文名称", en: "x".repeat(201) };
  assert.deepEqual(normalizeTranslationDraft(product, draft), {
    ok: false,
    fieldKey: "name",
    locale: "en",
    reason: "too-long",
  });
});
