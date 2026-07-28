import {
  Eye,
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
  type Locale,
} from "../api";
import {
  invalidateAdminCache,
  invalidateAdminCacheByPrefix,
  useAdminStatus,
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../admin-experience";
import { DesignWorkflowDialog } from "../design-workflows";
import {
  Dialog,
  PanelState,
  RefreshNotice,
  StatusPill,
  statusLabels,
  useUnsavedChanges,
} from "../admin-ui";
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

export default function ProductsPage({ locale }: { locale: Locale }) {
  const t = adminCopy[locale];
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editing, setEditing] = useState<AdminProduct | "new" | null>(null);
  const [workflowProduct, setWorkflowProduct] = useState<AdminProduct | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 260);
    return () => window.clearTimeout(timer);
  }, [search]);

  const productLoader = useCallback((signal: AbortSignal) => getProducts(debouncedSearch, signal), [debouncedSearch]);
  const categoryLoader = useCallback((signal: AbortSignal) => getCategories(signal), []);
  const productsResource = useCachedAdminResource<AdminProduct[]>(`products:${debouncedSearch}`, productLoader);
  const categoriesResource = useCachedAdminResource<AdminCategory[]>("categories", categoryLoader);
  const slow = useSlowAdminRequest(productsResource.state);
  const products = productsResource.data;
  const categories = categoriesResource.data ?? [];

  return (
    <section className="admin-panel">
      <div className="panel-heading is-action-only">
        <button
          className="admin-secondary"
          disabled={!products?.length}
          onClick={() => products?.[0] && setWorkflowProduct(products[0])}
        >
          <Eye />{locale === "zh" ? "库存与发布设计" : "Inventory and publishing design"}
        </button>
        <button className="admin-primary" disabled={!categories.length} onClick={() => setEditing("new")}><Plus />{t.addProduct as string}</button>
      </div>
      <label className="admin-search">
        <MagnifyingGlass aria-hidden="true" />
        <span className="sr-only">{t.searchProducts as string}</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.searchProducts as string} />
      </label>
      <RefreshNotice state={productsResource.state} locale={locale} retry={() => void productsResource.reload()} slow={slow} />
      {!products ? <PanelState state={productsResource.state} locale={locale} retry={() => void productsResource.reload()} kind="cards" /> : (
        <div className="product-admin-grid" aria-busy={productsResource.state === "refreshing"}>
          {products.length === 0 && <div className="table-empty">{t.empty as string}</div>}
          {products.map((item) => (
            <article key={item.id}>
              <img src={item.imageKey} alt="" width={86} height={96} loading="lazy" decoding="async" />
              <div className="product-admin-copy">
                <p>{item.category.name[locale]}</p>
                <h3 title={item.translations[locale]?.name}>{item.translations[locale]?.name}</h3>
                <div><strong>MYR {item.basePrice}</strong><StatusPill status={item.status} locale={locale} /></div>
                <small>{item.stockMode === "UNLIMITED" ? (locale === "zh" ? "不限库存" : "Unlimited") : `${t.stock as string} ${item.stockQuantity ?? 0}`}</small>
              </div>
              <button onClick={() => setEditing(item)} aria-label={`${t.edit as string} ${item.translations[locale]?.name}`}><NotePencil /></button>
            </article>
          ))}
        </div>
      )}
      {editing && (
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
      {workflowProduct && (
        <DesignWorkflowDialog
          id="inventory-center"
          locale={locale}
          contextLabel={workflowProduct.translations[locale]?.name}
          onClose={() => setWorkflowProduct(null)}
        />
      )}
    </section>
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
