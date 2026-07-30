import type {
  AdminHero,
  AdminManagedMediaObject,
} from "@cloudbridge/contracts";
import {
  ArrowsClockwise,
  CheckCircle,
  Copy,
  Eye,
  Image as ImageIcon,
  MagnifyingGlass,
  NotePencil,
  Package,
  PresentationChart,
  Trash,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ApiError,
  deleteManagedMedia,
  getAllProducts,
  getManagedMedia,
  replaceManagedMedia,
  uploadManagedMedia,
  type AdminProduct,
  type Locale,
} from "../../api";
import {
  invalidateAdminCacheByPrefix,
  useAdminStatus,
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../../admin-experience";
import {
  Dialog,
  formatDate,
  PanelState,
  RefreshNotice,
  StatusPill,
} from "../../admin-ui";
import { getHeroes } from "../content/api";
import {
  buildReferencedMediaAssets,
  filterReferencedMediaAssets,
  mergeMediaInventory,
  summarizeReferencedMediaAssets,
  type MediaAssetFilter,
  type MediaReferenceKind,
  type ReferencedMediaAsset,
} from "./model";

type MediaResourceData = {
  products: AdminProduct[];
  heroes: AdminHero[];
  managedObjects: AdminManagedMediaObject[];
};

type ImageProbe = {
  state: "ready" | "error";
  width: number | null;
  height: number | null;
};

type MediaOperation =
  | { kind: "upload" }
  | { kind: "replace"; asset: ReferencedMediaAsset }
  | { kind: "delete"; asset: ReferencedMediaAsset };

const copy = (locale: Locale, zh: string, en: string): string =>
  locale === "zh" ? zh : en;

const kindLabels: Record<MediaReferenceKind, Record<Locale, string>> = {
  hero: { zh: "首页轮播", en: "Hero" },
  product: { zh: "商品图片", en: "Product" },
};

const filterLabels: Record<MediaAssetFilter["kind"], Record<Locale, string>> = {
  all: { zh: "全部", en: "All" },
  managed: { zh: "R2 上传", en: "R2 uploads" },
  unreferenced: { zh: "未引用", en: "Unreferenced" },
  hero: kindLabels.hero,
  product: kindLabels.product,
};

export default function MediaPage({
  locale,
  permissions,
}: {
  locale: Locale;
  permissions: string[];
}) {
  const canReadCatalog = permissions.includes("catalog.read");
  const canReadContent = permissions.includes("content.read");
  const canWriteCatalog = permissions.includes("catalog.write");
  const canWriteContent = permissions.includes("content.write");
  const canUpload = canWriteCatalog || canWriteContent;
  const canReplace = canWriteCatalog && canWriteContent;
  const canDelete = canUpload;
  const loader = useCallback(async (signal: AbortSignal): Promise<MediaResourceData> => {
    const [products, heroes, managedObjects] = await Promise.all([
      canReadCatalog ? getAllProducts(signal) : Promise.resolve([]),
      canReadContent ? getHeroes(signal) : Promise.resolve([]),
      getManagedMedia(signal),
    ]);
    return { products, heroes, managedObjects };
  }, [canReadCatalog, canReadContent]);
  const resource = useCachedAdminResource<MediaResourceData>(
    `media-inventory:sites:${canReadCatalog ? "catalog" : "none"}:${canReadContent ? "content" : "none"}`,
    loader,
  );
  const slow = useSlowAdminRequest(resource.state);
  const { notify } = useAdminStatus();
  const [kind, setKind] = useState<MediaAssetFilter["kind"]>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReferencedMediaAsset | null>(null);
  const [operation, setOperation] = useState<MediaOperation | null>(null);
  const [probes, setProbes] = useState<Record<string, ImageProbe>>({});

  const assets = useMemo(
    () => mergeMediaInventory(
      buildReferencedMediaAssets(
        resource.data?.products ?? [],
        resource.data?.heroes ?? [],
      ),
      resource.data?.managedObjects ?? [],
    ),
    [resource.data],
  );
  const filtered = useMemo(
    () => filterReferencedMediaAssets(assets, { kind, query }),
    [assets, kind, query],
  );
  const summary = useMemo(() => summarizeReferencedMediaAssets(assets), [assets]);
  const loadFailures = assets.filter(
    (asset) => probes[asset.imageKey]?.state === "error",
  ).length;
  const issues = summary.invalidPaths + Math.max(
    loadFailures,
    summary.missingManagedObjects,
  );
  const hasReadPermission = canReadCatalog || canReadContent;
  const partialScope = canReadCatalog !== canReadContent;

  const updateProbe = useCallback((imageKey: string, probe: ImageProbe) => {
    setProbes((current) => {
      const previous = current[imageKey];
      if (
        previous?.state === probe.state
        && previous.width === probe.width
        && previous.height === probe.height
      ) return current;
      return { ...current, [imageKey]: probe };
    });
  }, []);

  const retry = () => {
    setProbes({});
    void resource.reload();
  };

  const completeMutation = () => {
    invalidateAdminCacheByPrefix("products");
    invalidateAdminCacheByPrefix("heroes");
    invalidateAdminCacheByPrefix("media-");
    setSelected(null);
    setOperation(null);
    setProbes({});
    void resource.reload();
  };

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      notify(copy(locale, "公开图片路径已复制。", "Public image path copied."));
    } catch {
      notify(
        copy(locale, "复制失败，请从详情中手动复制路径。", "Copy failed. Copy the path manually from details."),
        "error",
      );
    }
  };

  return (
    <section className="media-page">
      <div className="media-truth-note" role="note">
        <ImageIcon size={20} aria-hidden="true" />
        <span>
          <strong>
            {copy(locale, "Sites 媒体库与真实引用", "Sites media library and live references")}
          </strong>
          {copy(
            locale,
            "本页读取 R2 上传对象及当前账号有权查看的商品、首页轮播 D1 引用。打包在网站中的静态图片只在被引用时显示；删除始终要求图片未被任何记录使用。",
            "This page reads R2 uploads plus product and hero D1 references visible to this account. Bundled static images appear only while referenced, and deletion always requires zero database references.",
          )}
        </span>
      </div>

      {partialScope && (
        <div className="media-scope-note" role="status">
          <WarningCircle size={18} aria-hidden="true" />
          {canReadCatalog
            ? copy(locale, "当前缺少 content.read，仅显示商品图片引用。", "content.read is missing, so only product image references are shown.")
            : copy(locale, "当前缺少 catalog.read，仅显示首页轮播图片引用。", "catalog.read is missing, so only hero image references are shown.")}
        </div>
      )}

      {!hasReadPermission ? (
        <section className="admin-panel">
          <PanelState state="forbidden" locale={locale} retry={() => undefined} kind="cards" />
        </section>
      ) : !resource.data ? (
        <section className="admin-panel">
          <PanelState state={resource.state} locale={locale} retry={retry} kind="cards" />
        </section>
      ) : (
        <>
          <div className="media-summary">
            <MediaStat
              icon={ImageIcon}
              label={copy(locale, "媒体条目", "Media entries")}
              value={String(summary.uniqueAssets)}
              detail={copy(locale, "R2 对象与被引用静态图", "R2 objects and referenced bundled assets")}
            />
            <MediaStat
              icon={UploadSimple}
              label={copy(locale, "R2 上传对象", "R2 uploads")}
              value={String(summary.managedObjects)}
              detail={copy(
                locale,
                `${summary.unreferencedManagedObjects} 个当前未引用`,
                `${summary.unreferencedManagedObjects} currently unreferenced`,
              )}
            />
            <MediaStat
              icon={Package}
              label={copy(locale, "数据库引用", "Database references")}
              value={String(summary.totalReferences)}
              detail={copy(
                locale,
                `${summary.productReferences} 商品 · ${summary.heroReferences} 轮播`,
                `${summary.productReferences} products · ${summary.heroReferences} heroes`,
              )}
            />
            <MediaStat
              icon={issues > 0 ? WarningCircle : CheckCircle}
              label={copy(locale, "需要处理", "Needs attention")}
              value={String(issues)}
              detail={copy(
                locale,
                `${summary.missingManagedObjects} 个 R2 对象缺失`,
                `${summary.missingManagedObjects} R2 objects missing`,
              )}
              tone={issues > 0 ? "warning" : "success"}
            />
          </div>

          <div className="media-toolbar">
            <div className="media-kind-filter" role="group" aria-label={copy(locale, "媒体类型", "Media type")}>
              {([
                "all",
                "managed",
                "unreferenced",
                "hero",
                "product",
              ] as MediaAssetFilter["kind"][]).map((item) => (
                <button
                  className={kind === item ? "is-active" : ""}
                  key={item}
                  onClick={() => setKind(item)}
                  type="button"
                >
                  {filterLabels[item][locale]}
                </button>
              ))}
            </div>
            <label className="media-search">
              <MagnifyingGlass size={17} aria-hidden="true" />
              <span className="sr-only">{copy(locale, "搜索文件名、路径或使用记录", "Search filename, path, or usage")}</span>
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy(locale, "搜索文件名、路径或使用记录", "Search filename, path, or usage")}
                value={query}
              />
            </label>
            <div className="media-toolbar-actions">
              <button className="admin-secondary media-refresh" onClick={retry} type="button">
                <ArrowsClockwise size={17} aria-hidden="true" />
                {copy(locale, "刷新", "Refresh")}
              </button>
              {canUpload && (
                <button className="admin-primary media-upload" onClick={() => setOperation({ kind: "upload" })} type="button">
                  <UploadSimple size={17} aria-hidden="true" />
                  {copy(locale, "上传图片", "Upload image")}
                </button>
              )}
            </div>
          </div>

          <RefreshNotice
            state={resource.state}
            locale={locale}
            retry={retry}
            slow={slow}
          />

          {assets.length === 0 ? (
            <div className="media-empty" role="status">
              <ImageIcon size={28} aria-hidden="true" />
              <strong>{copy(locale, "媒体库目前为空", "The media library is empty")}</strong>
              <p>{copy(locale, "上传图片，或在商品和首页轮播中保存图片路径。", "Upload an image, or save an image path on a product or hero.")}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="media-empty" role="status">
              <MagnifyingGlass size={28} aria-hidden="true" />
              <strong>{copy(locale, "没有符合条件的图片", "No matching assets")}</strong>
              <p>{copy(locale, "请调整类型筛选或搜索内容。", "Change the type filter or search query.")}</p>
            </div>
          ) : (
            <div className="media-grid" aria-busy={resource.state === "refreshing"}>
              {filtered.map((asset) => (
                <MediaCard
                  asset={asset}
                  key={asset.imageKey}
                  locale={locale}
                  onOpen={() => setSelected(asset)}
                  onProbe={updateProbe}
                  probe={probes[asset.imageKey]}
                />
              ))}
            </div>
          )}
        </>
      )}

      {selected && !operation && (
        <MediaDetailDialog
          asset={selected}
          canDelete={canDelete && Boolean(selected.managed) && selected.references.length === 0}
          canReplace={canReplace && selected.references.length > 0}
          locale={locale}
          onClose={() => setSelected(null)}
          onCopy={() => void copyPath(selected.imageKey)}
          onDelete={() => setOperation({ kind: "delete", asset: selected })}
          onProbe={updateProbe}
          onReplace={() => setOperation({ kind: "replace", asset: selected })}
          probe={probes[selected.imageKey]}
        />
      )}

      {operation?.kind === "upload" && (
        <MediaUploadDialog
          locale={locale}
          mode="upload"
          onClose={() => setOperation(null)}
          onCompleted={completeMutation}
        />
      )}
      {operation?.kind === "replace" && (
        <MediaUploadDialog
          asset={operation.asset}
          locale={locale}
          mode="replace"
          onClose={() => setOperation(null)}
          onCompleted={completeMutation}
        />
      )}
      {operation?.kind === "delete" && operation.asset.managed && (
        <MediaDeleteDialog
          asset={operation.asset}
          locale={locale}
          managed={operation.asset.managed}
          onClose={() => setOperation(null)}
          onCompleted={completeMutation}
        />
      )}
    </section>
  );
}

