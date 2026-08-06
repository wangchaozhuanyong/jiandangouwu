import {
  GithubLogo,
  NotePencil,
  Plus,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import {
  createSkill,
  createSkillCategory,
  getSkillCategories,
  getSkills,
  updateSkill,
  updateSkillCategory,
  type AdminSkill,
  type AdminSkillCategory,
  type Locale,
} from "../../api";
import {
  invalidateAdminCache,
  useAdminStatus,
  useCachedAdminResource,
} from "../../admin-experience";
import {
  Dialog,
  PanelState,
  RefreshNotice,
  StatusPill,
  statusLabels,
  useUnsavedChanges,
} from "../../admin-ui";

const copy = (locale: Locale, zh: string, en: string) =>
  locale === "zh" ? zh : en;
type EditingCategory = AdminSkillCategory | "new";
type EditingSkill = AdminSkill | "new";

export default function SkillsPage({
  canWrite,
  locale,
}: {
  canWrite: boolean;
  locale: Locale;
}) {
  const categoriesLoader = useCallback(
    (signal: AbortSignal) => getSkillCategories(signal),
    [],
  );
  const skillsLoader = useCallback(
    (signal: AbortSignal) => getSkills(signal),
    [],
  );
  const categories = useCachedAdminResource<AdminSkillCategory[]>(
    "skill-categories",
    categoriesLoader,
  );
  const skills = useCachedAdminResource<AdminSkill[]>("skills", skillsLoader);
  const [tab, setTab] = useState<"skills" | "categories">("skills");
  const [editingCategory, setEditingCategory] =
    useState<EditingCategory | null>(null);
  const [editingSkill, setEditingSkill] = useState<EditingSkill | null>(null);
  const resource = tab === "skills" ? skills : categories;

  return (
    <section className="admin-panel skill-admin-page">
      <div className="panel-heading is-action-only">
        <div className="admin-segmented" role="tablist">
          <button
            aria-selected={tab === "skills"}
            onClick={() => setTab("skills")}
            role="tab"
            type="button"
          >
            {copy(locale, "Skill 内容", "Skill content")}
          </button>
          <button
            aria-selected={tab === "categories"}
            onClick={() => setTab("categories")}
            role="tab"
            type="button"
          >
            {copy(locale, "Skill 分类", "Skill categories")}
          </button>
        </div>
        {canWrite && (
          <button
            className="admin-primary"
            onClick={() =>
              tab === "skills"
                ? setEditingSkill("new")
                : setEditingCategory("new")
            }
            type="button"
          >
            <Plus />
            {tab === "skills"
              ? copy(locale, "新增 Skill", "Add Skill")
              : copy(locale, "新增分类", "Add category")}
          </button>
        )}
      </div>
      <p className="category-readonly-note" role="note">
        {copy(
          locale,
          "来源级别只描述发布来源，不代表安全认证；GitHub 地址必须使用 https://github.com/。",
          "Source level describes provenance, not security certification. GitHub URLs must use https://github.com/.",
        )}
      </p>
      <RefreshNotice
        locale={locale}
        retry={() => void resource.reload()}
        slow={false}
        state={resource.state}
      />
      {tab === "categories" ? (
        !categories.data ? (
          <PanelState
            locale={locale}
            retry={() => void categories.reload()}
            state={categories.state}
          />
        ) : (
          <div className="category-list">
            <div className="category-head">
              <span>{copy(locale, "排序", "Order")}</span>
              <span>{copy(locale, "名称", "Name")}</span>
              <span>slug</span>
              <span>{copy(locale, "内容数", "Skills")}</span>
              <span>{copy(locale, "状态", "Status")}</span>
              <span />
            </div>
            {categories.data.map((item) => (
              <article key={item.id}>
                <b>{String(item.sortOrder).padStart(2, "0")}</b>
                <div>
                  <strong>{item.name[locale]}</strong>
                </div>
                <code>{item.slug}</code>
                <span>{item.skillCount}</span>
                <StatusPill locale={locale} status={item.status} />
                {canWrite ? (
                  <button
                    aria-label={`${copy(locale, "编辑", "Edit")} ${item.name[locale]}`}
                    onClick={() => setEditingCategory(item)}
                    type="button"
                  >
                    <NotePencil />
                  </button>
                ) : (
                  <span>—</span>
                )}
              </article>
            ))}
          </div>
        )
      ) : !skills.data ? (
        <PanelState
          locale={locale}
          retry={() => void skills.reload()}
          state={skills.state}
        />
      ) : (
        <div className="product-admin-grid skill-admin-grid">
          {skills.data.map((item) => (
            <article key={item.id}>
              <span className="skill-admin-type">{item.resourceType}</span>
              <div className="product-admin-copy">
                <p>
                  {item.category.name[locale]} · {item.sourceLevel}
                </p>
                <h3>{item.translations[locale].name}</h3>
                <div>
                  <a
                    href={item.githubUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <GithubLogo />
                    GitHub
                  </a>
                  <StatusPill locale={locale} status={item.status} />
                </div>
                <small>{item.compatibleEnvironments.join(" · ")}</small>
              </div>
              {canWrite && (
                <button
                  aria-label={`${copy(locale, "编辑", "Edit")} ${item.translations[locale].name}`}
                  onClick={() => setEditingSkill(item)}
                  type="button"
                >
                  <NotePencil />
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      {editingCategory && (
        <SkillCategoryDialog
          item={editingCategory}
          locale={locale}
          onClose={() => setEditingCategory(null)}
          onSaved={() => {
            setEditingCategory(null);
            void categories.reload();
          }}
        />
      )}
      {editingSkill && categories.data && (
        <SkillDialog
          categories={categories.data}
          item={editingSkill}
          locale={locale}
          onClose={() => setEditingSkill(null)}
          onSaved={() => {
            setEditingSkill(null);
            void skills.reload();
          }}
        />
      )}
    </section>
  );
}

function SkillCategoryDialog({
  item,
  locale,
  onClose,
  onSaved,
}: {
  item: EditingCategory;
  locale: Locale;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify } = useAdminStatus();
  const initial = useMemo(
    () => ({
      nameZh: item === "new" ? "" : item.name.zh,
      nameEn: item === "new" ? "" : item.name.en,
      slug: item === "new" ? "" : item.slug,
      sortOrder: item === "new" ? 1 : item.sortOrder,
      status: item === "new" ? "ACTIVE" : item.status,
    }),
    [item],
  );
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useUnsavedChanges(dirty);
  const close = () => {
    if (
      dirty &&
      !window.confirm(
        copy(
          locale,
          "修改尚未保存，确定关闭？",
          "Changes are not saved. Close?",
        ),
      )
    )
      return;
    onClose();
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (item === "new") await createSkillCategory(form);
      else
        await updateSkillCategory(item.id, { ...form, version: item.version });
      invalidateAdminCache("skill-categories", "skills");
      notify(copy(locale, "Skill 分类已保存。", "Skill category saved."));
      onSaved();
    } catch {
      setError(
        copy(
          locale,
          "保存失败，请检查输入或版本冲突。",
          "Save failed. Check the input or version conflict.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      closeLabel={copy(locale, "关闭", "Close")}
      onClose={close}
      title={
        item === "new"
          ? copy(locale, "新增 Skill 分类", "Add Skill category")
          : copy(locale, "编辑 Skill 分类", "Edit Skill category")
      }
    >
      <form className="editor-form" onSubmit={(event) => void submit(event)}>
        <div className="form-grid two">
          <label>
            <span>{copy(locale, "中文名称", "Chinese name")}</span>
            <input
              required
              value={form.nameZh}
              onChange={(event) =>
                setForm({ ...form, nameZh: event.target.value })
              }
            />
          </label>
          <label>
            <span>{copy(locale, "英文名称", "English name")}</span>
            <input
              required
              value={form.nameEn}
              onChange={(event) =>
                setForm({ ...form, nameEn: event.target.value })
              }
            />
          </label>
        </div>
        <label>
          <span>slug</span>
          <input
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            required
            value={form.slug}
            onChange={(event) =>
              setForm({ ...form, slug: event.target.value.toLowerCase() })
            }
          />
        </label>
        <div className="form-grid two">
          <label>
            <span>{copy(locale, "排序", "Order")}</span>
            <input
              min="0"
              required
              type="number"
              value={form.sortOrder}
              onChange={(event) =>
                setForm({ ...form, sortOrder: Number(event.target.value) })
              }
            />
          </label>
          <label>
            <span>{copy(locale, "状态", "Status")}</span>
            <select
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value as typeof form.status,
                })
              }
            >
              {["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <p className="form-error">
            <WarningCircle />
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button onClick={close} type="button">
            {copy(locale, "取消", "Cancel")}
          </button>
          <button className="admin-primary" disabled={busy}>
            {copy(locale, "保存", "Save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

type SkillDraft = {
  slug: string;
  categoryId: string;
  resourceType: AdminSkill["resourceType"];
  sourceLevel: AdminSkill["sourceLevel"];
  maintainer: string;
  githubUrl: string;
  documentationUrl: string;
  license: string;
  compatible: string;
  verifiedAt: string;
  status: AdminSkill["status"];
  sortOrder: number;
  nameZh: string;
  nameEn: string;
  summaryZh: string;
  summaryEn: string;
  descriptionZh: string;
  descriptionEn: string;
  suitableZh: string;
  suitableEn: string;
  unsuitableZh: string;
  unsuitableEn: string;
  installZh: string;
  installEn: string;
};

function lines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function SkillDialog({
  categories,
  item,
  locale,
  onClose,
  onSaved,
}: {
  categories: AdminSkillCategory[];
  item: EditingSkill;
  locale: Locale;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify } = useAdminStatus();
  const initial = useMemo<SkillDraft>(
    () =>
      item === "new"
        ? {
            slug: "",
            categoryId: categories[0]?.id ?? "",
            resourceType: "SKILL",
            sourceLevel: "COMMUNITY",
            maintainer: "",
            githubUrl: "https://github.com/",
            documentationUrl: "",
            license: "MIT",
            compatible: "Codex",
            verifiedAt: new Date().toISOString().slice(0, 10),
            status: "DRAFT",
            sortOrder: 1,
            nameZh: "",
            nameEn: "",
            summaryZh: "",
            summaryEn: "",
            descriptionZh: "",
            descriptionEn: "",
            suitableZh: "",
            suitableEn: "",
            unsuitableZh: "",
            unsuitableEn: "",
            installZh: "",
            installEn: "",
          }
        : {
            slug: item.slug,
            categoryId: item.category.id,
            resourceType: item.resourceType,
            sourceLevel: item.sourceLevel,
            maintainer: item.maintainer,
            githubUrl: item.githubUrl,
            documentationUrl: item.documentationUrl ?? "",
            license: item.license,
            compatible: item.compatibleEnvironments.join("\n"),
            verifiedAt: item.verifiedAt.slice(0, 10),
            status: item.status,
            sortOrder: item.sortOrder,
            nameZh: item.translations.zh.name,
            nameEn: item.translations.en.name,
            summaryZh: item.translations.zh.summary,
            summaryEn: item.translations.en.summary,
            descriptionZh: item.translations.zh.description,
            descriptionEn: item.translations.en.description,
            suitableZh: item.translations.zh.suitableFor.join("\n"),
            suitableEn: item.translations.en.suitableFor.join("\n"),
            unsuitableZh: item.translations.zh.unsuitableFor.join("\n"),
            unsuitableEn: item.translations.en.unsuitableFor.join("\n"),
            installZh: item.translations.zh.installHint,
            installEn: item.translations.en.installHint,
          },
    [categories, item],
  );
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useUnsavedChanges(dirty);
  const set = <K extends keyof SkillDraft>(key: K, value: SkillDraft[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const close = () => {
    if (
      dirty &&
      !window.confirm(
        copy(
          locale,
          "修改尚未保存，确定关闭？",
          "Changes are not saved. Close?",
        ),
      )
    )
      return;
    onClose();
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const payload = {
      slug: form.slug,
      categoryId: form.categoryId,
      resourceType: form.resourceType,
      sourceLevel: form.sourceLevel,
      maintainer: form.maintainer,
      githubUrl: form.githubUrl,
      documentationUrl: form.documentationUrl || null,
      license: form.license,
      compatibleEnvironments: lines(form.compatible),
      verifiedAt: form.verifiedAt,
      status: form.status,
      sortOrder: form.sortOrder,
      translations: {
        zh: {
          name: form.nameZh,
          summary: form.summaryZh,
          description: form.descriptionZh,
          suitableFor: lines(form.suitableZh),
          unsuitableFor: lines(form.unsuitableZh),
          installHint: form.installZh,
        },
        en: {
          name: form.nameEn,
          summary: form.summaryEn,
          description: form.descriptionEn,
          suitableFor: lines(form.suitableEn),
          unsuitableFor: lines(form.unsuitableEn),
          installHint: form.installEn,
        },
      },
    };
    try {
      if (item === "new") await createSkill(payload);
      else await updateSkill(item.id, { ...payload, version: item.version });
      invalidateAdminCache("skills");
      notify(copy(locale, "Skill 已保存。", "Skill saved."));
      onSaved();
    } catch {
      setError(
        copy(
          locale,
          "保存失败，请检查 GitHub 地址、双语内容或版本冲突。",
          "Save failed. Check the GitHub URL, bilingual content, or version conflict.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      closeLabel={copy(locale, "关闭", "Close")}
      onClose={close}
      title={
        item === "new"
          ? copy(locale, "新增 Skill", "Add Skill")
          : copy(locale, "编辑 Skill", "Edit Skill")
      }
      wide
    >
      <form
        className="editor-form skill-editor"
        onSubmit={(event) => void submit(event)}
      >
        <div className="form-grid two">
          <label>
            <span>slug</span>
            <input
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
              value={form.slug}
              onChange={(event) =>
                set("slug", event.target.value.toLowerCase())
              }
            />
          </label>
          <label>
            <span>{copy(locale, "分类", "Category")}</span>
            <select
              required
              value={form.categoryId}
              onChange={(event) => set("categoryId", event.target.value)}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name[locale]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy(locale, "类型", "Type")}</span>
            <select
              value={form.resourceType}
              onChange={(event) =>
                set(
                  "resourceType",
                  event.target.value as SkillDraft["resourceType"],
                )
              }
            >
              {["SKILL", "PLUGIN", "CONNECTOR"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy(locale, "来源级别", "Source level")}</span>
            <select
              value={form.sourceLevel}
              onChange={(event) =>
                set(
                  "sourceLevel",
                  event.target.value as SkillDraft["sourceLevel"],
                )
              }
            >
              {["OFFICIAL", "COMMUNITY"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy(locale, "维护者", "Maintainer")}</span>
            <input
              required
              value={form.maintainer}
              onChange={(event) => set("maintainer", event.target.value)}
            />
          </label>
          <label>
            <span>GitHub</span>
            <input
              pattern="https://github\.com/.+"
              required
              type="url"
              value={form.githubUrl}
              onChange={(event) => set("githubUrl", event.target.value)}
            />
          </label>
          <label>
            <span>{copy(locale, "文档地址", "Documentation URL")}</span>
            <input
              type="url"
              value={form.documentationUrl}
              onChange={(event) => set("documentationUrl", event.target.value)}
            />
          </label>
          <label>
            <span>{copy(locale, "许可证", "License")}</span>
            <input
              required
              value={form.license}
              onChange={(event) => set("license", event.target.value)}
            />
          </label>
          <label>
            <span>{copy(locale, "核验日期", "Verified date")}</span>
            <input
              required
              type="date"
              value={form.verifiedAt}
              onChange={(event) => set("verifiedAt", event.target.value)}
            />
          </label>
          <label>
            <span>{copy(locale, "状态", "Status")}</span>
            <select
              value={form.status}
              onChange={(event) =>
                set("status", event.target.value as SkillDraft["status"])
              }
            >
              {["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"].map((value) => (
                <option key={value} value={value}>
                  {statusLabels[value]?.[locale] ?? value}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy(locale, "排序", "Order")}</span>
            <input
              min="0"
              required
              type="number"
              value={form.sortOrder}
              onChange={(event) => set("sortOrder", Number(event.target.value))}
            />
          </label>
          <label>
            <span>
              {copy(
                locale,
                "兼容环境，每行一项",
                "Compatible environments, one per line",
              )}
            </span>
            <textarea
              required
              value={form.compatible}
              onChange={(event) => set("compatible", event.target.value)}
            />
          </label>
        </div>
        <div className="form-grid two">
          <label>
            <span>{copy(locale, "中文名称", "Chinese name")}</span>
            <input
              required
              value={form.nameZh}
              onChange={(event) => set("nameZh", event.target.value)}
            />
          </label>
          <label>
            <span>{copy(locale, "英文名称", "English name")}</span>
            <input
              required
              value={form.nameEn}
              onChange={(event) => set("nameEn", event.target.value)}
            />
          </label>
          <label>
            <span>{copy(locale, "中文摘要", "Chinese summary")}</span>
            <textarea
              required
              value={form.summaryZh}
              onChange={(event) => set("summaryZh", event.target.value)}
            />
          </label>
          <label>
            <span>{copy(locale, "英文摘要", "English summary")}</span>
            <textarea
              required
              value={form.summaryEn}
              onChange={(event) => set("summaryEn", event.target.value)}
            />
          </label>
          <label>
            <span>{copy(locale, "中文说明", "Chinese description")}</span>
            <textarea
              required
              value={form.descriptionZh}
              onChange={(event) => set("descriptionZh", event.target.value)}
            />
          </label>
          <label>
            <span>{copy(locale, "英文说明", "English description")}</span>
            <textarea
              required
              value={form.descriptionEn}
              onChange={(event) => set("descriptionEn", event.target.value)}
            />
          </label>
          <label>
            <span>
              {copy(
                locale,
                "中文适用任务，每行一项",
                "Chinese suitable tasks, one per line",
              )}
            </span>
            <textarea
              required
              value={form.suitableZh}
              onChange={(event) => set("suitableZh", event.target.value)}
            />
          </label>
          <label>
            <span>
              {copy(
                locale,
                "英文适用任务，每行一项",
                "English suitable tasks, one per line",
              )}
            </span>
            <textarea
              required
              value={form.suitableEn}
              onChange={(event) => set("suitableEn", event.target.value)}
            />
          </label>
          <label>
            <span>
              {copy(
                locale,
                "中文不适用任务，每行一项",
                "Chinese unsuitable tasks, one per line",
              )}
            </span>
            <textarea
              required
              value={form.unsuitableZh}
              onChange={(event) => set("unsuitableZh", event.target.value)}
            />
          </label>
          <label>
            <span>
              {copy(
                locale,
                "英文不适用任务，每行一项",
                "English unsuitable tasks, one per line",
              )}
            </span>
            <textarea
              required
              value={form.unsuitableEn}
              onChange={(event) => set("unsuitableEn", event.target.value)}
            />
          </label>
          <label>
            <span>{copy(locale, "中文安装提示", "Chinese install hint")}</span>
            <textarea
              required
              value={form.installZh}
              onChange={(event) => set("installZh", event.target.value)}
            />
          </label>
          <label>
            <span>{copy(locale, "英文安装提示", "English install hint")}</span>
            <textarea
              required
              value={form.installEn}
              onChange={(event) => set("installEn", event.target.value)}
            />
          </label>
        </div>
        {error && (
          <p className="form-error">
            <WarningCircle />
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button onClick={close} type="button">
            {copy(locale, "取消", "Cancel")}
          </button>
          <button className="admin-primary" disabled={busy}>
            {copy(locale, "保存", "Save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
