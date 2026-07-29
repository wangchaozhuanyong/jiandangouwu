import {
  ArrowsClockwise,
  CaretLeft,
  CaretRight,
  Eye,
  Info,
  MagnifyingGlass,
  NotePencil,
  Plus,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createProduct,
  getCategories,
  getProducts,
  updateProduct,
  type AdminCategory,
  type AdminProduct,
  type AdminProductPage,
  type AdminProductQuery,
  type Locale,
} from "../api";
import {
  invalidateAdminCache,
  invalidateAdminCacheByPrefix,
  useAdminStatus,
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../admin-experience";
import {
  Dialog,
  formatDate,
  PanelState,
  RefreshNotice,
  StatusPill,
  statusLabels,
  useUnsavedChanges,
} from "../admin-ui";
import {
  adminProductQuerySearch,
  buildProductImpact,
  defaultAdminProductQuery,
  productFilterFromQuery,
  productQueryFromFilter,
  readAdminProductQuery,
  STOREFRONT_LOW_STOCK_MAX,
  type ProductCategoryState,
  type ProductImpactSignal,
  type ProductQueryFilter,
} from "../features/products/model";
import { adminCopy } from "../i18n";

type ProductDraft = {
  slug: string;
  categoryId: string;
  imageKey: string;
  basePrice: string;
  compareAtPrice: string;
  stockMode: "FINITE" | "UNLIMITED";
  stockQuantity: number;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
  sortOrder: number;
  nameZh: string;
  nameEn: string;
  kickerZh: string;
  kickerEn: string;
  descriptionZh: string;
  descriptionEn: string;
};

const emptyProduct: ProductDraft = {
  slug: "",
  categoryId: "",
  imageKey: "/assets/product-codex.webp",
  basePrice: "0.00",
  compareAtPrice: "",
  stockMode: "FINITE",
  stockQuantity: 0,
  status: "DRAFT",
  sortOrder: 1,
  nameZh: "",
  nameEn: "",
  kickerZh: "",
  kickerEn: "",
  descriptionZh: "",
  descriptionEn: "",
};

const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

const productImpactSignalCopy: Record<ProductImpactSignal, Record<Locale, string>> = {
  MISSING_TRANSLATION: { zh: "双语内容缺失", en: "Missing bilingual content" },
  STOCK_DATA_CONFLICT: { zh: "库存数据冲突", en: "Stock data conflict" },
  CATEGORY_NOT_LOADED: { zh: "分类未在列表中", en: "Category not in loaded list" },
  CATEGORY_NOT_ACTIVE: { zh: "分类未启用", en: "Category is not active" },
  ACTIVE_SOLD_OUT: { zh: "在售但已售罄", en: "Active and sold out" },
  ACTIVE_LOW_STOCK: { zh: "前台低库存提示", en: "Storefront low-stock label" },
  ORDER_REPEATED: { zh: "在售顺序值重复", en: "Repeated active order" },
  CLEAR: { zh: "当前无提示", en: "No current signal" },
};

const categoryStateCopy: Record<
  Exclude<ProductCategoryState, AdminCategory["status"]>,
  Record<Locale, string>
> = {
  NOT_LOADED: { zh: "未在已加载列表中", en: "Not in loaded list" },
  NOT_CHECKED: { zh: "未交叉检查", en: "Not cross-checked" },
};

export default function ProductsPage({
  canWrite,
  locale,
}: {
  canWrite: boolean;
  locale: Locale;
}) {
  const t = adminCopy[locale];
  const [query, setQuery] = useState(() => readAdminProductQuery(window.location.search));
  const [filter, setFilter] = useState<ProductQueryFilter>(
    () => productFilterFromQuery(query),
  );
  const [editing, setEditing] = useState<AdminProduct | "new" | null>(null);
  const [impactOpen, setImpactOpen] = useState(false);
  const querySearch = useMemo(() => adminProductQuerySearch(query), [query]);
  const productLoader = useCallback(async (signal: AbortSignal) => ({
    ...await getProducts(query, signal),
    querySearch,
  }), [query, querySearch]);
  const categoryLoader = useCallback((signal: AbortSignal) => getCategories(signal), []);
  const productsResource = useCachedAdminResource<AdminProductPage & { querySearch: string }>(
    `products:page:${querySearch || "default"}`,
    productLoader,
  );
  const categoriesResource = useCachedAdminResource<AdminCategory[]>("categories", categoryLoader);
  const slow = useSlowAdminRequest(productsResource.state);
  const page = productsResource.data?.querySearch === querySearch
    ? productsResource.data
    : null;
  const products = page?.data ?? null;
  const categories = categoriesResource.data ?? [];
  const listBusy = productsResource.state === "initial-loading"
    || productsResource.state === "refreshing";
  const pageCount = page?.meta.pageCount ?? 0;

  useEffect(() => {
    const onPopState = () => {
      const next = readAdminProductQuery(window.location.search);
      setQuery(next);
      setFilter(productFilterFromQuery(next));
      setImpactOpen(false);
      setEditing(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const updateQuery = useCallback((
    next: AdminProductQuery,
    historyMode: "push" | "replace" = "push",
  ) => {
    const search = adminProductQuerySearch(next);
    const url = `${window.location.pathname}${search ? `?${search}` : ""}`;
    window.history[historyMode === "push" ? "pushState" : "replaceState"](
      {
        ...(window.history.state ?? {}),
        page: "products",
      },
      "",
      url,
    );
    setQuery(next);
    setImpactOpen(false);
    setEditing(null);
  }, []);

  useEffect(() => {
    if (!page || listBusy || page.meta.page !== query.page) return;
    const lastAvailablePage = Math.max(1, page.meta.pageCount);
    if (query.page > lastAvailablePage) {
      updateQuery({ ...query, page: lastAvailablePage }, "replace");
    }
  }, [listBusy, page, query, updateQuery]);

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    updateQuery(productQueryFromFilter(filter));
  };

  const resetFilters = () => {
    const next = { ...defaultAdminProductQuery };
    setFilter(productFilterFromQuery(next));
    updateQuery(next);
  };

  return (
    <section className="admin-panel">
      <div className="panel-heading is-action-only">
        <button
          className="admin-secondary"
          disabled={!page}
          onClick={() => setImpactOpen(true)}
          type="button"
        >
          <Eye />{copy(locale, "库存与上架概览", "Inventory and availability overview")}
        </button>
        {canWrite && (
          <button
            className="admin-primary"
            disabled={!categories.length}
            onClick={() => setEditing("new")}
            type="button"
          >
            <Plus />{t.addProduct as string}
          </button>
        )}
      </div>
      {!canWrite && (
        <p className="product-readonly-note" role="note">
          <Info aria-hidden="true" size={18} />
          {copy(
            locale,
            "当前账号只有 catalog.read；可以查看真实商品、搜索结果和库存影响概览，但新增和编辑要求 catalog.write。",
            "This account has catalog.read only. Live products, search results, and inventory impact are visible, while create and edit require catalog.write.",
          )}
        </p>
      )}
      {page && (
        <div className="product-admin-truth-note" role="note">
          <Info aria-hidden="true" size={18} />
          <span>
            <strong>{copy(locale, "完整目录服务端分页", "Full catalog server pagination")}</strong>
            {copy(
              locale,
              `当前筛选共 ${page.meta.total} 条，第 ${page.meta.page} 页加载 ${page.data.length} 条。未选择状态时不显示已归档商品；选择“已归档”可单独查看。筛选与分页在服务器执行。`,
              `The current server-side filter matches ${page.meta.total} products; page ${page.meta.page} loads ${page.data.length}. Archived products are hidden when no status is selected and remain available through the Archived filter.`,
            )}
          </span>
        </div>
      )}
      <form className="product-admin-filters" onSubmit={applyFilters}>
        <label className="product-admin-search">
          <span>{copy(locale, "商品搜索", "Product search")}</span>
          <MagnifyingGlass aria-hidden="true" />
          <input
            value={filter.search}
            maxLength={160}
            onChange={(event) => setFilter((current) => ({
              ...current,
              search: event.target.value,
            }))}
            placeholder={copy(
              locale,
              "搜索中文名、英文名或 slug",
              "Search Chinese name, English name, or slug",
            )}
          />
        </label>
        <label>
          <span>{copy(locale, "商品状态", "Product status")}</span>
          <select
            value={filter.status}
            onChange={(event) => setFilter((current) => ({
              ...current,
              status: event.target.value as ProductQueryFilter["status"],
            }))}
          >
            <option value="all">{copy(locale, "全部非归档状态", "All non-archived statuses")}</option>
            {(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const).map((status) => (
              <option value={status} key={status}>
                {statusLabels[status]?.[locale] ?? status}
              </option>
            ))}
          </select>
        </label>
        <div className="product-admin-filter-actions">
          <button
            className="admin-secondary"
            disabled={
              adminProductQuerySearch(productQueryFromFilter(filter)) === ""
              && querySearch === ""
            }
            onClick={resetFilters}
            type="button"
          >
            {copy(locale, "重置筛选", "Reset filters")}
          </button>
          <button className="admin-primary" disabled={listBusy} type="submit">
            {copy(locale, "应用筛选", "Apply filters")}
          </button>
          <button
            className="admin-secondary"
            onClick={() => void productsResource.reload()}
            type="button"
          >
            <ArrowsClockwise
              aria-hidden="true"
              className={productsResource.state === "refreshing" ? "spin" : ""}
            />
            {copy(locale, "刷新目录", "Refresh catalog")}
          </button>
        </div>
      </form>
      <RefreshNotice state={productsResource.state} locale={locale} retry={() => void productsResource.reload()} slow={slow} />
      {!page ? (
        <PanelState
          state={productsResource.state === "refreshing"
            ? "initial-loading"
            : productsResource.state}
          locale={locale}
          retry={() => void productsResource.reload()}
          kind="cards"
        />
      ) : (
        <>
          <div className="product-admin-list-meta">
            <span>{copy(
              locale,
              `第 ${page.meta.page} / ${Math.max(1, page.meta.pageCount)} 页 · 本页 ${products?.length ?? 0} 条`,
              `Page ${page.meta.page} of ${Math.max(1, page.meta.pageCount)} · ${products?.length ?? 0} on this page`,
            )}</span>
          </div>
          <div className="product-admin-grid" aria-busy={productsResource.state === "refreshing"}>
            {products?.length === 0 && (
              <div className="table-empty" role="status">
                {copy(
                  locale,
                  "没有符合当前筛选的真实商品。",
                  "No live products match the current filters.",
                )}
              </div>
            )}
            {products?.map((item) => (
              <article key={item.id}>
                <img
                  src={item.imageKey}
                  alt={item.translations[locale]?.name || item.slug}
                  width={86}
                  height={96}
                  loading="lazy"
                  decoding="async"
                />
                <div className="product-admin-copy">
                  <p>{item.category.name[locale] || item.category.slug}</p>
                  <h3 title={item.translations[locale]?.name}>{item.translations[locale]?.name || "—"}</h3>
                  <div><strong>MYR {item.basePrice}</strong><StatusPill status={item.status} locale={locale} /></div>
                  <small>{item.stockMode === "UNLIMITED" ? (locale === "zh" ? "不限库存" : "Unlimited") : `${t.stock as string} ${item.stockQuantity ?? 0}`}</small>
                </div>
                {canWrite && (
                  <button
                    onClick={() => setEditing(item)}
                    aria-label={`${t.edit as string} ${item.translations[locale]?.name || item.slug}`}
                    type="button"
                  >
                    <NotePencil />
                  </button>
                )}
              </article>
            ))}
          </div>
          <nav
            className="product-admin-pagination"
            aria-label={copy(locale, "商品目录分页", "Product catalog pagination")}
          >
            <button
              className="admin-secondary"
              disabled={query.page <= 1 || listBusy}
              onClick={() => updateQuery({ ...query, page: Math.max(1, query.page - 1) })}
              type="button"
            >
              <CaretLeft aria-hidden="true" />{copy(locale, "上一页", "Previous")}
            </button>
            <button
              className="admin-secondary"
              disabled={query.page >= pageCount || listBusy}
              onClick={() => updateQuery({ ...query, page: query.page + 1 })}
              type="button"
            >
              {copy(locale, "下一页", "Next")}<CaretRight aria-hidden="true" />
            </button>
          </nav>
        </>
      )}
      {canWrite && editing && (
        <ProductDialog
          locale={locale}
          item={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void productsResource.reload();
          }}
        />
      )}
      {impactOpen && page && (
        <ProductImpactDialog
          categories={categoriesResource.data ?? null}
          locale={locale}
          products={page.data}
          query={query}
          meta={page.meta}
          onClose={() => setImpactOpen(false)}
        />
      )}
    </section>
  );
}

function ProductImpactDialog({
  categories,
  locale,
  meta,
  products,
  query,
  onClose,
}: {
  categories: AdminCategory[] | null;
  locale: Locale;
  meta: AdminProductPage["meta"];
  products: AdminProduct[];
  query: AdminProductQuery;
  onClose: () => void;
}) {
  const t = adminCopy[locale];
  const impact = useMemo(
    () => buildProductImpact(products, categories),
    [categories, products],
  );
  const activeFilter = [
    query.search
      ? copy(locale, `关键词“${query.search}”`, `keyword “${query.search}”`)
      : null,
    query.status
      ? copy(
          locale,
          `状态“${statusLabels[query.status]?.zh ?? query.status}”`,
          `status “${statusLabels[query.status]?.en ?? query.status}”`,
        )
      : copy(locale, "全部非归档状态", "all non-archived statuses"),
  ].filter(Boolean).join(copy(locale, "、", ", "));
  const summary = [
    [
      copy(locale, "已加载商品", "Loaded products"),
      impact.loadedProductCount,
      copy(
        locale,
        `筛选总数 ${meta.total} · 第 ${meta.page} 页`,
        `${meta.total} filter matches · page ${meta.page}`,
      ),
    ],
    [
      copy(locale, "在售 / 非在售", "Active / non-active"),
      `${impact.activeProductCount} / ${impact.nonActiveProductCount}`,
      copy(locale, "公开列表只读取在售商品", "The public list reads active products only"),
    ],
    [
      copy(locale, "有限 / 不限库存", "Finite / unlimited"),
      `${impact.finiteStockCount} / ${impact.unlimitedStockCount}`,
      copy(locale, "只显示当前库存快照", "Current stock snapshot only"),
    ],
    [
      copy(locale, "当前提示", "Current signals"),
      impact.needsReviewCount,
      copy(
        locale,
        `售罄 ${impact.activeSoldOutCount} · 低库存 ${impact.activeLowStockCount}`,
        `${impact.activeSoldOutCount} sold out · ${impact.activeLowStockCount} low-stock labels`,
      ),
    ],
  ] as const;

  return (
    <Dialog
      closeLabel={t.close as string}
      onClose={onClose}
      title={copy(locale, "商品库存与上架概览", "Product inventory and availability overview")}
      wide
    >
      <div className="product-impact-dialog">
        <div className="product-impact-summary">
          {summary.map(([label, value, note]) => (
            <article key={label}>
              <small>{label}</small>
              <strong>{value}</strong>
              <span>{note}</span>
            </article>
          ))}
        </div>
        <p className="product-impact-truth-note">
          <Info aria-hidden="true" size={18} />
          <span>
            {copy(
              locale,
              `本概览只统计当前服务器筛选（${activeFilter}）第 ${meta.page} 页的 ${products.length} 条记录；该筛选共 ${meta.total} 条、每页最多 ${meta.pageSize} 条${impact.categoryCrossCheckAvailable ? "，并与单独加载的非归档分类列表交叉检查；两次读取不是同一事务快照" : "；分类列表未成功加载，因此没有推断分类状态"}。公开列表只接收 ACTIVE 商品；分类未启用时会退出分类筛选导航，但其中的 ACTIVE 商品仍可出现在“全部”列表。前台现有规则把有限库存 0 显示为售罄、1–${STOREFRONT_LOW_STOCK_MAX} 显示低库存。本页不提供全库聚合、库存流水、预留返库、阈值配置、告警或发布记录。`,
              `This overview summarizes ${products.length} records on page ${meta.page} of the current server filter (${activeFilter}); ${meta.total} products match and each page contains at most ${meta.pageSize}${impact.categoryCrossCheckAvailable ? ". It cross-checks a separately loaded non-archived category list, so the two reads are not one transactional snapshot" : ". The category list did not load, so category state was not inferred"}. The public list accepts ACTIVE products only. A non-active category leaves category filter navigation, while its ACTIVE products may still appear under All. Existing storefront rules show finite stock 0 as sold out and 1–${STOREFRONT_LOW_STOCK_MAX} as low stock. This page does not provide full-catalog aggregation, stock history, reservation release, threshold configuration, alerts, or publishing records.`,
            )}
          </span>
        </p>
        <div
          aria-label={copy(locale, "商品影响表，可横向滚动", "Product impact table, horizontally scrollable")}
          className="product-impact-table-wrap"
          tabIndex={0}
        >
          <table className="product-impact-table">
            <thead>
              <tr>
                <th scope="col">{t.order as string}</th>
                <th scope="col">{copy(locale, "中文名称", "Chinese name")}</th>
                <th scope="col">{copy(locale, "英文名称", "English name")}</th>
                <th scope="col">{t.slug as string}</th>
                <th scope="col">{t.category as string}</th>
                <th scope="col">{copy(locale, "商品状态", "Product status")}</th>
                <th scope="col">{copy(locale, "分类状态", "Category state")}</th>
                <th scope="col">{copy(locale, "库存模式", "Stock mode")}</th>
                <th scope="col">{t.stock as string}</th>
                <th scope="col">{t.price as string} MYR</th>
                <th scope="col">{copy(locale, "更新时间", "Updated")}</th>
                <th scope="col">{copy(locale, "影响提示", "Impact signal")}</th>
              </tr>
            </thead>
            <tbody>
              {impact.rows.map((product) => (
                <tr key={product.id}>
                  <td><code>{String(product.sortOrder).padStart(2, "0")}</code></td>
                  <td title={product.translations.zh?.name}>{product.translations.zh?.name || "—"}</td>
                  <td title={product.translations.en?.name}>{product.translations.en?.name || "—"}</td>
                  <td><code>{product.slug}</code></td>
                  <td title={product.category.name[locale]}>{product.category.name[locale] || product.category.slug}</td>
                  <td><StatusPill locale={locale} status={product.status} /></td>
                  <td>
                    {product.categoryState === "NOT_LOADED" || product.categoryState === "NOT_CHECKED"
                      ? categoryStateCopy[product.categoryState][locale]
                      : <StatusPill locale={locale} status={product.categoryState} />}
                  </td>
                  <td>{copy(
                    locale,
                    product.stockMode === "FINITE" ? "有限" : "不限",
                    product.stockMode === "FINITE" ? "Finite" : "Unlimited",
                  )}</td>
                  <td>{product.stockQuantity ?? "—"}</td>
                  <td><code>{product.basePrice}</code></td>
                  <td><time dateTime={product.updatedAt}>{formatDate(product.updatedAt, locale)}</time></td>
                  <td>
                    <span className={`product-impact-signal is-${product.signal.toLocaleLowerCase()}`}>
                      {productImpactSignalCopy[product.signal][locale]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {impact.rows.length === 0 && (
            <div className="table-empty" role="status">{t.empty as string}</div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function ProductDialog({
  locale,
  item,
  categories,
  onClose,
  onSaved,
}: {
  locale: Locale;
  item: AdminProduct | "new";
  categories: AdminCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = adminCopy[locale];
  const { notify } = useAdminStatus();
  const source = useMemo<ProductDraft>(() => item === "new" ? {
    ...emptyProduct,
    categoryId: categories[0]?.id ?? "",
  } : {
    slug: item.slug,
    categoryId: item.category.id,
    imageKey: item.imageKey,
    basePrice: item.basePrice,
    compareAtPrice: item.compareAtPrice ?? "",
    stockMode: item.stockMode,
    stockQuantity: item.stockQuantity ?? 0,
    status: item.status,
    sortOrder: item.sortOrder,
    nameZh: item.translations.zh.name,
    nameEn: item.translations.en.name,
    kickerZh: item.translations.zh.kicker,
    kickerEn: item.translations.en.kicker,
    descriptionZh: item.translations.zh.description,
    descriptionEn: item.translations.en.description,
  }, [categories, item]);
  const [form, setForm] = useState(source);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(source);
  useUnsavedChanges(dirty);
  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => setForm((current) => ({ ...current, [key]: value }));

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm(t.unsavedConfirm as string)) return;
    onClose();
  }, [dirty, onClose, t.unsavedConfirm]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const payload = {
      ...form,
      compareAtPrice: form.compareAtPrice || null,
      stockQuantity: form.stockMode === "UNLIMITED" ? null : form.stockQuantity,
    };
    try {
      const changesPriceOrStock = item === "new"
        || item.basePrice !== form.basePrice
        || (item.compareAtPrice ?? "") !== form.compareAtPrice
        || item.stockMode !== form.stockMode
        || (item.stockQuantity ?? 0) !== form.stockQuantity;
      if (changesPriceOrStock && !window.confirm(t.productConfirm as string)) return;
      if (item === "new") await createProduct(payload);
      else await updateProduct(item.id, { ...payload, version: item.version });
      invalidateAdminCache("dashboard", "categories");
      invalidateAdminCacheByPrefix("products:");
      invalidateAdminCacheByPrefix("media-references:");
      notify(locale === "zh" ? "商品已保存。" : "Product saved.");
      onSaved();
    } catch {
      setError(t.saveError as string);
      notify(t.saveError as string, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog wide title={item === "new" ? t.addProduct as string : t.edit as string} closeLabel={t.close as string} onClose={requestClose}>
      <form className="editor-form product-editor" onSubmit={submit}>
        <div className="form-grid two">
          <label><span>{t.zhName as string}</span><input value={form.nameZh} onChange={(event) => set("nameZh", event.target.value)} required /></label>
          <label><span>{t.enName as string}</span><input value={form.nameEn} onChange={(event) => set("nameEn", event.target.value)} required /></label>
          <label><span>{locale === "zh" ? "中文短标题" : "Chinese kicker"}</span><input value={form.kickerZh} onChange={(event) => set("kickerZh", event.target.value)} required /></label>
          <label><span>{locale === "zh" ? "英文短标题" : "English kicker"}</span><input value={form.kickerEn} onChange={(event) => set("kickerEn", event.target.value)} required /></label>
        </div>
        <div className="form-grid two">
          <label><span>{t.slug as string}</span><input value={form.slug} onChange={(event) => set("slug", event.target.value.toLocaleLowerCase())} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
          <label><span>{t.category as string}</span><select value={form.categoryId} onChange={(event) => set("categoryId", event.target.value)} required>{categories.map((category) => <option value={category.id} key={category.id}>{category.name[locale]}</option>)}</select></label>
          <label><span>{locale === "zh" ? "商品图片路径" : "Image path"}</span><input value={form.imageKey} onChange={(event) => set("imageKey", event.target.value)} required /></label>
          <label><span>{t.status as string}</span><select value={form.status} onChange={(event) => set("status", event.target.value as ProductDraft["status"])}>{["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"].map((status) => <option key={status} value={status}>{statusLabels[status]?.[locale] ?? status}</option>)}</select></label>
          <label><span>{t.price as string} MYR</span><input value={form.basePrice} onChange={(event) => set("basePrice", event.target.value)} pattern="\d+(?:\.\d{1,2})?" required /></label>
          <label><span>{locale === "zh" ? "划线价格 MYR" : "Compare-at MYR"}</span><input value={form.compareAtPrice} onChange={(event) => set("compareAtPrice", event.target.value)} pattern="\d*(?:\.\d{1,2})?" /></label>
          <label><span>{locale === "zh" ? "库存模式" : "Stock mode"}</span><select value={form.stockMode} onChange={(event) => set("stockMode", event.target.value as ProductDraft["stockMode"])}><option value="FINITE">{locale === "zh" ? "有限库存" : "Finite"}</option><option value="UNLIMITED">{locale === "zh" ? "不限库存" : "Unlimited"}</option></select></label>
          <label><span>{t.stock as string}</span><input type="number" min="0" disabled={form.stockMode === "UNLIMITED"} value={form.stockQuantity} onChange={(event) => set("stockQuantity", Number(event.target.value))} /></label>
          <label><span>{t.order as string}</span><input type="number" min="0" value={form.sortOrder} onChange={(event) => set("sortOrder", Number(event.target.value))} required /></label>
        </div>
        <div className="form-grid two">
          <label><span>{locale === "zh" ? "中文说明" : "Chinese description"}</span><textarea value={form.descriptionZh} onChange={(event) => set("descriptionZh", event.target.value)} required /></label>
          <label><span>{locale === "zh" ? "英文说明" : "English description"}</span><textarea value={form.descriptionEn} onChange={(event) => set("descriptionEn", event.target.value)} required /></label>
        </div>
        {error && <p className="form-error" role="alert"><WarningCircle />{error}</p>}
        <div className="dialog-actions"><button type="button" onClick={requestClose}>{t.cancel as string}</button><button className="admin-primary" disabled={busy}>{busy ? t.submitting as string : t.save as string}</button></div>
      </form>
    </Dialog>
  );
}
