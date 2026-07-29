import type {
  AdminContactChannel,
  AdminHero,
  AdminStorefrontSettings,
  LocalizedText,
} from "@cloudbridge/contracts";
import type {
  AdminCategory,
  AdminProduct,
} from "../../api";

export const translationKinds = [
  "product",
  "category",
  "hero",
  "contact",
  "settings",
] as const;

export type TranslationKind = (typeof translationKinds)[number];

export type TranslationField = {
  key: string;
  label: LocalizedText;
  value: LocalizedText;
  maxLength: number;
  multiline: boolean;
};

type TranslationEntryBase = {
  key: string;
  resourceId: string;
  stableName: string;
  title: LocalizedText;
  fields: TranslationField[];
  updatedAt: string;
  canWrite: boolean;
};

export type TranslationEntry =
  | (TranslationEntryBase & { kind: "product"; source: AdminProduct })
  | (TranslationEntryBase & { kind: "category"; source: AdminCategory })
  | (TranslationEntryBase & { kind: "hero"; source: AdminHero })
  | (TranslationEntryBase & { kind: "contact"; source: AdminContactChannel })
  | (TranslationEntryBase & { kind: "settings"; source: AdminStorefrontSettings });

export type TranslationWorkspaceData = {
  products: AdminProduct[];
  categories: AdminCategory[];
  heroes: AdminHero[];
  contacts: AdminContactChannel[];
  settings: AdminStorefrontSettings | null;
};

export type TranslationDraft = Record<string, LocalizedText>;

export type TranslationFilter = {
  kind: "all" | TranslationKind;
  missingOnly: boolean;
  search: string;
};

export type TranslationCompletion = {
  complete: number;
  missing: number;
  percentage: number;
  total: number;
};

const localized = (zh = "", en = ""): LocalizedText => ({ zh, en });

const field = (
  key: string,
  labelZh: string,
  labelEn: string,
  value: LocalizedText,
  maxLength: number,
  multiline = false,
): TranslationField => ({
  key,
  label: localized(labelZh, labelEn),
  value: localized(value.zh ?? "", value.en ?? ""),
  maxLength,
  multiline,
});

export function buildTranslationEntries(
  data: TranslationWorkspaceData,
  permissions: readonly string[],
): TranslationEntry[] {
  const allowed = new Set(permissions);
  const entries: TranslationEntry[] = [
    ...data.products.map((source): TranslationEntry => ({
      kind: "product",
      key: `product:${source.id}`,
      resourceId: source.id,
      stableName: source.slug,
      title: localized(
        source.translations.zh?.name ?? "",
        source.translations.en?.name ?? "",
      ),
      updatedAt: source.updatedAt,
      canWrite: allowed.has("catalog.write"),
      source,
      fields: [
        field(
          "name",
          "商品名称",
          "Product name",
          localized(
            source.translations.zh?.name ?? "",
            source.translations.en?.name ?? "",
          ),
          200,
        ),
        field(
          "kicker",
          "内部短标题",
          "Internal kicker",
          localized(
            source.translations.zh?.kicker ?? "",
            source.translations.en?.kicker ?? "",
          ),
          180,
        ),
        field(
          "description",
          "商品说明",
          "Product description",
          localized(
            source.translations.zh?.description ?? "",
            source.translations.en?.description ?? "",
          ),
          5000,
          true,
        ),
      ],
    })),
    ...data.categories.map((source): TranslationEntry => ({
      kind: "category",
      key: `category:${source.id}`,
      resourceId: source.id,
      stableName: source.slug,
      title: localized(source.name.zh ?? "", source.name.en ?? ""),
      updatedAt: source.updatedAt,
      canWrite: allowed.has("catalog.write"),
      source,
      fields: [
        field(
          "name",
          "分类名称",
          "Category name",
          localized(source.name.zh ?? "", source.name.en ?? ""),
          160,
        ),
      ],
    })),
    ...data.heroes.map((source): TranslationEntry => ({
      kind: "hero",
      key: `hero:${source.id}`,
      resourceId: source.id,
      stableName: source.key,
      title: localized(
        source.translations.zh?.title ?? "",
        source.translations.en?.title ?? "",
      ),
      updatedAt: source.updatedAt,
      canWrite: allowed.has("content.write"),
      source,
      fields: [
        field(
          "eyebrow",
          "眉题",
          "Eyebrow",
          localized(
            source.translations.zh?.eyebrow ?? "",
            source.translations.en?.eyebrow ?? "",
          ),
          160,
        ),
        field(
          "title",
          "轮播标题",
          "Hero title",
          localized(
            source.translations.zh?.title ?? "",
            source.translations.en?.title ?? "",
          ),
          300,
          true,
        ),
        field(
          "body",
          "轮播正文",
          "Hero body",
          localized(
            source.translations.zh?.body ?? "",
            source.translations.en?.body ?? "",
          ),
          5000,
          true,
        ),
        field(
          "cta",
          "行动文案",
          "Call to action",
          localized(
            source.translations.zh?.cta ?? "",
            source.translations.en?.cta ?? "",
          ),
          120,
        ),
      ],
    })),
    ...data.contacts.map((source): TranslationEntry => ({
      kind: "contact",
      key: `contact:${source.id}`,
      resourceId: source.id,
      stableName: source.type,
      title: localized(source.label.zh ?? "", source.label.en ?? ""),
      updatedAt: source.updatedAt,
      canWrite: allowed.has("support.write"),
      source,
      fields: [
        field(
          "label",
          "渠道名称",
          "Channel label",
          localized(source.label.zh ?? "", source.label.en ?? ""),
          120,
        ),
        field(
          "serviceHours",
          "服务时间",
          "Service hours",
          localized(
            source.serviceHours.zh ?? "",
            source.serviceHours.en ?? "",
          ),
          120,
        ),
      ],
    })),
    ...(data.settings
      ? [{
          kind: "settings" as const,
          key: "settings:storefront",
          resourceId: "storefront",
          stableName: "storefront.settings",
          title: localized(
            data.settings.siteName.zh ?? "",
            data.settings.siteName.en ?? "",
          ),
          updatedAt: data.settings.updatedAt,
          canWrite: allowed.has("settings.write"),
          source: data.settings,
          fields: [
            field(
              "siteName",
              "站点名称",
              "Site name",
              localized(
                data.settings.siteName.zh ?? "",
                data.settings.siteName.en ?? "",
              ),
              120,
            ),
            field(
              "seoDescription",
              "SEO 描述",
              "SEO description",
              localized(
                data.settings.seoDescription.zh ?? "",
                data.settings.seoDescription.en ?? "",
              ),
              500,
              true,
            ),
          ],
        } satisfies TranslationEntry]
      : []),
  ];

  return entries.sort((left, right) => (
    translationKinds.indexOf(left.kind) - translationKinds.indexOf(right.kind)
    || left.stableName.localeCompare(right.stableName, "en")
  ));
}

