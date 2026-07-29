import type { AdminHero } from "@cloudbridge/contracts";
import {
  ArrowsClockwise,
  Eye,
  Image as ImageIcon,
  MagnifyingGlass,
  Package,
  PresentationChart,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  getAllProducts,
  type AdminProduct,
  type Locale,
} from "../../api";
import {
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
  summarizeReferencedMediaAssets,
  type MediaReferenceKind,
  type ReferencedMediaAsset,
} from "./model";

type MediaResourceData = {
  products: AdminProduct[];
  heroes: AdminHero[];
};

type ImageProbe = {
  state: "ready" | "error";
  width: number | null;
  height: number | null;
};

const copy = (locale: Locale, zh: string, en: string): string =>
  locale === "zh" ? zh : en;

const kindLabels: Record<MediaReferenceKind, Record<Locale, string>> = {
  hero: { zh: "首页轮播", en: "Hero" },
  product: { zh: "商品图片", en: "Product" },
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
  const loader = useCallback(async (signal: AbortSignal): Promise<MediaResourceData> => {
    const [products, heroes] = await Promise.all([
      canReadCatalog ? getAllProducts(signal) : Promise.resolve([]),
      canReadContent ? getHeroes(signal) : Promise.resolve([]),
    ]);
    return { products, heroes };
  }, [canReadCatalog, canReadContent]);
  const resource = useCachedAdminResource<MediaResourceData>(
    `media-references:${canReadCatalog ? "catalog" : "none"}:${canReadContent ? "content" : "none"}`,
    loader,
  );
  const slow = useSlowAdminRequest(resource.state);
  const [kind, setKind] = useState<"all" | MediaReferenceKind>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReferencedMediaAsset | null>(null);
  const [probes, setProbes] = useState<Record<string, ImageProbe>>({});

  const assets = useMemo(
    () => buildReferencedMediaAssets(
      resource.data?.products ?? [],
      resource.data?.heroes ?? [],
    ),
    [resource.data],
  );
  const filtered = useMemo(
    () => filterReferencedMediaAssets(assets, { kind, query }),
    [assets, kind, query],
  );
  const summary = useMemo(() => summarizeReferencedMediaAssets(assets), [assets]);
  const loadFailures = assets.filter((asset) => probes[asset.imageKey]?.state === "error").length;
  const issues = summary.invalidPaths + loadFailures;
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

  return (
    <section className="media-page">
      <div className="media-truth-note" role="note">
        <ImageIcon size={20} aria-hidden="true" />
        <span>
          <strong>{copy(locale, "真实引用清单", "Live reference inventory")}</strong>
          {copy(
            locale,
            "本页只聚合当前账号有权读取的平台数据库商品与首页轮播图片引用，并在浏览器校验图片能否加载；它不是磁盘或对象存储的完整扫描。",
            "This page aggregates only the platform-database product and hero image references this account may read, then checks browser loading. It is not a complete disk or object-storage scan.",
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
              label={copy(locale, "引用中的图片", "Referenced assets")}
              value={String(summary.uniqueAssets)}
              detail={copy(locale, "按路径去重", "Unique by path")}
            />
            <MediaStat
              icon={Package}
              label={copy(locale, "商品引用", "Product references")}
              value={String(summary.productReferences)}
              detail={canReadCatalog ? copy(locale, "来自平台数据库商品", "From platform database products") : copy(locale, "无读取权限", "Not permitted")}
            />
            <MediaStat
              icon={PresentationChart}
              label={copy(locale, "轮播引用", "Hero references")}
              value={String(summary.heroReferences)}
              detail={canReadContent ? copy(locale, "来自平台数据库轮播", "From platform database heroes") : copy(locale, "无读取权限", "Not permitted")}
            />
            <MediaStat
              icon={issues > 0 ? WarningCircle : Eye}
              label={copy(locale, "加载或路径问题", "Load or path issues")}
              value={String(issues)}
              detail={copy(locale, "仅当前浏览器验证", "Current browser check only")}
              tone={issues > 0 ? "warning" : "success"}
            />
          </div>

          <div className="media-toolbar">
            <div className="media-kind-filter" role="group" aria-label={copy(locale, "媒体类型", "Media type")}>
              {(["all", "hero", "product"] as const).map((item) => (
                <button
                  className={kind === item ? "is-active" : ""}
                  key={item}
                  onClick={() => setKind(item)}
                  type="button"
                >
                  {item === "all" ? copy(locale, "全部", "All") : kindLabels[item][locale]}
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
            <button className="admin-secondary media-refresh" onClick={retry} type="button">
              <ArrowsClockwise size={17} aria-hidden="true" />
              {copy(locale, "刷新引用", "Refresh")}
            </button>
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
              <strong>{copy(locale, "目前没有已引用图片", "No referenced images")}</strong>
              <p>{copy(locale, "商品或首页轮播保存图片路径后会出现在这里。", "Assets appear here after a product or hero saves an image path.")}</p>
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

      {selected && (
        <MediaDetailDialog
          asset={selected}
          locale={locale}
          onClose={() => setSelected(null)}
          onProbe={updateProbe}
          probe={probes[selected.imageKey]}
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
        {asset.safeLocalPath ? (
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
            aria-label={`${copy(locale, "查看图片引用", "View asset references")} ${asset.fileName}`}
          >
            <Eye size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="media-kind-tags">
          {asset.kinds.map((item) => <span key={item}>{kindLabels[item][locale]}</span>)}
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
  locale,
  probe,
  onProbe,
  onClose,
}: {
  asset: ReferencedMediaAsset;
  locale: Locale;
  probe: ImageProbe | undefined;
  onProbe: (imageKey: string, probe: ImageProbe) => void;
  onClose: () => void;
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
            {asset.safeLocalPath ? (
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
            <div><dt>{copy(locale, "使用类型", "Usage types")}</dt><dd>{asset.kinds.map((item) => kindLabels[item][locale]).join(" / ")}</dd></div>
            <div><dt>{copy(locale, "引用数量", "Reference count")}</dt><dd>{asset.references.length}</dd></div>
            <div><dt>{copy(locale, "图片尺寸", "Image dimensions")}</dt><dd>{probe?.state === "ready" && probe.width && probe.height ? `${probe.width} × ${probe.height}` : copy(locale, "当前未验证", "Not verified")}</dd></div>
            <div><dt>{copy(locale, "最近引用更新", "Latest reference update")}</dt><dd>{formatDate(asset.lastUpdatedAt, locale)}</dd></div>
          </dl>
        </div>

        <div className="media-detail-boundary" role="note">
          <WarningCircle size={18} aria-hidden="true" />
          {copy(
            locale,
            "这里显示数据库引用和当前浏览器加载结果，不读取文件字节、未引用文件、对象存储状态，也不会上传、替换或删除图片。",
            "This shows database references and the current browser load result. It does not inspect file bytes, unreferenced files, or object-storage state, and it cannot upload, replace, or delete assets.",
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
              {asset.references.map((reference) => (
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
