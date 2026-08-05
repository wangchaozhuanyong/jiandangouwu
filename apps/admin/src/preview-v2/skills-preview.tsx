import {
  ArrowDown,
  ArrowUp,
  FolderSimple,
  LinkSimple,
  PuzzlePiece,
  ShieldCheck,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import {
  previewSkillCategories,
  previewSkills,
  type PreviewSkill,
  type PreviewSkillCategory,
} from "./preview-fixtures";
import type { PreviewLocale } from "./preview-model";
import {
  PreviewBoundaryNote,
  PreviewSectionHeading,
  previewText,
} from "./preview-components";

type EditableSkill = Omit<PreviewSkill, "name" | "summary" | "compatibility"> & {
  name: { zh: string; en: string };
  summary: { zh: string; en: string };
  compatibility: string[];
};

type EditableCategory = Omit<PreviewSkillCategory, "name"> & {
  name: { zh: string; en: string };
};

const skillDrafts = (): EditableSkill[] => previewSkills.map((item) => ({
  ...item,
  name: { ...item.name },
  summary: { ...item.summary },
  compatibility: [...item.compatibility],
}));

const categoryDrafts = (): EditableCategory[] => previewSkillCategories.map((item) => ({
  ...item,
  name: { ...item.name },
}));

const compatibilityOptions = ["Codex", "ChatGPT", "Claude Code"] as const;

function validHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export default function SkillsPreview({
  locale,
  onFeedback,
}: {
  locale: PreviewLocale;
  onFeedback: (message: string) => void;
}) {
  const [tab, setTab] = useState<"content" | "categories">("content");
  const [skills, setSkills] = useState<EditableSkill[]>(skillDrafts);
  const [categories, setCategories] = useState<EditableCategory[]>(categoryDrafts);
  const [selectedSkillId, setSelectedSkillId] = useState(skills[0]!.id);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]!.id);
  const selectedSkill = skills.find((item) => item.id === selectedSkillId) ?? skills[0]!;
  const orderedCategories = useMemo(
    () => [...categories].sort((left, right) => left.sortOrder - right.sortOrder),
    [categories],
  );
  const selectedCategory = orderedCategories.find((item) => item.id === selectedCategoryId) ?? orderedCategories[0]!;

  const updateSkill = (patch: Partial<EditableSkill>) => {
    setSkills((current) => current.map((item) => item.id === selectedSkill.id ? { ...item, ...patch } : item));
  };
  const updateCategory = (patch: Partial<EditableCategory>) => {
    setCategories((current) => current.map((item) => item.id === selectedCategory.id ? { ...item, ...patch } : item));
  };
  const toggleCompatibility = (value: string, checked: boolean) => {
    updateSkill({
      compatibility: checked
        ? [...new Set([...selectedSkill.compatibility, value])]
        : selectedSkill.compatibility.filter((item) => item !== value),
    });
  };
  const moveCategory = (direction: -1 | 1) => {
    const index = orderedCategories.findIndex((item) => item.id === selectedCategory.id);
    const target = orderedCategories[index + direction];
    if (!target) return;
    setCategories((current) => current.map((item) => {
      if (item.id === selectedCategory.id) return { ...item, sortOrder: target.sortOrder };
      if (item.id === target.id) return { ...item, sortOrder: selectedCategory.sortOrder };
      return item;
    }));
  };

  const previewContent = () => {
    if (!selectedSkill.name.zh.trim() || !selectedSkill.name.en.trim()) {
      onFeedback(previewText(locale, "请先补全中英文名称；本地草稿仍保留。", "Complete both names first. The local draft remains available."));
      return;
    }
    if (!validHttpsUrl(selectedSkill.sourceUrl)) {
      onFeedback(previewText(locale, "来源 URL 必须使用有效 HTTPS 格式；没有打开该地址。", "The source URL must use a valid HTTPS format. The address was not opened."));
      return;
    }
    onFeedback(previewText(
      locale,
      "已展示 Skill 内容结果；没有发布内容、核验外链或写入服务器。",
      "The Skill content result is shown. Nothing was published, no link was verified, and no server data changed.",
    ));
  };

  return (
    <section className="preview-v2-page preview-v2-skills-page">
      <PreviewSectionHeading
        icon={<PuzzlePiece aria-hidden="true" size={22} />}
        title={previewText(locale, "Skill 内容频道设计", "Skill content-channel design")}
        body={previewText(
          locale,
          "分别检查 Skill 内容与分类；Skill 不作为商品，不展示商品价格、库存或购买操作。",
          "Review Skill content and categories separately. Skills are not products and show no product price, stock, or purchase action.",
        )}
      />
      <PreviewBoundaryNote locale={locale}>
        {previewText(
          locale,
          "来源 URL 只检查 HTTPS 格式，不打开、不抓取，也不代表来源或许可证已经核验。",
          "Source URLs are checked for HTTPS syntax only. They are not opened or retrieved and do not prove source or license verification.",
        )}
      </PreviewBoundaryNote>

      <div className="preview-v2-tabs" role="tablist" aria-label={previewText(locale, "Skill 管理标签", "Skill management tabs")}>
        <button aria-selected={tab === "content"} className={tab === "content" ? "is-active" : ""} onClick={() => setTab("content")} role="tab" type="button">{previewText(locale, "Skill 内容", "Skill content")}</button>
        <button aria-selected={tab === "categories"} className={tab === "categories" ? "is-active" : ""} onClick={() => setTab("categories")} role="tab" type="button">{previewText(locale, "Skill 分类", "Skill categories")}</button>
      </div>

      {tab === "content" ? (
        <div className="preview-v2-workbench">
          <section className="admin-panel preview-v2-record-panel">
            <header className="preview-v2-list-title"><strong>{previewText(locale, "DEMO Skill", "DEMO Skills")}</strong><small>{skills.length}</small></header>
            <div className="preview-v2-record-list" role="listbox" aria-label={previewText(locale, "DEMO Skill 内容", "DEMO Skill content")}>
              {skills.map((item) => (
                <button aria-selected={item.id === selectedSkill.id} className={item.id === selectedSkill.id ? "is-selected" : ""} key={item.id} onClick={() => setSelectedSkillId(item.id)} role="option" type="button">
                  <span><PuzzlePiece aria-hidden="true" size={19} /></span>
                  <div><strong>{item.name[locale]}</strong><small>{item.id}</small></div>
                  <em>{item.license}</em>
                </button>
              ))}
            </div>
          </section>
          <section className="admin-panel preview-v2-editor-panel preview-v2-skill-editor">
            <header><div><small>{selectedSkill.id}</small><h2>{previewText(locale, "Skill 内容草稿", "Skill content draft")}</h2></div><PuzzlePiece aria-hidden="true" size={23} /></header>
            <div className="preview-v2-form-grid">
              {(["zh", "en"] as const).map((language) => (
                <fieldset key={language}>
                  <legend>{language === "zh" ? previewText(locale, "中文内容", "Chinese content") : previewText(locale, "英文内容", "English content")}</legend>
                  <label><span>{previewText(locale, "名称", "Name")}</span><input value={selectedSkill.name[language]} onChange={(event) => updateSkill({ name: { ...selectedSkill.name, [language]: event.target.value } })} /></label>
                  <label><span>{previewText(locale, "摘要", "Summary")}</span><textarea value={selectedSkill.summary[language]} onChange={(event) => updateSkill({ summary: { ...selectedSkill.summary, [language]: event.target.value } })} /></label>
                </fieldset>
              ))}
            </div>
            <div className="preview-v2-skill-meta">
              <label className="is-wide"><span>{previewText(locale, "来源 URL", "Source URL")}</span><div><LinkSimple aria-hidden="true" size={17} /><input aria-invalid={!validHttpsUrl(selectedSkill.sourceUrl)} value={selectedSkill.sourceUrl} onChange={(event) => updateSkill({ sourceUrl: event.target.value })} /></div><small>{previewText(locale, "只检查 HTTPS 格式，不打开链接", "HTTPS syntax only; the link is not opened")}</small></label>
              <label><span>{previewText(locale, "分类", "Category")}</span><select value={selectedSkill.categoryId} onChange={(event) => updateSkill({ categoryId: event.target.value })}>{orderedCategories.map((category) => <option key={category.id} value={category.id}>{category.name[locale]}</option>)}</select></label>
              <label><span>{previewText(locale, "许可证声明", "License declaration")}</span><select value={selectedSkill.license} onChange={(event) => updateSkill({ license: event.target.value as EditableSkill["license"] })}><option>MIT</option><option>Apache-2.0</option><option>Commercial</option><option>Custom</option></select><small>{previewText(locale, "DEMO 声明，未做法律核验", "DEMO declaration; not legally verified")}</small></label>
            </div>
            <fieldset className="preview-v2-compatibility">
              <legend>{previewText(locale, "兼容环境（可多选）", "Compatibility (select multiple)")}</legend>
              {compatibilityOptions.map((item) => <label key={item}><input checked={selectedSkill.compatibility.includes(item)} onChange={(event) => toggleCompatibility(item, event.target.checked)} type="checkbox" /><span>{item}</span></label>)}
            </fieldset>
            <footer className="preview-v2-editor-actions"><button className="admin-primary" onClick={previewContent} type="button"><ShieldCheck aria-hidden="true" size={17} />{previewText(locale, "预览内容结果", "Preview content result")}</button></footer>
          </section>
        </div>
      ) : (
        <div className="preview-v2-workbench">
          <section className="admin-panel preview-v2-record-panel">
            <header className="preview-v2-list-title"><strong>{previewText(locale, "DEMO 分类", "DEMO categories")}</strong><small>{orderedCategories.length}</small></header>
            <div className="preview-v2-record-list" role="listbox" aria-label={previewText(locale, "DEMO Skill 分类", "DEMO Skill categories")}>
              {orderedCategories.map((item) => (
                <button aria-selected={item.id === selectedCategory.id} className={item.id === selectedCategory.id ? "is-selected" : ""} key={item.id} onClick={() => setSelectedCategoryId(item.id)} role="option" type="button">
                  <span><FolderSimple aria-hidden="true" size={19} /></span><div><strong>{item.name[locale]}</strong><small>{item.id}</small></div><em>{String(item.sortOrder).padStart(2, "0")}</em>
                </button>
              ))}
            </div>
          </section>
          <section className="admin-panel preview-v2-editor-panel">
            <header><div><small>{selectedCategory.id}</small><h2>{previewText(locale, "分类草稿", "Category draft")}</h2></div><FolderSimple aria-hidden="true" size={23} /></header>
            <div className="preview-v2-form-grid">
              <label><span>{previewText(locale, "中文名称", "Chinese name")}</span><input value={selectedCategory.name.zh} onChange={(event) => updateCategory({ name: { ...selectedCategory.name, zh: event.target.value } })} /></label>
              <label><span>{previewText(locale, "英文名称", "English name")}</span><input value={selectedCategory.name.en} onChange={(event) => updateCategory({ name: { ...selectedCategory.name, en: event.target.value } })} /></label>
            </div>
            <div className="preview-v2-sort-actions">
              <button className="admin-secondary" disabled={orderedCategories[0]?.id === selectedCategory.id} onClick={() => moveCategory(-1)} type="button"><ArrowUp aria-hidden="true" size={17} />{previewText(locale, "上移", "Move up")}</button>
              <button className="admin-secondary" disabled={orderedCategories.at(-1)?.id === selectedCategory.id} onClick={() => moveCategory(1)} type="button"><ArrowDown aria-hidden="true" size={17} />{previewText(locale, "下移", "Move down")}</button>
            </div>
            <footer className="preview-v2-editor-actions"><button className="admin-primary" onClick={() => onFeedback(previewText(locale, "已展示分类排列；没有保存或发布分类。", "The category order is shown. No category was saved or published."))} type="button"><ShieldCheck aria-hidden="true" size={17} />{previewText(locale, "预览分类结果", "Preview category result")}</button></footer>
          </section>
        </div>
      )}
    </section>
  );
}