function MediaStat({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: typeof ImageIcon;
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <article className={`media-stat is-${tone}`}>
      <span><Icon size={20} aria-hidden="true" /></span>
      <div><small>{label}</small><strong>{value}</strong><em>{detail}</em></div>
    </article>
  );
}

function MediaCard({
  asset,
  locale,
  probe,
  onProbe,
  onOpen,
}: {
  asset: ReferencedMediaAsset;
  locale: Locale;
  probe: ImageProbe | undefined;
  onProbe: (imageKey: string, probe: ImageProbe) => void;
  onOpen: () => void;
}) {
  const health = !asset.safeLocalPath
    ? "invalid"
    : asset.managed?.storageStatus === "MISSING"
      ? "error"
      : probe?.state === "error"
        ? "error"
        : probe?.state === "ready"
          ? "ready"
          : "checking";
  const healthLabel = health === "invalid"
    ? copy(locale, "路径无效", "Invalid path")
    : health === "error"
      ? copy(locale, "无法加载", "Load failed")
      : health === "ready"
        ? copy(locale, "当前可加载", "Loads now")
        : copy(locale, "正在校验", "Checking");

  return (
    <article className="media-card admin-panel">
      <div className="media-card-visual">
        {asset.safeLocalPath && asset.managed?.storageStatus !== "MISSING" ? (
          <img
            alt=""
            decoding="async"
            loading="lazy"
            onError={() => onProbe(asset.imageKey, { state: "error", width: null, height: null })}
            onLoad={(event) => onProbe(asset.imageKey, {
              state: "ready",
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })}
            src={asset.imageKey}
          />
        ) : (
          <span className="media-image-fallback"><WarningCircle size={28} aria-hidden="true" /></span>
        )}
        <span className={`media-probe is-${health}`}>{healthLabel}</span>
      </div>
      <div className="media-card-body">
        <div className="media-card-heading">
          <div>
            <strong title={asset.fileName}>{asset.fileName}</strong>
            <code title={asset.imageKey}>{asset.imageKey}</code>
          </div>
          <button
            className="media-detail-button"
            onClick={onOpen}
            type="button"
            aria-label={`${copy(locale, "查看图片详情", "View asset details")} ${asset.fileName}`}
          >
            <Eye size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="media-kind-tags">
          <span>{asset.managed ? copy(locale, "R2 上传", "R2 upload") : copy(locale, "打包静态图", "Bundled asset")}</span>
          {asset.kinds.map((item) => <span key={item}>{kindLabels[item][locale]}</span>)}
          {asset.managed && asset.references.length === 0 && (
            <span className="is-unreferenced">{copy(locale, "未引用", "Unreferenced")}</span>
          )}
        </div>
        <p>
          <strong>{asset.references.length}</strong>
          {copy(locale, " 条数据库引用", " database references")}
          {probe?.state === "ready" && probe.width && probe.height
            ? ` · ${probe.width} × ${probe.height}`
            : ""}
        </p>
      </div>
    </article>
  );
}

