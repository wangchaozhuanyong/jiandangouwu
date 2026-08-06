import {
  CaretDown,
  PencilSimple,
  Plus,
  TreeStructure,
} from "@phosphor-icons/react";
import { useMemo, useRef, useState } from "react";
import {
  previewPrimaryCategories,
  previewProducts,
  previewSecondaryCategories,
  type PreviewPrimaryCategory,
  type PreviewSecondaryCategory,
} from "./preview-fixtures";
import type { PreviewLocale } from "./preview-model";
import {
  PreviewBoundaryNote,
  PreviewSectionHeading,
  previewText,
} from "./preview-components";

type EditablePrimary = Omit<PreviewPrimaryCategory, "name"> & { name: { zh: string; en: string } };
type EditableSecondary = Omit<PreviewSecondaryCategory, "name"> & { name: { zh: string; en: string } };
type CategoryEditor = {
  level: "PRIMARY" | "SECONDARY";
  id: string | null;
  parentId: string;
  nameZh: string;
  nameEn: string;
  slug: string;
  enabled: boolean;
  sortOrder: string;
};

const clonePrimary = (): EditablePrimary[] => previewPrimaryCategories.map((category) => ({
  ...category,
  name: { ...category.name },
}));
const cloneSecondary = (): EditableSecondary[] => previewSecondaryCategories.map((category) => ({
  ...category,
  name: { ...category.name },
}));

