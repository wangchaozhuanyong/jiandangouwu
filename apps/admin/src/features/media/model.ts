import type {
  AdminHero,
  AdminManagedMediaObject,
} from "@cloudbridge/contracts";
import type {
  AdminProduct,
  Locale,
} from "../../api";

export type MediaReferenceKind = "hero" | "product";

export type MediaReference = {
  id: string;
  kind: MediaReferenceKind;
  recordKey: string;
  label: Record<Locale, string>;
  status: string;
  updatedAt: string;
};

export type ReferencedMediaAsset = {
  imageKey: string;
  fileName: string;
  safeLocalPath: boolean;
  kinds: MediaReferenceKind[];
  references: MediaReference[];
  lastUpdatedAt: string;
  managed: AdminManagedMediaObject | null;
};

export type MediaAssetFilter = {
  kind: "all" | MediaReferenceKind | "managed" | "unreferenced";
  query: string;
};

export type MediaAssetSummary = {
  uniqueAssets: number;
  totalReferences: number;
  heroReferences: number;
  productReferences: number;
  invalidPaths: number;
  managedObjects: number;
  unreferencedManagedObjects: number;
  missingManagedObjects: number;
};

const localRasterAsset = /^\/(?:assets\/[A-Za-z0-9._/-]+|media\/uploads\/\d{4}\/\d{2}\/[A-Za-z0-9._-]+)\.(?:avif|gif|jpe?g|png|webp)$/iu;

const normalizeSearchText = (value: string): string =>
  value.normalize("NFKC").trim().toLocaleLowerCase();

export function isSafeReferencedMediaPath(value: string): boolean {
  return (
    localRasterAsset.test(value)
    && !value.includes("//")
    && !value.split("/").some((segment) => segment === "." || segment === "..")
  );
}

function fileNameFromPath(imageKey: string): string {
  const segments = imageKey.split("/").filter(Boolean);
  return (segments.at(-1) ?? imageKey) || "—";
}

function referenceKinds(references: MediaReference[]): MediaReferenceKind[] {
  const values = new Set(references.map((reference) => reference.kind));
  return (["hero", "product"] as const).filter((kind) => values.has(kind));
}

function latestReferenceTime(references: MediaReference[]): string {
  return references.reduce(
    (latest, reference) => (
      Date.parse(reference.updatedAt) > Date.parse(latest)
        ? reference.updatedAt
        : latest
    ),
    references[0]?.updatedAt ?? new Date(0).toISOString(),
  );
}

export function buildReferencedMediaAssets(
  products: AdminProduct[],
  heroes: AdminHero[],
): ReferencedMediaAsset[] {
  const referencesByPath = new Map<string, MediaReference[]>();
  const append = (imageKey: string, reference: MediaReference) => {
    const current = referencesByPath.get(imageKey) ?? [];
    current.push(reference);
    referencesByPath.set(imageKey, current);
  };

  products.forEach((product) => {
    append(product.imageKey, {
      id: product.id,
      kind: "product",
      recordKey: product.slug,
      label: {
        zh: product.translations.zh.name,
        en: product.translations.en.name,
      },
      status: product.status,
      updatedAt: product.updatedAt,
    });
  });

  heroes.forEach((hero) => {
    append(hero.imageKey, {
      id: hero.id,
      kind: "hero",
      recordKey: hero.key,
      label: {
        zh: hero.translations.zh.title,
        en: hero.translations.en.title,
      },
      status: hero.status,
      updatedAt: hero.updatedAt,
    });
  });

  return Array.from(referencesByPath, ([imageKey, references]) => {
    const orderedReferences = [...references].sort((left, right) => (
      left.kind.localeCompare(right.kind)
      || left.recordKey.localeCompare(right.recordKey)
    ));
    return {
      imageKey,
      fileName: fileNameFromPath(imageKey),
      safeLocalPath: isSafeReferencedMediaPath(imageKey),
      kinds: referenceKinds(orderedReferences),
      references: orderedReferences,
      lastUpdatedAt: latestReferenceTime(orderedReferences),
      managed: null,
    };
  }).sort((left, right) => left.imageKey.localeCompare(right.imageKey));
}

export function mergeMediaInventory(
  referencedAssets: ReferencedMediaAsset[],
  managedObjects: AdminManagedMediaObject[],
): ReferencedMediaAsset[] {
  const assets = new Map(
    referencedAssets.map((asset) => [asset.imageKey, { ...asset }]),
  );
  managedObjects.forEach((managed) => {
    const referenced = assets.get(managed.path);
    if (referenced) {
      assets.set(managed.path, {
        ...referenced,
        fileName: managed.fileName,
        managed,
      });
      return;
    }
    assets.set(managed.path, {
      imageKey: managed.path,
      fileName: managed.fileName,
      safeLocalPath: isSafeReferencedMediaPath(managed.path),
      kinds: [],
      references: [],
      lastUpdatedAt: managed.createdAt,
      managed,
    });
  });
  return Array.from(assets.values()).sort((left, right) => (
    right.lastUpdatedAt.localeCompare(left.lastUpdatedAt)
    || left.imageKey.localeCompare(right.imageKey)
  ));
}

export function filterReferencedMediaAssets(
  assets: ReferencedMediaAsset[],
  filter: MediaAssetFilter,
): ReferencedMediaAsset[] {
  const query = normalizeSearchText(filter.query);
  return assets.filter((asset) => {
    if (filter.kind === "managed" && !asset.managed) return false;
    if (
      filter.kind === "unreferenced"
      && (!asset.managed || asset.references.length > 0)
    ) return false;
    if (
      (filter.kind === "hero" || filter.kind === "product")
      && !asset.kinds.includes(filter.kind)
    ) return false;
    if (!query) return true;
    const searchable = [
      asset.imageKey,
      asset.fileName,
      ...asset.kinds,
      asset.managed?.uploadedByEmail ?? "",
      asset.managed?.storageStatus ?? "",
      ...asset.references.flatMap((reference) => [
        reference.recordKey,
        reference.label.zh,
        reference.label.en,
        reference.status,
      ]),
    ].map(normalizeSearchText);
    return searchable.some((value) => value.includes(query));
  });
}

export function summarizeReferencedMediaAssets(
  assets: ReferencedMediaAsset[],
): MediaAssetSummary {
  const references = assets.flatMap((asset) => asset.references);
  return {
    uniqueAssets: assets.length,
    totalReferences: references.length,
    heroReferences: references.filter((reference) => reference.kind === "hero").length,
    productReferences: references.filter((reference) => reference.kind === "product").length,
    invalidPaths: assets.filter((asset) => !asset.safeLocalPath).length,
    managedObjects: assets.filter((asset) => Boolean(asset.managed)).length,
    unreferencedManagedObjects: assets.filter(
      (asset) => asset.managed && asset.references.length === 0,
    ).length,
    missingManagedObjects: assets.filter(
      (asset) => asset.managed?.storageStatus === "MISSING",
    ).length,
  };
}
