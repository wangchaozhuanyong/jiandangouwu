import {
  Check,
  MagnifyingGlass,
  NotePencil,
  Translate,
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
  type Locale,
} from "../../api";
import {
  invalidateAdminCache,
  invalidateAdminCacheByPrefix,
  useAdminPageDirty,
  useAdminStatus,
  useCachedAdminResource,
  useSlowAdminRequest,
} from "../../admin-experience";
import {
  formatDate,
  PanelState,
  RefreshNotice,
} from "../../admin-ui";
import {
  getTranslationWorkspace,
  saveTranslationEntry,
} from "./api";
import {
  buildTranslationEntries,
  draftFromEntry,
  entryCompletion,
  filterTranslationEntries,
  localeCompletion,
  normalizeTranslationDraft,
  translationDraftChanged,
  translationKinds,
  type TranslationDraft,
  type TranslationEntry,
  type TranslationFilter,
  type TranslationKind,
  type TranslationWorkspaceData,
} from "./model";

const copy = (locale: Locale, zh: string, en: string): string =>
  locale === "zh" ? zh : en;

const readPermissions = [
  "catalog.read",
  "content.read",
  "support.read",
  "settings.read",
] as const;

const kindLabels: Record<TranslationKind, Record<Locale, string>> = {
  product: { zh: "商品", en: "Products" },
  category: { zh: "分类", en: "Categories" },
  hero: { zh: "首页轮播", en: "Hero stories" },
  contact: { zh: "客服渠道", en: "Contact channels" },
  settings: { zh: "站点设置", en: "Site settings" },
};

const fieldError = (
  entry: TranslationEntry,
  fieldKey: string,
  fieldLocale: Locale,
  reason: "blank" | "too-long",
  locale: Locale,
): string => {
  const label = entry.fields.find((item) => item.key === fieldKey)?.label[locale]
    ?? fieldKey;
  const language = fieldLocale === "zh"
    ? copy(locale, "中文", "Chinese")
    : copy(locale, "英文", "English");
  return reason === "blank"
    ? copy(
        locale,
        `${label}的${language}内容不能为空。`,
        `${language} ${label} cannot be blank.`,
      )
    : copy(
        locale,
        `${label}的${language}内容超过长度限制。`,
        `${language} ${label} exceeds its length limit.`,
      );
};

const invalidateEntryCaches = (kind: TranslationKind): void => {
  if (kind === "product") {
    invalidateAdminCacheByPrefix("products:");
    invalidateAdminCacheByPrefix("media-references:");
    invalidateAdminCache("dashboard");
    return;
  }
  if (kind === "category") {
    invalidateAdminCache("categories", "dashboard");
    invalidateAdminCacheByPrefix("products:");
    return;
  }
  if (kind === "hero") {
    invalidateAdminCache("heroes");
    invalidateAdminCacheByPrefix("media-references:");
    return;
  }
  if (kind === "contact") {
    invalidateAdminCache("contact-channels");
    return;
  }
  invalidateAdminCache("site-settings");
};

