import type {
  AdminHero,
  CreateHeroInput,
  HeroStatus,
  HeroTone,
  Locale,
} from "@cloudbridge/contracts";
import {
  ArrowDown,
  ArrowUp,
  Image as ImageIcon,
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
import { ApiError } from "../../api";
import {
  invalidateAdminCacheByPrefix,
  useAdminPageDirty,
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
  useUnsavedChanges,
} from "../../admin-ui";
import {
  createHero,
  getHeroes,
  reorderHeroes,
  updateHero,
} from "./api";

const copy = (locale: Locale, zh: string, en: string) => locale === "zh" ? zh : en;
const tones: HeroTone[] = ["cyan", "blue", "violet", "green"];
const statuses: HeroStatus[] = ["DRAFT", "ACTIVE", "INACTIVE"];
const localRasterAsset = /^\/(?:assets|media)\/[A-Za-z0-9._/-]+\.(?:avif|gif|jpe?g|png|webp)$/iu;

const isSafeLocalRasterAsset = (value: string): boolean => (
  localRasterAsset.test(value)
  && !value.includes("//")
  && !value.split("/").some((segment) => segment === "." || segment === "..")
);

export default function BannersPage({ canWrite, locale }: { canWrite: boolean; locale: Locale }) {
  const loader = useCallback((signal: AbortSignal) => getHeroes(signal), []);
  const { commit, data, state, reload } = useCachedAdminResource<AdminHero[]>("heroes", loader);
  const slow = useSlowAdminRequest(state);
  const { notify } = useAdminStatus();
  const [ordered, setOrdered] = useState<AdminHero[]>(() => data ?? []);
  const [editing, setEditing] = useState<AdminHero | "new" | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");

  useEffect(() => {
    if (data) setOrdered(data);
  }, [data]);

  const orderDirty = Boolean(data) && ordered.map((item) => item.id).join("|")
    !== data?.map((item) => item.id).join("|");
  useUnsavedChanges(orderDirty);
  useAdminPageDirty(orderDirty);

  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= ordered.length) return;
    setOrdered((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (item) next.splice(target, 0, item);
      return next;
    });
    setOrderError("");
  };

  const saveOrder = async () => {
    if (!canWrite || !orderDirty || savingOrder) return;
    setSavingOrder(true);
    setOrderError("");
    try {
      const response = await reorderHeroes({
        items: ordered.map((item) => ({ id: item.id, version: item.version })),
      });
      invalidateAdminCacheByPrefix("media-references:");
      commit(response.data);
      setOrdered(response.data);
      notify(copy(locale, "轮播顺序已保存。", "Hero order saved."));
      void reload();
    } catch (error) {
      const message = error instanceof ApiError && error.status === 409
        ? copy(locale, "轮播已被其他管理员修改，请重新加载后再排序。", "Hero content changed. Reload before reordering.")
        : copy(locale, "轮播顺序未保存，请重试。", "Hero order was not saved. Try again.");
      setOrderError(message);
      notify(message, "error");
    } finally {
      setSavingOrder(false);
    }
  };

  if (!data) {
    return (
      <section className="admin-panel">
        <PanelState state={state} locale={locale} retry={() => void reload()} kind="cards" />
      </section>
    );
  }

  return (
    <>
      <div className="real-page-toolbar">
        <span>
          {copy(
            locale,
            `${ordered.length} 个轮播故事 · ${ordered.filter((item) => item.status === "ACTIVE").length} 个正在展示`,
            `${ordered.length} hero stories · ${ordered.filter((item) => item.status === "ACTIVE").length} active`,
          )}
        </span>
        {canWrite && (
          <div>
            {orderDirty && (
              <button className="admin-secondary" disabled={savingOrder} onClick={() => setOrdered(data)}>
                {copy(locale, "撤销排序", "Reset order")}
              </button>
            )}
            <button className="admin-secondary" disabled={!orderDirty || savingOrder} onClick={() => void saveOrder()}>
              {savingOrder ? copy(locale, "正在保存", "Saving") : copy(locale, "保存排序", "Save order")}
            </button>
            <button
              className="admin-primary"
              disabled={orderDirty}
              title={orderDirty ? copy(locale, "请先保存或撤销当前排序", "Save or reset the current order first") : undefined}
              onClick={() => setEditing("new")}
            >
              <Plus size={17} />{copy(locale, "新增轮播", "New story")}
            </button>
          </div>
        )}
      </div>
      <RefreshNotice state={state} locale={locale} retry={() => void reload()} slow={slow} />
      {orderError && <p className="form-error real-page-error" role="alert"><WarningCircle />{orderError}</p>}
      {ordered.length === 0 ? (
        <section className="admin-panel">
          <PanelState state="empty" locale={locale} retry={() => void reload()} kind="cards" />
        </section>
      ) : (
        <div className="design-banner-board real-banner-board">
          {ordered.map((hero, index) => (
            <article className="admin-panel" key={hero.id}>
              <div className="design-banner-visual">
                {isSafeLocalRasterAsset(hero.imageKey)
                  ? <img src={hero.imageKey} alt="" />
                  : <span role="status">{copy(locale, "图片路径无效", "Invalid image path")}</span>}
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <div className="design-banner-copy">
                <div>
                  <StatusPill status={hero.status} locale={locale} />
                  <small>{copy(locale, "更新于", "Updated")} {formatDate(hero.updatedAt, locale)}</small>
                </div>
                <h2>{hero.translations[locale].title}</h2>
                <p>{hero.translations[locale].body}</p>
                {canWrite && (
                  <div className="real-card-actions">
                    <button
                      aria-label={copy(locale, `向前移动 ${hero.translations.zh.title}`, `Move ${hero.translations.en.title} earlier`)}
                      disabled={index === 0 || savingOrder}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      aria-label={copy(locale, `向后移动 ${hero.translations.zh.title}`, `Move ${hero.translations.en.title} later`)}
                      disabled={index === ordered.length - 1 || savingOrder}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      aria-label={copy(locale, `编辑 ${hero.translations.zh.title}`, `Edit ${hero.translations.en.title}`)}
                      disabled={orderDirty}
                      title={orderDirty ? copy(locale, "请先保存或撤销当前排序", "Save or reset the current order first") : undefined}
                      onClick={() => setEditing(hero)}
                    >
                      <NotePencil size={16} />{copy(locale, "编辑", "Edit")}
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <HeroDialog
          item={editing}
          locale={locale}
          nextSortOrder={ordered.length + 1}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            const next = itemAfterSave(data, saved);
            commit(next);
            setOrdered(next);
            void reload();
          }}
        />
      )}
    </>
  );
}

function itemAfterSave(current: AdminHero[], saved: AdminHero): AdminHero[] {
  const found = current.some((item) => item.id === saved.id);
  return (found
    ? current.map((item) => item.id === saved.id ? saved : item)
    : [...current, saved]
  ).sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt));
}

