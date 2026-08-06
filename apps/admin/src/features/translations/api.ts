import type {
  AdminContactChannel,
  AdminHero,
  AdminStorefrontSettings,
} from "@cloudbridge/contracts";
import {
  getAllProducts,
  request,
  updateCategory,
  updateProduct,
  type AdminCategory,
  type AdminProduct,
} from "../../api";
import {
  getHeroes,
  updateHero,
} from "../content/api";
import {
  getSiteSettings,
  updateSiteSettings,
} from "../settings/api";
import {
  getContactChannels,
  updateContactChannel,
} from "../support/api";
import type {
  TranslationDraft,
  TranslationEntry,
  TranslationWorkspaceData,
} from "./model";

export async function getTranslationWorkspace(
  permissions: readonly string[],
  signal?: AbortSignal,
): Promise<TranslationWorkspaceData> {
  const allowed = new Set(permissions);
  const canReadCatalog = allowed.has("catalog.read");
  const [products, categories, heroes, contacts, settings] = await Promise.all([
    canReadCatalog ? getAllProducts(signal) : Promise.resolve<AdminProduct[]>([]),
    canReadCatalog
      ? request<AdminCategory[]>("/admin/categories", { signal }).then(({ data }) => data)
      : Promise.resolve<AdminCategory[]>([]),
    allowed.has("content.read")
      ? getHeroes(signal)
      : Promise.resolve<AdminHero[]>([]),
    allowed.has("support.read")
      ? getContactChannels(signal)
      : Promise.resolve<AdminContactChannel[]>([]),
    allowed.has("settings.read")
      ? getSiteSettings(signal)
      : Promise.resolve<AdminStorefrontSettings | null>(null),
  ]);
  return { products, categories, heroes, contacts, settings };
}

const translation = (draft: TranslationDraft, key: string) => draft[key]!;

export async function saveTranslationEntry(
  entry: TranslationEntry,
  draft: TranslationDraft,
  reason: string,
): Promise<void> {
  if (entry.kind === "product") {
    const source = entry.source;
    await updateProduct(source.id, {
      slug: source.slug,
      categoryId: source.category.id,
      imageKey: source.imageKey,
      basePrice: source.basePrice,
      compareAtPrice: source.compareAtPrice,
      stockMode: source.stockMode,
      stockQuantity: source.stockQuantity,
      status: source.status,
      sortOrder: source.sortOrder,
      version: source.version,
      nameZh: translation(draft, "name").zh,
      nameEn: translation(draft, "name").en,
      kickerZh: translation(draft, "kicker").zh,
      kickerEn: translation(draft, "kicker").en,
      descriptionZh: translation(draft, "description").zh,
      descriptionEn: translation(draft, "description").en,
    });
    return;
  }

  if (entry.kind === "category") {
    const source = entry.source;
    await updateCategory(source.id, {
      version: source.version,
      slug: source.slug,
      sortOrder: source.sortOrder,
      status: source.status,
      nameZh: translation(draft, "name").zh,
      nameEn: translation(draft, "name").en,
    });
    return;
  }

  if (entry.kind === "hero") {
    const source = entry.source;
    await updateHero(source.id, {
      key: source.key,
      imageKey: source.imageKey,
      targetSlug: source.targetSlug,
      tone: source.tone,
      status: source.status,
      sortOrder: source.sortOrder,
      version: source.version,
      translations: {
        zh: {
          eyebrow: translation(draft, "eyebrow").zh,
          title: translation(draft, "title").zh,
          body: translation(draft, "body").zh,
          cta: translation(draft, "cta").zh,
        },
        en: {
          eyebrow: translation(draft, "eyebrow").en,
          title: translation(draft, "title").en,
          body: translation(draft, "body").en,
          cta: translation(draft, "cta").en,
        },
      },
    });
    return;
  }

  if (entry.kind === "contact") {
    const source = entry.source;
    await updateContactChannel(source.id, {
      version: source.version,
      label: translation(draft, "label"),
      publicAccount: source.publicAccount,
      directTarget: source.directTarget,
      serviceHours: translation(draft, "serviceHours"),
      active: source.active,
      sortOrder: source.sortOrder,
    });
    return;
  }

  const source = entry.source;
  await updateSiteSettings({
    version: source.version,
    siteName: translation(draft, "siteName"),
    defaultLocale: source.defaultLocale,
    seoDescription: translation(draft, "seoDescription"),
    policyVersion: source.policyVersion,
    acceptOrders: source.acceptOrders,
    supportEnabled: source.supportEnabled,
    inventoryRiskThreshold: source.inventoryRiskThreshold,
    transitServiceEnabled: source.transitServiceEnabled,
    transitServiceUrl: source.transitServiceUrl,
    bannerVisibility: source.bannerVisibility,
    shareTemplate: source.shareTemplate,
    reason,
  });
}
