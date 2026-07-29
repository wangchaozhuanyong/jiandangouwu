import {
  Eye,
  Info,
  NotePencil,
  Plus,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  createCategory,
  getCategories,
  updateCategory,
  type AdminCategory,
  type Locale,
} from "../api";
import {
  invalidateAdminCache,
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
  buildCategoryImpact,
  type CategoryImpactSignal,
} from "../features/categories/model";
import { adminCopy } from "../i18n";

const copy = (locale: Locale, zh: string, en: string): string => locale === "zh" ? zh : en;

const impactSignalCopy: Record<CategoryImpactSignal, Record<Locale, string>> = {
  MISSING_TRANSLATION: { zh: "双语缺失", en: "Missing locale" },
  NON_ACTIVE_WITH_PRODUCTS: { zh: "非启用且有关联商品", en: "Non-active with products" },
  ORDER_REPEATED: { zh: "顺序值重复", en: "Repeated order" },
  EMPTY: { zh: "空分类", en: "Empty category" },
  CLEAR: { zh: "当前无提示", en: "No current signal" },
};

export default function CategoriesPage({
  canWrite,
  locale,
}: {
  canWrite: boolean;
  locale: Locale;
}) {
  const t = adminCopy[locale];
  const loader = useCallback((signal: AbortSignal) => getCategories(signal), []);
  const { data, state, reload } = useCachedAdminResource<AdminCategory[]>("categories", loader);
  const slow = useSlowAdminRequest(state);
  const [editing, setEditing] = useState<AdminCategory | "new" | null>(null);
  const [impactOpen, setImpactOpen] = useState(false);

  return (
    <section className="admin-panel">
      <div className="panel-heading is-action-only">
        <button
          className="admin-secondary"
          disabled={!data}
          onClick={() => setImpactOpen(true)}
          type="button"
        >
          <Eye />{copy(locale, "分类影响概览", "Category impact overview")}
        </button>
        {canWrite && (
          <button
            className="admin-primary"
            onClick={() => setEditing("new")}
            type="button"
          >
            <Plus />{t.addCategory as string}
          </button>
        )}
      </div>
      {!canWrite && (
        <p className="category-readonly-note" role="note">
          <Info aria-hidden="true" size={18} />
          {copy(
            locale,
            "当前账号只有 catalog.read；可以查看真实分类与影响概览，但新增和编辑要求 catalog.write。",
            "This account has catalog.read only. Live categories and impact are visible, while create and edit require catalog.write.",
          )}
        </p>
      )}
      <RefreshNotice state={state} locale={locale} retry={() => void reload()} slow={slow} />
      {!data ? <PanelState state={state} locale={locale} retry={() => void reload()} /> : (
        <div
          aria-busy={state === "refreshing"}
          className="category-list"
          tabIndex={0}
          aria-label={locale === "zh" ? "商品分类表，可横向滚动" : "Category table, horizontally scrollable"}
        >
          <div className="category-head"><span>{t.order as string}</span><span>{t.name as string}</span><span>{t.slug as string}</span><span>{t.productCount as string}</span><span>{t.status as string}</span><span /></div>
          {data.length === 0 && <div className="table-empty">{t.empty as string}</div>}
          {data.map((item) => (
            <article key={item.id}>
              <b>{String(item.sortOrder).padStart(2, "0")}</b>
              <div><strong>{item.name[locale]}</strong></div>
              <code>{item.slug}</code>
              <span>{item.productCount}</span>
              <StatusPill status={item.status} locale={locale} />
              {canWrite
                ? (
                  <button
                    aria-label={`${t.edit as string} ${item.name[locale]}`}
                    onClick={() => setEditing(item)}
                    type="button"
                  >
                    <NotePencil />
                  </button>
                )
                : <span aria-hidden="true">—</span>}
            </article>
          ))}
        </div>
      )}
      {canWrite && editing && (
        <CategoryDialog
          locale={locale}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
      {impactOpen && data && (
        <CategoryImpactDialog
          categories={data}
          locale={locale}
          onClose={() => setImpactOpen(false)}
        />
      )}
    </section>
  );
}

function CategoryImpactDialog({
  categories,
  locale,
  onClose,
}: {
  categories: AdminCategory[];
  locale: Locale;
  onClose: () => void;
}) {
  const t = adminCopy[locale];
  const impact = useMemo(() => buildCategoryImpact(categories), [categories]);
  const summary = [
    [
      copy(locale, "已加载分类", "Loaded categories"),
      impact.loadedCategoryCount,
      copy(locale, "归档分类不在此接口中", "Archived categories are excluded"),
    ],
    [
      copy(locale, "启用 / 非启用", "Active / non-active"),
      `${impact.activeCategoryCount} / ${impact.nonActiveCategoryCount}`,
      copy(locale, "仅启用分类进入公开筛选导航", "Only active categories enter public filters"),
    ],
    [
      copy(locale, "已加载商品关联", "Loaded product assignments"),
      impact.loadedProductAssignmentCount,
      copy(locale, "不是在售商品总数", "Not the active product total"),
    ],
    [
      copy(locale, "需要复核", "Needs review"),
      impact.rows.filter((row) => row.signal !== "CLEAR").length,
      copy(
        locale,
        `空分类 ${impact.emptyCategoryCount} · 重复顺序 ${impact.repeatedOrderCategoryCount}`,
        `${impact.emptyCategoryCount} empty · ${impact.repeatedOrderCategoryCount} repeated-order rows`,
      ),
    ],
  ] as const;

  return (
    <Dialog
      closeLabel={t.close as string}
      onClose={onClose}
      title={copy(locale, "分类影响概览", "Category impact overview")}
      wide
    >
      <div className="category-impact-dialog">
        <div className="category-impact-summary">
          {summary.map(([label, value, note]) => (
            <article key={label}>
              <small>{label}</small>
              <strong>{value}</strong>
              <span>{note}</span>
            </article>
          ))}
        </div>
        <p className="category-impact-truth-note">
          <Info aria-hidden="true" size={18} />
          <span>
            {copy(
              locale,
              "本概览只读取当前分类接口。把分类改为非启用会从公开筛选导航移除该分类，但不会自动隐藏、移动或删除关联商品；归档后该分类也不会再出现在当前管理列表。",
              "This overview only reads the current categories API. Making a category non-active removes it from public filter navigation but does not hide, move, or delete linked products; archived categories also leave this admin list.",
            )}
          </span>
        </p>
        <div
          aria-label={copy(locale, "分类影响表，可横向滚动", "Category impact table, horizontally scrollable")}
          className="category-impact-table-wrap"
          tabIndex={0}
        >
          <table className="category-impact-table">
            <thead>
              <tr>
                <th scope="col">{t.order as string}</th>
                <th scope="col">{copy(locale, "中文名称", "Chinese name")}</th>
                <th scope="col">{copy(locale, "英文名称", "English name")}</th>
                <th scope="col">{t.slug as string}</th>
                <th scope="col">{t.status as string}</th>
                <th scope="col">{t.productCount as string}</th>
                <th scope="col">{copy(locale, "更新时间", "Updated")}</th>
                <th scope="col">{copy(locale, "影响提示", "Impact signal")}</th>
              </tr>
            </thead>
            <tbody>
              {impact.rows.map((category) => (
                <tr key={category.id}>
                  <td><code>{String(category.sortOrder).padStart(2, "0")}</code></td>
                  <td title={category.name.zh}>{category.name.zh || "—"}</td>
                  <td title={category.name.en}>{category.name.en || "—"}</td>
                  <td><code>{category.slug}</code></td>
                  <td><StatusPill locale={locale} status={category.status} /></td>
                  <td>{category.productCount}</td>
                  <td><time dateTime={category.updatedAt}>{formatDate(category.updatedAt, locale)}</time></td>
                  <td>
                    <span className={`category-impact-signal is-${category.signal.toLocaleLowerCase()}`}>
                      {impactSignalCopy[category.signal][locale]}
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

function CategoryDialog({
  locale,
  item,
  onClose,
  onSaved,
}: {
  locale: Locale;
  item: AdminCategory | "new";
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = adminCopy[locale];
  const { notify } = useAdminStatus();
  const initialForm = useMemo(() => ({
    nameZh: item === "new" ? "" : item.name.zh,
    nameEn: item === "new" ? "" : item.name.en,
    slug: item === "new" ? "" : item.slug,
    sortOrder: item === "new" ? 1 : item.sortOrder,
    status: item === "new" ? "ACTIVE" : item.status,
  }), [item]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  useUnsavedChanges(dirty);

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm(t.unsavedConfirm as string)) return;
    onClose();
  }, [dirty, onClose, t.unsavedConfirm]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (item === "new") await createCategory(form);
      else await updateCategory(item.id, { ...form, version: item.version });
      invalidateAdminCache("categories", "products", "dashboard");
      notify(locale === "zh" ? "分类已保存。" : "Category saved.");
      onSaved();
    } catch {
      setError(t.saveError as string);
      notify(t.saveError as string, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={item === "new" ? t.addCategory as string : t.edit as string} closeLabel={t.close as string} onClose={requestClose}>
      <form className="editor-form" onSubmit={submit}>
        <div className="form-grid two">
          <label><span>{t.zhName as string}</span><input value={form.nameZh} onChange={(event) => setForm({ ...form, nameZh: event.target.value })} required /></label>
          <label><span>{t.enName as string}</span><input value={form.nameEn} onChange={(event) => setForm({ ...form, nameEn: event.target.value })} required /></label>
        </div>
        <label><span>{t.slug as string}</span><input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLocaleLowerCase() })} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
        <div className="form-grid two">
          <label><span>{t.order as string}</span><input type="number" min="0" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} required /></label>
          <label><span>{t.status as string}</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as typeof form.status })}>{["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"].map((status) => <option key={status} value={status}>{statusLabels[status]?.[locale] ?? status}</option>)}</select></label>
        </div>
        {item !== "new" && item.productCount > 0 && form.status !== "ACTIVE" && (
          <p className="category-status-impact-note" role="note">
            <Info aria-hidden="true" size={18} />
            {copy(
              locale,
              `该分类当前关联 ${item.productCount} 个商品。保存后分类会退出公开筛选导航，但商品不会自动隐藏、移动或删除。`,
              `This category currently has ${item.productCount} linked products. Saving removes the category from public filters, but products are not hidden, moved, or deleted automatically.`,
            )}
          </p>
        )}
        {error && <p className="form-error" role="alert" tabIndex={-1}><WarningCircle />{error}</p>}
        <div className="dialog-actions"><button type="button" onClick={requestClose}>{t.cancel as string}</button><button className="admin-primary" disabled={busy}>{busy ? t.submitting as string : t.save as string}</button></div>
      </form>
    </Dialog>
  );
}