function HeroDialog({
  item,
  locale,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  item: AdminHero | "new";
  locale: Locale;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (saved: AdminHero) => void;
}) {
  const { notify } = useAdminStatus();
  const initialForm = useMemo<CreateHeroInput>(() => item === "new" ? {
    key: "",
    imageKey: "/assets/hero-main.webp",
    targetSlug: null,
    tone: "cyan",
    status: "DRAFT",
    sortOrder: nextSortOrder,
    translations: {
      zh: { eyebrow: "", title: "", body: "", cta: "" },
      en: { eyebrow: "", title: "", body: "", cta: "" },
    },
  } : {
    key: item.key,
    imageKey: item.imageKey,
    targetSlug: item.targetSlug,
    tone: item.tone,
    status: item.status,
    sortOrder: item.sortOrder,
    translations: item.translations,
  }, [item, nextSortOrder]);
  const [form, setForm] = useState<CreateHeroInput>(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  useUnsavedChanges(dirty);
  useAdminPageDirty(dirty);

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm(copy(locale, "尚有未保存内容，确定关闭吗？", "Discard unsaved changes?"))) return;
    onClose();
  }, [dirty, locale, onClose]);

  const setTranslation = (
    language: Locale,
    field: keyof CreateHeroInput["translations"]["zh"],
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [language]: {
          ...current.translations[language],
          [field]: value,
        },
      },
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const normalized: CreateHeroInput = {
      ...form,
      key: form.key.trim(),
      imageKey: form.imageKey.trim(),
      targetSlug: form.targetSlug?.trim() || null,
      translations: {
        zh: Object.fromEntries(Object.entries(form.translations.zh).map(([key, value]) => [key, value.trim()])) as CreateHeroInput["translations"]["zh"],
        en: Object.fromEntries(Object.entries(form.translations.en).map(([key, value]) => [key, value.trim()])) as CreateHeroInput["translations"]["en"],
      },
    };
    if (!isSafeLocalRasterAsset(normalized.imageKey)) {
      setError(copy(locale, "图片必须是 /assets/ 下的安全本地栅格图片。", "Choose a safe local raster image under /assets/."));
      return;
    }
    if (Object.values(normalized.translations.zh).some((value) => !value)
      || Object.values(normalized.translations.en).some((value) => !value)) {
      setError(copy(locale, "中英文轮播内容不能只包含空格。", "Chinese and English hero content cannot be blank."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      let saved: AdminHero;
      if (item === "new") {
        saved = (await createHero(normalized)).data;
      } else {
        saved = (await updateHero(item.id, { ...normalized, version: item.version })).data;
      }
      invalidateAdminCacheByPrefix("media-references:");
      notify(copy(locale, "轮播内容已保存。", "Hero story saved."));
      onSaved(saved);
    } catch (requestError) {
      const message = requestError instanceof ApiError && requestError.status === 409
        ? copy(locale, "内容已被其他管理员修改，请关闭后重新加载。", "This story changed elsewhere. Close and reload.")
        : requestError instanceof ApiError && requestError.status === 403
          ? copy(locale, "当前账号没有编辑轮播的权限。", "This account cannot edit hero content.")
          : copy(locale, "轮播内容未保存，请检查所有字段。", "Hero story was not saved. Check every field.");
      setError(message);
      notify(message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={item === "new" ? copy(locale, "新增轮播", "New hero story") : copy(locale, "编辑轮播", "Edit hero story")}
      closeLabel={copy(locale, "关闭", "Close")}
      onClose={requestClose}
      wide
    >
      <form className="editor-form real-hero-editor" onSubmit={submit}>
        <div className="form-grid two">
          <label>
            <span>{copy(locale, "唯一标识", "Unique key")}</span>
            <input
              value={form.key}
              onChange={(event) => setForm({ ...form, key: event.target.value.toLocaleLowerCase() })}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              maxLength={80}
              required
            />
          </label>
          <label>
            <span>{copy(locale, "站内图片路径", "Site image path")}</span>
            <input
              value={form.imageKey}
              onChange={(event) => setForm({ ...form, imageKey: event.target.value })}
              pattern="/assets/[A-Za-z0-9._/-]+"
              maxLength={512}
              required
            />
          </label>
        </div>
        <div className="hero-editor-preview">
          <ImageIcon size={18} />
          {isSafeLocalRasterAsset(form.imageKey)
            ? <img src={form.imageKey} alt="" />
            : <span role="status">{copy(locale, "图片路径无效", "Invalid image path")}</span>}
          <span>{copy(locale, "当前图片预览", "Current image preview")}</span>
        </div>
        <div className="form-grid">
          <label>
            <span>{copy(locale, "目标商品 Slug（可留空）", "Target product slug (optional)")}</span>
            <input
              value={form.targetSlug ?? ""}
              onChange={(event) => setForm({ ...form, targetSlug: event.target.value || null })}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              maxLength={160}
            />
          </label>
        </div>
        <div className="form-grid two">
          <label>
            <span>{copy(locale, "视觉色调", "Visual tone")}</span>
            <select value={form.tone} onChange={(event) => setForm({ ...form, tone: event.target.value as HeroTone })}>
              {tones.map((tone) => <option value={tone} key={tone}>{tone}</option>)}
            </select>
          </label>
          <label>
            <span>{copy(locale, "状态", "Status")}</span>
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as HeroStatus })}>
              {statuses.map((status) => <option value={status} key={status}>{status}</option>)}
            </select>
          </label>
        </div>
        {(["zh", "en"] as const).map((language) => (
          <fieldset className="localized-editor" key={language}>
            <legend>{language === "zh" ? "中文内容" : "English content"}</legend>
            <div className="form-grid two">
              <label><span>{copy(locale, "眉题", "Eyebrow")}</span><input value={form.translations[language].eyebrow} onChange={(event) => setTranslation(language, "eyebrow", event.target.value)} maxLength={160} required /></label>
              <label><span>{copy(locale, "按钮文案", "CTA")}</span><input value={form.translations[language].cta} onChange={(event) => setTranslation(language, "cta", event.target.value)} maxLength={120} required /></label>
            </div>
            <label><span>{copy(locale, "标题", "Title")}</span><textarea value={form.translations[language].title} onChange={(event) => setTranslation(language, "title", event.target.value)} maxLength={300} rows={2} required /></label>
            <label><span>{copy(locale, "说明", "Description")}</span><textarea value={form.translations[language].body} onChange={(event) => setTranslation(language, "body", event.target.value)} maxLength={5000} rows={3} required /></label>
          </fieldset>
        ))}
        {error && <p className="form-error" role="alert"><WarningCircle />{error}</p>}
        <div className="dialog-actions">
          <button type="button" onClick={requestClose}>{copy(locale, "取消", "Cancel")}</button>
          <button className="admin-primary" disabled={busy || (item !== "new" && !dirty)}>
            {busy ? copy(locale, "正在保存", "Saving") : copy(locale, "保存", "Save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