export default function CategoriesPreview({
  locale,
  onFeedback,
}: {
  locale: PreviewLocale;
  onFeedback: (message: string) => void;
}) {
  const [primaryCategories, setPrimaryCategories] = useState<EditablePrimary[]>(clonePrimary);
  const [secondaryCategories, setSecondaryCategories] = useState<EditableSecondary[]>(cloneSecondary);
  const [selectedPrimaryId, setSelectedPrimaryId] = useState(primaryCategories[0]!.id);
  const [editor, setEditor] = useState<CategoryEditor | null>(null);
  const [error, setError] = useState("");
  const newId = useRef(1);
  const selectedPrimary = primaryCategories.find((category) => category.id === selectedPrimaryId) ?? primaryCategories[0]!;
  const selectedSecondary = useMemo(() => secondaryCategories
    .filter((category) => category.parentId === selectedPrimary.id)
    .sort((a, b) => a.sortOrder - b.sortOrder), [secondaryCategories, selectedPrimary.id]);

  const primaryProductCount = (primaryId: string) => previewProducts.filter((product) => product.primaryCategoryId === primaryId).length;
  const secondaryProductCount = (secondaryId: string) => previewProducts.filter((product) => product.secondaryCategoryId === secondaryId).length;

  const openPrimaryEditor = (category?: EditablePrimary) => {
    setError("");
    setEditor({
      level: "PRIMARY",
      id: category?.id ?? null,
      parentId: "",
      nameZh: category?.name.zh ?? "",
      nameEn: category?.name.en ?? "",
      slug: category?.slug ?? "",
      enabled: category?.enabled ?? true,
      sortOrder: String(category?.sortOrder ?? (primaryCategories.length + 1) * 10),
    });
  };

  const openSecondaryEditor = (category?: EditableSecondary, parentId = selectedPrimary.id) => {
    setError("");
    setEditor({
      level: "SECONDARY",
      id: category?.id ?? null,
      parentId: category?.parentId ?? parentId,
      nameZh: category?.name.zh ?? "",
      nameEn: category?.name.en ?? "",
      slug: category?.slug ?? "",
      enabled: category?.enabled ?? true,
      sortOrder: String(category?.sortOrder ?? (selectedSecondary.length + 1) * 10),
    });
  };

  const saveEditor = () => {
    if (!editor) return;
    const sortOrder = Number.parseInt(editor.sortOrder, 10);
    if (!editor.nameZh.trim() || !editor.nameEn.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(editor.slug) || !Number.isFinite(sortOrder)) {
      setError(previewText(locale, "请填写中英文名称、有效 slug 和整数排序值。", "Enter Chinese and English names, a valid slug, and an integer sort value."));
      return;
    }
    if (editor.level === "SECONDARY" && !primaryCategories.some((category) => category.id === editor.parentId)) {
      setError(previewText(locale, "二级分类必须选择一个一级分类。", "A secondary category must select one primary category."));
      return;
    }

    if (editor.level === "PRIMARY") {
      const id = editor.id ?? `DEMO-CATEGORY-PRIMARY-NEW-${newId.current++}`;
      const next: EditablePrimary = {
        id,
        name: { zh: editor.nameZh.trim(), en: editor.nameEn.trim() },
        slug: editor.slug,
        enabled: editor.enabled,
        sortOrder,
      };
      setPrimaryCategories((current) => editor.id
        ? current.map((category) => category.id === editor.id ? next : category)
        : [...current, next]);
      setSelectedPrimaryId(id);
    } else {
      const id = editor.id ?? `DEMO-CATEGORY-SECONDARY-NEW-${newId.current++}`;
      const next: EditableSecondary = {
        id,
        parentId: editor.parentId,
        name: { zh: editor.nameZh.trim(), en: editor.nameEn.trim() },
        slug: editor.slug,
        enabled: editor.enabled,
        sortOrder,
      };
      setSecondaryCategories((current) => editor.id
        ? current.map((category) => category.id === editor.id ? next : category)
        : [...current, next]);
      setSelectedPrimaryId(editor.parentId);
    }
    setEditor(null);
    setError("");
    onFeedback(previewText(locale, "界面校验完成，未保存服务器数据。", "Interface validation completed. Server data was not saved."));
  };

  const secondaryRows = (parentId: string) => secondaryCategories
    .filter((category) => category.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section className="preview-v2-page preview-v2-categories-page">
      <PreviewSectionHeading
        icon={<TreeStructure aria-hidden="true" size={22} />}
        title={previewText(locale, "两级商品分类", "Two-level product categories")}
        body={previewText(locale, "一级分类负责频道组织，商品最终只归属一个二级分类。", "Primary categories organize channels; each product ultimately belongs to one secondary category.")}
      />
      <PreviewBoundaryNote locale={locale}>
        {previewText(locale, "全部商品是前台虚拟入口，不写入分类数据。本页只更新 React 内存，不调用分类或商品接口。", "All products is a virtual storefront entry and is not stored as category data. This page updates React memory only and calls no category or product API.")}
      </PreviewBoundaryNote>

      <div className="preview-v2-category-actions">
        <button className="admin-secondary" onClick={() => openPrimaryEditor()} type="button"><Plus aria-hidden="true" size={17} />{previewText(locale, "新增一级分类", "Add primary category")}</button>
        <button className="admin-primary" onClick={() => openSecondaryEditor()} type="button"><Plus aria-hidden="true" size={17} />{previewText(locale, "新增二级分类", "Add secondary category")}</button>
      </div>

      <div className="preview-v2-category-layout">
        <section className="admin-panel preview-v2-primary-pane">
          <header><strong>{previewText(locale, "一级分类", "Primary categories")}</strong><small>{primaryCategories.length}</small></header>
          <div>
            {[...primaryCategories].sort((a, b) => a.sortOrder - b.sortOrder).map((category) => {
              const childCount = secondaryRows(category.id).length;
              return (
                <button aria-pressed={selectedPrimary.id === category.id} className={selectedPrimary.id === category.id ? "is-selected" : ""} key={category.id} onClick={() => setSelectedPrimaryId(category.id)} type="button">
                  <span><strong>{category.name[locale]}</strong><small>{category.slug}</small></span>
                  <em>{category.enabled ? previewText(locale, "启用", "On") : previewText(locale, "停用", "Off")} · {category.sortOrder}</em>
                  <i>{previewText(locale, `${childCount} 个二级 · ${primaryProductCount(category.id)} 个商品`, `${childCount} secondary · ${primaryProductCount(category.id)} products`)}</i>
                </button>
              );
            })}
          </div>
          <footer><button className="admin-secondary" onClick={() => openPrimaryEditor(selectedPrimary)} type="button"><PencilSimple aria-hidden="true" size={16} />{previewText(locale, "编辑当前一级", "Edit selected primary")}</button></footer>
        </section>

        <section className="admin-panel preview-v2-secondary-pane">
          <header>
            <div><small>{selectedPrimary.name[locale]}</small><h2>{previewText(locale, "二级分类", "Secondary categories")}</h2></div>
            <button className="admin-secondary" onClick={() => openSecondaryEditor()} type="button"><Plus aria-hidden="true" size={16} />{previewText(locale, "新增", "Add")}</button>
          </header>
          <div className="preview-v2-secondary-table" role="table" aria-label={previewText(locale, "二级分类列表", "Secondary category list")}>
            <div role="row"><span role="columnheader">{previewText(locale, "名称", "Name")}</span><span role="columnheader">Slug</span><span role="columnheader">{previewText(locale, "状态", "Status")}</span><span role="columnheader">{previewText(locale, "排序", "Order")}</span><span role="columnheader">{previewText(locale, "商品", "Products")}</span><span role="columnheader">{previewText(locale, "操作", "Action")}</span></div>
            {selectedSecondary.map((category) => (
              <div key={category.id} role="row">
                <strong role="cell">{category.name[locale]}</strong>
                <code role="cell">{category.slug}</code>
                <span role="cell">{category.enabled ? previewText(locale, "启用", "On") : previewText(locale, "停用", "Off")}</span>
                <span role="cell">{category.sortOrder}</span>
                <span role="cell">{secondaryProductCount(category.id)}</span>
                <button aria-label={previewText(locale, `编辑${category.name.zh}`, `Edit ${category.name.en}`)} onClick={() => openSecondaryEditor(category)} role="cell" type="button"><PencilSimple aria-hidden="true" size={17} /></button>
              </div>
            ))}
          </div>
          <p className="preview-v2-category-impact">{selectedPrimary.enabled
            ? previewText(locale, "一级分类已启用；停用单个二级分类只影响其自身导航。", "This primary category is enabled; disabling one secondary category affects only its own navigation.")
            : previewText(locale, "一级分类已停用；前台会同时隐藏它的全部二级导航，但不会自动移动或隐藏商品。", "This primary category is disabled; the storefront would hide all of its secondary navigation without moving or hiding products automatically.")}</p>
        </section>
      </div>

      <div className="preview-v2-category-mobile-tree">
        {[...primaryCategories].sort((a, b) => a.sortOrder - b.sortOrder).map((primary) => (
          <details key={primary.id} open={primary.id === selectedPrimary.id}>
            <summary onClick={() => setSelectedPrimaryId(primary.id)}><span><strong>{primary.name[locale]}</strong><small>{secondaryRows(primary.id).length} · {primaryProductCount(primary.id)}</small></span><CaretDown aria-hidden="true" size={17} /></summary>
            <div>
              {secondaryRows(primary.id).map((secondary) => (
                <article key={secondary.id}><span><strong>{secondary.name[locale]}</strong><small>{secondary.slug} · {secondaryProductCount(secondary.id)}</small></span><button aria-label={previewText(locale, `编辑${secondary.name.zh}`, `Edit ${secondary.name.en}`)} onClick={() => openSecondaryEditor(secondary)} type="button"><PencilSimple aria-hidden="true" size={17} /></button></article>
              ))}
              <button className="admin-secondary" onClick={() => openSecondaryEditor(undefined, primary.id)} type="button"><Plus aria-hidden="true" size={16} />{previewText(locale, "新增二级分类", "Add secondary category")}</button>
            </div>
          </details>
        ))}
      </div>

      {editor && (
        <section className="admin-panel preview-v2-category-editor" aria-labelledby="preview-category-editor-title">
          <header><div><small>{editor.level === "PRIMARY" ? previewText(locale, "一级分类", "Primary category") : previewText(locale, "二级分类", "Secondary category")}</small><h2 id="preview-category-editor-title">{editor.id ? previewText(locale, "编辑分类", "Edit category") : previewText(locale, "新增分类", "Add category")}</h2></div><code>{editor.id ?? "DEMO-NEW"}</code></header>
          <div>
            <label><span>{previewText(locale, "中文名称", "Chinese name")}</span><input onChange={(event) => setEditor({ ...editor, nameZh: event.target.value })} value={editor.nameZh} /></label>
            <label><span>{previewText(locale, "英文名称", "English name")}</span><input onChange={(event) => setEditor({ ...editor, nameEn: event.target.value })} value={editor.nameEn} /></label>
            <label><span>Slug</span><input onChange={(event) => setEditor({ ...editor, slug: event.target.value.toLocaleLowerCase() })} value={editor.slug} /></label>
            <label><span>{previewText(locale, "排序", "Sort order")}</span><input inputMode="numeric" onChange={(event) => setEditor({ ...editor, sortOrder: event.target.value })} value={editor.sortOrder} /></label>
            {editor.level === "SECONDARY" && <label><span>{previewText(locale, "所属一级分类", "Parent primary category")}</span><select onChange={(event) => setEditor({ ...editor, parentId: event.target.value })} value={editor.parentId}>{primaryCategories.map((category) => <option key={category.id} value={category.id}>{category.name[locale]}</option>)}</select></label>}
            <label className="preview-v2-category-enabled"><span>{previewText(locale, "导航状态", "Navigation status")}</span><select onChange={(event) => setEditor({ ...editor, enabled: event.target.value === "on" })} value={editor.enabled ? "on" : "off"}><option value="on">{previewText(locale, "启用", "Enabled")}</option><option value="off">{previewText(locale, "停用", "Disabled")}</option></select></label>
          </div>
          <p>{editor.level === "PRIMARY"
            ? previewText(locale, "一级分类不能选择父级；停用后会影响其全部二级导航。", "A primary category cannot select a parent. Disabling it affects all secondary navigation below it.")
            : previewText(locale, "二级分类必须选择一个一级分类；界面不提供第三级。", "A secondary category must select one primary category. The interface does not provide a third level.")}</p>
          {error && <div className="preview-v2-category-error" role="alert">{error}</div>}
          <footer><button className="admin-secondary" onClick={() => { setEditor(null); setError(""); }} type="button">{previewText(locale, "取消", "Cancel")}</button><button className="admin-primary" onClick={saveEditor} type="button">{previewText(locale, "校验界面结果", "Validate interface result")}</button></footer>
        </section>
      )}
    </section>
  );
}
