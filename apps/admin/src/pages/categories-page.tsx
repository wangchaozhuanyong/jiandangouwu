import {
  Eye,
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

export default function CategoriesPage({ locale }: { locale: Locale }) {
  const t = adminCopy[locale];
  const loader = useCallback((signal: AbortSignal) => getCategories(signal), []);
  const { data, state, reload } = useCachedAdminResource<AdminCategory[]>("categories", loader);
  const slow = useSlowAdminRequest(state);
  const [editing, setEditing] = useState<AdminCategory | "new" | null>(null);
  const [impactOpen, setImpactOpen] = useState(false);

  return (
    <section className="admin-panel">
      <div className="panel-heading is-action-only">
        <button className="admin-secondary" onClick={() => setImpactOpen(true)}>
          <Eye />{locale === "zh" ? "影响与排序设计" : "Impact and ordering design"}
        </button>
        <button className="admin-primary" onClick={() => setEditing("new")}><Plus />{t.addCategory as string}</button>
      </div>
      <RefreshNotice state={state} locale={locale} retry={() => void reload()} slow={slow} />
      {!data ? <PanelState state={state} locale={locale} retry={() => void reload()} /> : (
        <div className="category-list" tabIndex={0} aria-label={locale === "zh" ? "商品分类表，可横向滚动" : "Category table, horizontally scrollable"}>
          <div className="category-head"><span>{t.order as string}</span><span>{t.name as string}</span><span>{t.slug as string}</span><span>{t.productCount as string}</span><span>{t.status as string}</span><span /></div>
          {data.length === 0 && <div className="table-empty">{t.empty as string}</div>}
          {data.map((item) => (
            <article key={item.id}>
              <b>{String(item.sortOrder).padStart(2, "0")}</b>
              <div><strong>{item.name[locale]}</strong></div>
              <code>{item.slug}</code>
              <span>{item.productCount}</span>
              <StatusPill status={item.status} locale={locale} />
              <button aria-label={`${t.edit as string} ${item.name[locale]}`} onClick={() => setEditing(item)}><NotePencil /></button>
            </article>
          ))}
        </div>
      )}
      {editing && (
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
      {impactOpen && (
        <DesignWorkflowDialog id="categories" locale={locale} onClose={() => setImpactOpen(false)} />
      )}
    </section>
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
        {error && <p className="form-error" role="alert" tabIndex={-1}><WarningCircle />{error}</p>}
        <div className="dialog-actions"><button type="button" onClick={requestClose}>{t.cancel as string}</button><button className="admin-primary" disabled={busy}>{busy ? t.submitting as string : t.save as string}</button></div>
      </form>
    </Dialog>
  );
}