export default function TranslationsPage({
  locale,
  permissions,
}: {
  locale: Locale;
  permissions: string[];
}) {
  const hasReadAccess = readPermissions.some((permission) =>
    permissions.includes(permission));
  const loader = useCallback(
    (signal: AbortSignal) => getTranslationWorkspace(permissions, signal),
    [permissions],
  );
  const {
    data,
    state,
    reload,
  } = useCachedAdminResource<TranslationWorkspaceData>(
    `translation-workspace:${[...permissions].sort().join(",")}`,
    loader,
  );
  const slow = useSlowAdminRequest(state);
  const { notify } = useAdminStatus();
  const [filter, setFilter] = useState<TranslationFilter>({
    kind: "all",
    missingOnly: false,
    search: "",
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<TranslationDraft | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const entries = useMemo(
    () => data ? buildTranslationEntries(data, permissions) : [],
    [data, permissions],
  );
  const visibleEntries = useMemo(
    () => filterTranslationEntries(entries, filter),
    [entries, filter],
  );
  const selected = entries.find((entry) => entry.key === selectedKey) ?? null;
  const dirty = Boolean(
    selected
    && draft
    && (
      translationDraftChanged(selected, draft)
      || (selected.kind === "settings" && reason.trim().length > 0)
    ),
  );
  useAdminPageDirty(dirty);

  useEffect(() => {
    if (selectedKey || entries.length === 0) return;
    setSelectedKey(entries[0]!.key);
  }, [entries, selectedKey]);

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      setReason("");
      setError("");
      return;
    }
    setDraft(draftFromEntry(selected));
    setReason("");
    setError("");
  }, [selected]);

  const chooseEntry = (entry: TranslationEntry) => {
    if (busy || entry.key === selectedKey) return;
    if (dirty && !window.confirm(copy(
      locale,
      "切换内容会丢弃当前未保存的翻译，是否继续？",
      "Switching content discards the current unsaved translation. Continue?",
    ))) return;
    setSelectedKey(entry.key);
  };

  const updateDraft = (
    fieldKey: string,
    fieldLocale: Locale,
    value: string,
  ) => {
    setDraft((current) => current
      ? {
          ...current,
          [fieldKey]: {
            ...current[fieldKey]!,
            [fieldLocale]: value,
          },
        }
      : current);
    setError("");
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !draft || !selected.canWrite || busy) return;
    const validation = normalizeTranslationDraft(selected, draft);
    if (!validation.ok) {
      setError(fieldError(
        selected,
        validation.fieldKey,
        validation.locale,
        validation.reason,
        locale,
      ));
      return;
    }
    if (!translationDraftChanged(selected, validation.value)) {
      setError(copy(locale, "翻译内容没有变化。", "Translation content has not changed."));
      return;
    }
    if (selected.kind === "settings" && reason.trim().length < 8) {
      setError(copy(
        locale,
        "修改站点设置需要至少 8 个字符的变更原因。",
        "Site-setting changes require a reason of at least 8 characters.",
      ));
      return;
    }
    if (!window.confirm(copy(
      locale,
      `确认保存“${selected.stableName}”的中英文内容？`,
      `Save the Chinese and English content for “${selected.stableName}”?`,
    ))) return;

    setBusy(true);
    setError("");
    try {
      await saveTranslationEntry(selected, validation.value, reason.trim());
      invalidateEntryCaches(selected.kind);
      notify(copy(
        locale,
        "双语内容已由原领域接口确认保存。",
        "Bilingual content was confirmed by its owning API.",
      ));
      setDraft(null);
      setReason("");
      await reload();
    } catch (requestError) {
      const message = requestError instanceof ApiError && requestError.status === 409
        ? copy(
            locale,
            "内容已被其他管理员修改，请重新加载后再保存。",
            "Content changed elsewhere. Reload before saving.",
          )
        : requestError instanceof ApiError && requestError.status === 403
          ? copy(
              locale,
              "当前账号没有修改这类内容的权限。",
              "This account cannot edit this content type.",
            )
          : copy(
              locale,
              "双语内容未保存，请检查字段后重试。",
              "Bilingual content was not saved. Check the fields and try again.",
            );
      setError(message);
      notify(message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!hasReadAccess) {
    return (
      <section className="admin-panel">
        <PanelState
          state="forbidden"
          locale={locale}
          retry={() => undefined}
        />
      </section>
    );
  }

  if (!data) {
    return (
      <section className="admin-panel">
        <PanelState state={state} locale={locale} retry={() => void reload()} />
      </section>
    );
  }

  const chinese = localeCompletion(entries, "zh");
  const english = localeCompletion(entries, "en");
  const completeRecords = entries.filter((entry) =>
    entryCompletion(entry).missing === 0).length;
  const missingValues = entries.reduce((total, entry) =>
    total + entryCompletion(entry).missing, 0);
  const visibleKinds = translationKinds.filter((kind) =>
    entries.some((entry) => entry.kind === kind));

  return (
    <>
      <div className="translation-truth-note" role="note">
        <Translate size={19} />
        <span>
          <strong>{copy(locale, "真实双语内容工作台", "Live bilingual content workbench")}</strong>
          {copy(
            locale,
            "这里只聚合当前账号有权读取的平台数据库内容；保存仍由商品、轮播、客服或站点设置原接口执行，不扩大权限，也不跨语言自动回退。",
            "Only platform-database content this account may read is aggregated here. Saves still go through the owning catalog, hero, support, or settings API without widening access or adding cross-locale fallback.",
          )}
        </span>
      </div>

      <section className="admin-panel translation-summary">
        <div>
          <span><Translate size={22} /></span>
          <small>{copy(locale, "内容记录", "Content records")}</small>
          <strong>{entries.length}</strong>
        </div>
        <div>
          <span><Check size={22} /></span>
          <small>{copy(locale, "双语完整", "Bilingual complete")}</small>
          <strong>{completeRecords}</strong>
        </div>
        <div>
          <span><WarningCircle size={22} /></span>
          <small>{copy(locale, "缺失字段值", "Missing field values")}</small>
          <strong>{missingValues}</strong>
        </div>
      </section>

      <section className="admin-panel translation-progress">
        <div>
          <span>{copy(locale, "中文", "Chinese")}</span>
          <strong>{chinese.percentage}%</strong>
          <i><b style={{ width: `${chinese.percentage}%` }} /></i>
          <small>{chinese.complete} / {chinese.total}</small>
        </div>
        <div>
          <span>{copy(locale, "英文", "English")}</span>
          <strong>{english.percentage}%</strong>
          <i><b style={{ width: `${english.percentage}%` }} /></i>
          <small>{english.complete} / {english.total}</small>
        </div>
      </section>

      <section className="admin-panel translation-filterbar">
        <div className="translation-kind-filter" aria-label={copy(locale, "内容类型筛选", "Content type filter")}>
          <button
            className={filter.kind === "all" ? "is-active" : ""}
            onClick={() => setFilter((current) => ({ ...current, kind: "all" }))}
          >
            {copy(locale, "全部", "All")}
          </button>
          {visibleKinds.map((kind) => (
            <button
              className={filter.kind === kind ? "is-active" : ""}
              onClick={() => setFilter((current) => ({ ...current, kind }))}
              key={kind}
            >
              {kindLabels[kind][locale]}
            </button>
          ))}
        </div>
        <label className="translation-search">
          <MagnifyingGlass size={17} />
          <span className="sr-only">{copy(locale, "搜索双语内容", "Search bilingual content")}</span>
          <input
            value={filter.search}
            onChange={(event) => setFilter((current) => ({
              ...current,
              search: event.target.value,
            }))}
            placeholder={copy(locale, "搜索名称、标识或正文", "Search name, key, or copy")}
          />
        </label>
        <label className="translation-missing-toggle">
          <input
            type="checkbox"
            checked={filter.missingOnly}
            onChange={(event) => setFilter((current) => ({
              ...current,
              missingOnly: event.target.checked,
            }))}
          />
          <span>{copy(locale, "仅看缺失", "Missing only")}</span>
        </label>
      </section>

      <RefreshNotice
        state={state}
        locale={locale}
        retry={() => void reload()}
        slow={slow}
      />

      <div className="translation-workbench">
        <section className="admin-panel translation-record-list">
          {visibleEntries.length === 0 && (
            <div className="table-empty">
              {copy(
                locale,
                "没有符合当前筛选的双语内容。",
                "No bilingual content matches the current filters.",
              )}
            </div>
          )}
          {visibleEntries.map((entry) => {
            const completion = entryCompletion(entry);
            return (
              <button
                className={selected?.key === entry.key ? "is-selected" : ""}
                onClick={() => chooseEntry(entry)}
                key={entry.key}
              >
                <span className="translation-kind-token">{kindLabels[entry.kind][locale]}</span>
                <div>
                  <strong>{entry.title[locale] || entry.stableName}</strong>
                  <code>{entry.stableName}</code>
                </div>
                <span className={completion.missing > 0 ? "is-missing" : "is-complete"}>
                  {completion.complete}/{completion.total}
                </span>
                <NotePencil size={17} />
              </button>
            );
          })}
        </section>

        <section className="admin-panel translation-editor">
          {!selected || !draft ? (
            <div className="translation-editor-empty">
              <Translate size={26} />
              <p>{copy(
                locale,
                "选择一条内容查看中英文并进行编辑。",
                "Choose a record to inspect and edit its Chinese and English content.",
              )}</p>
            </div>
          ) : (
            <form onSubmit={(event) => void save(event)}>
              <div className="translation-editor-heading">
                <div>
                  <small>{kindLabels[selected.kind][locale]}</small>
                  <h2>{selected.stableName}</h2>
                  <p>{copy(locale, "最后更新", "Last updated")} · {formatDate(selected.updatedAt, locale)}</p>
                </div>
                <span className={entryCompletion(selected).missing > 0 ? "is-missing" : "is-complete"}>
                  {entryCompletion(selected).percentage}%
                </span>
              </div>

              {!selected.canWrite && (
                <div className="translation-readonly-note" role="note">
                  <WarningCircle size={17} />
                  {copy(
                    locale,
                    "当前账号可以查看，但没有修改这类内容的权限。",
                    "This account may view but cannot edit this content type.",
                  )}
                </div>
              )}

              <fieldset disabled={!selected.canWrite || busy}>
                {selected.fields.map((item) => (
                  <section className="translation-field-pair" key={item.key}>
                    <div className="translation-field-label">
                      <strong>{item.label[locale]}</strong>
                      <small>{item.key}</small>
                    </div>
                    <label>
                      <span>简体中文</span>
                      {item.multiline ? (
                        <textarea
                          value={draft[item.key]?.zh ?? ""}
                          onChange={(event) => updateDraft(item.key, "zh", event.target.value)}
                          maxLength={item.maxLength}
                          rows={item.maxLength > 1000 ? 5 : 3}
                          required
                        />
                      ) : (
                        <input
                          value={draft[item.key]?.zh ?? ""}
                          onChange={(event) => updateDraft(item.key, "zh", event.target.value)}
                          maxLength={item.maxLength}
                          required
                        />
                      )}
                    </label>
                    <label>
                      <span>English</span>
                      {item.multiline ? (
                        <textarea
                          value={draft[item.key]?.en ?? ""}
                          onChange={(event) => updateDraft(item.key, "en", event.target.value)}
                          maxLength={item.maxLength}
                          rows={item.maxLength > 1000 ? 5 : 3}
                          required
                        />
                      ) : (
                        <input
                          value={draft[item.key]?.en ?? ""}
                          onChange={(event) => updateDraft(item.key, "en", event.target.value)}
                          maxLength={item.maxLength}
                          required
                        />
                      )}
                    </label>
                  </section>
                ))}
              </fieldset>

              {selected.kind === "settings" && selected.canWrite && (
                <label className="translation-reason">
                  <span>{copy(
                    locale,
                    "站点设置变更原因（至少 8 个字符）",
                    "Site-setting change reason (at least 8 characters)",
                  )}</span>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    minLength={8}
                    maxLength={500}
                    rows={3}
                    required
                  />
                </label>
              )}

              {error && (
                <p className="form-error translation-error" role="alert">
                  <WarningCircle size={17} />{error}
                </p>
              )}

              {selected.canWrite && (
                <div className="translation-editor-actions">
                  <button
                    type="button"
                    disabled={!dirty || busy}
                    onClick={() => {
                      setDraft(draftFromEntry(selected));
                      setReason("");
                      setError("");
                    }}
                  >
                    {copy(locale, "撤销更改", "Discard changes")}
                  </button>
                  <button className="admin-primary" disabled={!dirty || busy}>
                    <Check size={17} />
                    {busy
                      ? copy(locale, "正在保存", "Saving")
                      : copy(locale, "保存双语内容", "Save bilingual content")}
                  </button>
                </div>
              )}
            </form>
          )}
        </section>
      </div>
    </>
  );
}