export function completionForValues(values: readonly string[]): TranslationCompletion {
  const total = values.length;
  const complete = values.filter((value) => value.trim().length > 0).length;
  const missing = total - complete;
  return {
    complete,
    missing,
    percentage: total === 0 ? 100 : Math.round((complete / total) * 100),
    total,
  };
}

export function entryCompletion(entry: TranslationEntry): TranslationCompletion {
  return completionForValues(entry.fields.flatMap((item) => [
    item.value.zh,
    item.value.en,
  ]));
}

export function localeCompletion(
  entries: readonly TranslationEntry[],
  locale: keyof LocalizedText,
): TranslationCompletion {
  return completionForValues(entries.flatMap((entry) =>
    entry.fields.map((item) => item.value[locale])));
}

export function draftFromEntry(entry: TranslationEntry): TranslationDraft {
  return Object.fromEntries(entry.fields.map((item) => [
    item.key,
    localized(item.value.zh, item.value.en),
  ]));
}

export function normalizeTranslationDraft(
  entry: TranslationEntry,
  draft: TranslationDraft,
): { ok: true; value: TranslationDraft } | {
  ok: false;
  fieldKey: string;
  locale: keyof LocalizedText;
  reason: "blank" | "too-long";
} {
  const normalized: TranslationDraft = {};
  for (const item of entry.fields) {
    for (const locale of ["zh", "en"] as const) {
      const value = draft[item.key]?.[locale]?.trim() ?? "";
      if (!value) {
        return { ok: false, fieldKey: item.key, locale, reason: "blank" };
      }
      if (value.length > item.maxLength) {
        return { ok: false, fieldKey: item.key, locale, reason: "too-long" };
      }
      normalized[item.key] = {
        ...(normalized[item.key] ?? localized()),
        [locale]: value,
      };
    }
  }
  return { ok: true, value: normalized };
}

export function translationDraftChanged(
  entry: TranslationEntry,
  draft: TranslationDraft,
): boolean {
  return entry.fields.some((item) => (
    item.value.zh !== (draft[item.key]?.zh ?? "")
    || item.value.en !== (draft[item.key]?.en ?? "")
  ));
}

export function filterTranslationEntries(
  entries: readonly TranslationEntry[],
  filter: TranslationFilter,
): TranslationEntry[] {
  const search = filter.search.normalize("NFKC").trim().toLocaleLowerCase();
  return entries.filter((entry) => {
    if (filter.kind !== "all" && entry.kind !== filter.kind) return false;
    if (filter.missingOnly && entryCompletion(entry).missing === 0) return false;
    if (!search) return true;
    const searchable = [
      entry.kind,
      entry.stableName,
      entry.title.zh,
      entry.title.en,
      ...entry.fields.flatMap((item) => [item.value.zh, item.value.en]),
    ].join("\n").normalize("NFKC").toLocaleLowerCase();
    return searchable.includes(search);
  });
}