function MediaDetailDialog({
  asset,
  canDelete,
  canReplace,
  locale,
  probe,
  onProbe,
  onClose,
  onCopy,
  onDelete,
  onReplace,
}: {
  asset: ReferencedMediaAsset;
  canDelete: boolean;
  canReplace: boolean;
  locale: Locale;
  probe: ImageProbe | undefined;
  onProbe: (imageKey: string, probe: ImageProbe) => void;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onReplace: () => void;
}) {
  return (
    <Dialog
      closeLabel={copy(locale, "关闭图片详情", "Close asset details")}
      onClose={onClose}
      title={asset.fileName}
      wide
    >
      <div className="media-detail">
        <div className="media-detail-overview">
          <div className="media-detail-visual">
            {asset.safeLocalPath && asset.managed?.storageStatus !== "MISSING" ? (
              <img
                alt={asset.fileName}
                decoding="async"
                onError={() => onProbe(asset.imageKey, { state: "error", width: null, height: null })}
                onLoad={(event) => onProbe(asset.imageKey, {
                  state: "ready",
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })}
                src={asset.imageKey}
              />
            ) : (
              <span className="media-image-fallback"><WarningCircle size={34} aria-hidden="true" /></span>
            )}
          </div>
          <dl>
            <div><dt>{copy(locale, "公开路径", "Public path")}</dt><dd><code>{asset.imageKey}</code></dd></div>
            <div><dt>{copy(locale, "存储来源", "Storage source")}</dt><dd>{asset.managed ? "Sites R2" : copy(locale, "网站构建包", "Site bundle")}</dd></div>
            <div><dt>{copy(locale, "使用类型", "Usage types")}</dt><dd>{asset.kinds.length > 0 ? asset.kinds.map((item) => kindLabels[item][locale]).join(" / ") : copy(locale, "当前未引用", "Currently unreferenced")}</dd></div>
            <div><dt>{copy(locale, "引用数量", "Reference count")}</dt><dd>{asset.references.length}</dd></div>
            <div><dt>{copy(locale, "图片尺寸", "Image dimensions")}</dt><dd>{probe?.state === "ready" && probe.width && probe.height ? `${probe.width} × ${probe.height}` : copy(locale, "当前未验证", "Not verified")}</dd></div>
            <div><dt>{copy(locale, "文件大小", "File size")}</dt><dd>{asset.managed ? formatBytes(asset.managed.byteSize, locale) : copy(locale, "构建包未采集", "Not collected from bundle")}</dd></div>
            <div><dt>{copy(locale, "上传账号", "Uploaded by")}</dt><dd>{asset.managed?.uploadedByEmail ?? "—"}</dd></div>
            <div><dt>{copy(locale, "最近更新", "Latest update")}</dt><dd>{formatDate(asset.lastUpdatedAt, locale)}</dd></div>
          </dl>
        </div>

        <div className="media-detail-actions">
          <button className="admin-secondary" onClick={onCopy} type="button">
            <Copy size={17} aria-hidden="true" />
            {copy(locale, "复制公开路径", "Copy public path")}
          </button>
          {canReplace && (
            <button className="admin-primary" onClick={onReplace} type="button">
              <NotePencil size={17} aria-hidden="true" />
              {copy(locale, "替换全部引用", "Replace all references")}
            </button>
          )}
          {canDelete && (
            <button className="admin-danger" onClick={onDelete} type="button">
              <Trash size={17} aria-hidden="true" />
              {copy(locale, "删除未引用文件", "Delete unreferenced file")}
            </button>
          )}
        </div>

        <div className="media-detail-boundary" role="note">
          <WarningCircle size={18} aria-hidden="true" />
          {asset.managed
            ? copy(
                locale,
                "替换会上传唯一的新地址并迁移当前商品与轮播引用，旧文件不会自动删除。只有引用数量为 0 的 R2 文件才能在二次确认后删除。",
                "Replacement uploads a unique new URL and migrates current product and hero references. The old file is retained, and only R2 files with zero references can be deleted after confirmation.",
              )
            : copy(
                locale,
                "打包静态图片不能从后台删除；可以上传新图片并迁移全部数据库引用，原构建文件仍保留在当前网站版本中。",
                "Bundled static images cannot be deleted from the admin. You can upload a new image and migrate all database references while the original build file remains in this site version.",
              )}
        </div>

        <div className="media-reference-scroll">
          <table className="media-reference-table">
            <thead>
              <tr>
                <th>{copy(locale, "来源", "Source")}</th>
                <th>{copy(locale, "记录标识", "Record key")}</th>
                <th>{copy(locale, "名称", "Name")}</th>
                <th>{copy(locale, "状态", "Status")}</th>
                <th>{copy(locale, "更新时间", "Updated")}</th>
              </tr>
            </thead>
            <tbody>
              {asset.references.length === 0 ? (
                <tr><td colSpan={5}>{copy(locale, "当前没有数据库引用，可以安全删除这个 R2 文件。", "There are no database references, so this R2 file may be safely deleted.")}</td></tr>
              ) : asset.references.map((reference) => (
                <tr key={`${reference.kind}:${reference.id}`}>
                  <td>{kindLabels[reference.kind][locale]}</td>
                  <td><code>{reference.recordKey}</code></td>
                  <td title={reference.label[locale]}>{reference.label[locale]}</td>
                  <td><StatusPill status={reference.status} locale={locale} /></td>
                  <td><time dateTime={reference.updatedAt}>{formatDate(reference.updatedAt, locale)}</time></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>
  );
}

function MediaUploadDialog({
  asset,
  locale,
  mode,
  onClose,
  onCompleted,
}: {
  asset?: ReferencedMediaAsset;
  locale: Locale;
  mode: "upload" | "replace";
  onClose: () => void;
  onCompleted: () => void;
}) {
  const { notify } = useAdminStatus();
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!file) {
      setError(copy(locale, "请选择 PNG、JPEG 或 WebP 图片。", "Choose a PNG, JPEG, or WebP image."));
      return;
    }
    if (file.size < 1 || file.size > 5_000_000) {
      setError(copy(locale, "图片必须小于或等于 5 MB。", "The image must be 5 MB or smaller."));
      return;
    }
    if (reason.trim().length < 8 || reason.trim().length > 500) {
      setError(copy(locale, "请填写 8–500 个字符的操作原因。", "Enter an operation reason between 8 and 500 characters."));
      return;
    }
    if (mode === "replace" && !confirmed) {
      setError(copy(locale, "请确认本次操作会迁移当前全部引用。", "Confirm that this operation migrates all current references."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "replace" && asset) {
        const result = await replaceManagedMedia(asset.imageKey, file, reason.trim());
        notify(copy(
          locale,
          `已迁移 ${result.replacedReferences.products + result.replacedReferences.heroes} 条图片引用，旧文件仍保留。`,
          `${result.replacedReferences.products + result.replacedReferences.heroes} image references migrated; the old file was retained.`,
        ));
      } else {
        await uploadManagedMedia(file, reason.trim());
        notify(copy(locale, "图片已上传到 Sites R2。", "Image uploaded to Sites R2."));
      }
      onCompleted();
    } catch (requestError) {
      setError(mediaError(requestError, locale));
      setBusy(false);
    }
  };

  return (
    <Dialog
      closeLabel={copy(locale, "关闭图片操作", "Close media operation")}
      onClose={busy ? () => undefined : onClose}
      title={mode === "replace"
        ? copy(locale, "替换全部图片引用", "Replace all image references")
        : copy(locale, "上传图片", "Upload image")}
      wide
    >
      <form className="media-operation-form" onSubmit={(event) => void submit(event)}>
        {mode === "replace" && asset && (
          <div className="media-operation-impact" role="note">
            <WarningCircle size={18} aria-hidden="true" />
            <span>
              <strong>{asset.fileName}</strong>
              {copy(
                locale,
                `当前 ${asset.references.length} 条数据库引用将迁移到新地址。旧文件不会自动删除。`,
                `${asset.references.length} current database references will move to a new URL. The old file will not be deleted automatically.`,
              )}
            </span>
          </div>
        )}
        <div className="media-upload-layout">
          <label className="media-file-picker">
            <span>{copy(locale, "图片文件", "Image file")}</span>
            <input
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setError("");
              }}
              required
              type="file"
            />
            <small>{copy(locale, "仅 PNG、JPEG、WebP；最大 5 MB。", "PNG, JPEG, or WebP only; maximum 5 MB.")}</small>
          </label>
          <div className="media-upload-preview">
            {previewUrl
              ? <img alt={copy(locale, "待上传图片预览", "Image upload preview")} src={previewUrl} />
              : <span><UploadSimple size={30} aria-hidden="true" />{copy(locale, "选择图片后显示预览", "Preview appears after choosing an image")}</span>}
          </div>
        </div>
        {file && (
          <p className="media-selected-file">
            <strong>{file.name}</strong>
            <span>{formatBytes(file.size, locale)} · {file.type || "—"}</span>
          </p>
        )}
        <label className="media-reason-field">
          <span>{copy(locale, "操作原因", "Operation reason")}</span>
          <textarea
            disabled={busy}
            maxLength={500}
            minLength={8}
            onChange={(event) => setReason(event.target.value)}
            placeholder={copy(locale, "例如：更新首页主视觉并保留审计记录", "Example: Refresh the homepage hero with an audited change")}
            required
            rows={3}
            value={reason}
          />
          <small>{reason.trim().length}/500</small>
        </label>
        {mode === "replace" && (
          <label className="media-confirm-check">
            <input
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
              type="checkbox"
            />
            <span>{copy(locale, "我确认迁移当前全部商品和轮播引用，并了解旧文件仍会保留。", "I confirm migration of all current product and hero references and understand that the old file is retained.")}</span>
          </label>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="admin-secondary" disabled={busy} onClick={onClose} type="button">
            {copy(locale, "取消", "Cancel")}
          </button>
          <button className="admin-primary" disabled={busy} type="submit">
            <UploadSimple size={17} aria-hidden="true" />
            {busy
              ? copy(locale, "正在处理…", "Processing…")
              : mode === "replace"
                ? copy(locale, "上传并迁移引用", "Upload and migrate")
                : copy(locale, "上传到 R2", "Upload to R2")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function MediaDeleteDialog({
  asset,
  locale,
  managed,
  onClose,
  onCompleted,
}: {
  asset: ReferencedMediaAsset;
  locale: Locale;
  managed: AdminManagedMediaObject;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const { notify } = useAdminStatus();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (asset.references.length > 0) {
      setError(copy(locale, "图片仍有数据库引用，不能删除。", "This image still has database references and cannot be deleted."));
      return;
    }
    if (reason.trim().length < 8 || reason.trim().length > 500 || !confirmed) {
      setError(copy(locale, "请填写操作原因并确认永久删除。", "Enter an operation reason and confirm permanent deletion."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await deleteManagedMedia(managed.key, reason.trim());
      notify(copy(locale, "未引用的 R2 图片已删除。", "The unreferenced R2 image was deleted."));
      onCompleted();
    } catch (requestError) {
      setError(mediaError(requestError, locale));
      setBusy(false);
    }
  };

  return (
    <Dialog
      closeLabel={copy(locale, "关闭删除确认", "Close delete confirmation")}
      onClose={busy ? () => undefined : onClose}
      title={copy(locale, "删除未引用文件", "Delete unreferenced file")}
    >
      <form className="media-operation-form" onSubmit={(event) => void submit(event)}>
        <div className="media-delete-warning" role="alert">
          <Trash size={20} aria-hidden="true" />
          <span>
            <strong>{asset.fileName}</strong>
            {copy(
              locale,
              "服务器会在删除前再次确认引用数量为 0。删除后 R2 文件无法从网站后台恢复。",
              "The server will recheck that the reference count is zero. After deletion, the R2 object cannot be restored from the site admin.",
            )}
          </span>
        </div>
        <label className="media-reason-field">
          <span>{copy(locale, "删除原因", "Deletion reason")}</span>
          <textarea
            disabled={busy}
            maxLength={500}
            minLength={8}
            onChange={(event) => setReason(event.target.value)}
            required
            rows={3}
            value={reason}
          />
          <small>{reason.trim().length}/500</small>
        </label>
        <label className="media-confirm-check">
          <input
            checked={confirmed}
            disabled={busy}
            onChange={(event) => setConfirmed(event.target.checked)}
            type="checkbox"
          />
          <span>{copy(locale, "我确认这个 R2 文件当前未被引用，并同意永久删除。", "I confirm that this R2 file is unreferenced and agree to permanent deletion.")}</span>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="admin-secondary" disabled={busy} onClick={onClose} type="button">
            {copy(locale, "取消", "Cancel")}
          </button>
          <button className="admin-danger" disabled={busy} type="submit">
            <Trash size={17} aria-hidden="true" />
            {busy ? copy(locale, "正在删除…", "Deleting…") : copy(locale, "永久删除", "Delete permanently")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function mediaError(error: unknown, locale: Locale): string {
  if (error instanceof ApiError) {
    if (error.code === "MEDIA_FILE_TOO_LARGE") {
      return copy(locale, "图片不能超过 5 MB。", "The image cannot exceed 5 MB.");
    }
    if (error.code === "MEDIA_FILE_TYPE_INVALID") {
      return copy(locale, "文件内容不是有效的 PNG、JPEG 或 WebP 图片。", "The file content is not a valid PNG, JPEG, or WebP image.");
    }
    if (error.code === "MEDIA_OBJECT_IN_USE") {
      return copy(locale, "图片重新出现了数据库引用，请刷新后先替换引用。", "The image is referenced again. Refresh and replace its references first.");
    }
    if (error.status === 403) {
      return copy(locale, "当前账号没有执行这项媒体操作的权限。", "This account cannot perform this media operation.");
    }
    if (error.status === 409) {
      return copy(locale, "媒体状态已经变化，请刷新后重试。", "The media state changed. Refresh and try again.");
    }
  }
  return copy(locale, "媒体操作没有完成，请重试。", "The media operation did not complete. Try again.");
}

function formatBytes(value: number, locale: Locale): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  const numberLocale = locale === "zh" ? "zh-CN" : "en-US";
  if (value < 1_000) return `${new Intl.NumberFormat(numberLocale).format(value)} B`;
  if (value < 1_000_000) {
    return `${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(value / 1_000)} KB`;
  }
  return `${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 2 }).format(value / 1_000_000)} MB`;
}
