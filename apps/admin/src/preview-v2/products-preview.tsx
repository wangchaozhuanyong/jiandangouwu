import {
  CheckSquare,
  Cube,
  MagnifyingGlass,
  SquaresFour,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import {
  previewPrimaryCategories,
  previewProductPlacements,
  previewProducts,
  previewSecondaryCategories,
  type PreviewProduct,
  type ProductPlacementId,
} from "./preview-fixtures";
import type { PreviewLocale } from "./preview-model";
import {
  PreviewBoundaryNote,
  PreviewSectionHeading,
  previewText,
} from "./preview-components";

type EditableProduct = Omit<PreviewProduct, "placements"> & {
  placements: ProductPlacementId[];
};

const productDrafts = (): EditableProduct[] => previewProducts.map((item) => ({
  ...item,
  placements: [...item.placements],
}));

export default function ProductsPreview({
  locale,
  onFeedback,
}: {
  locale: PreviewLocale;
  onFeedback: (message: string) => void;
}) {
  const [items, setItems] = useState<EditableProduct[]>(productDrafts);
  const [selectedId, setSelectedId] = useState(items[0]!.id);
  const [query, setQuery] = useState("");
  const selected = items.find((item) => item.id === selectedId) ?? items[0]!;
  const selectedPrimary = previewPrimaryCategories.find((category) => category.id === selected.primaryCategoryId) ?? previewPrimaryCategories[0]!;
  const availableSecondaryCategories = previewSecondaryCategories.filter((category) => category.parentId === selectedPrimary.id);
  const selectedSecondary = previewSecondaryCategories.find((category) => category.id === selected.secondaryCategoryId) ?? availableSecondaryCategories[0]!;
  const visible = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    if (!keyword) return items;
    return items.filter((item) => (
      item.id.toLocaleLowerCase().includes(keyword)
      || item.name.zh.toLocaleLowerCase().includes(keyword)
      || item.name.en.toLocaleLowerCase().includes(keyword)
    ));
  }, [items, query]);

  const updatePlacements = (placement: ProductPlacementId, checked: boolean) => {
    setItems((current) => current.map((item) => item.id === selected.id
      ? {
          ...item,
          placements: checked
            ? [...new Set([...item.placements, placement])]
            : item.placements.filter((value) => value !== placement),
        }
      : item));
  };

  const updatePrimaryCategory = (primaryCategoryId: string) => {
    const nextSecondary = previewSecondaryCategories.find((category) => category.parentId === primaryCategoryId);
    if (!nextSecondary) return;
    setItems((current) => current.map((item) => item.id === selected.id
      ? { ...item, primaryCategoryId, secondaryCategoryId: nextSecondary.id }
      : item));
  };

  const updateSecondaryCategory = (secondaryCategoryId: string) => {
    const nextSecondary = previewSecondaryCategories.find((category) => category.id === secondaryCategoryId);
    if (!nextSecondary) return;
    setItems((current) => current.map((item) => item.id === selected.id
      ? { ...item, primaryCategoryId: nextSecondary.parentId, secondaryCategoryId }
      : item));
  };

  const resetSelected = () => {
    const source = previewProducts.find((item) => item.id === selected.id);
    if (!source) return;
    setItems((current) => current.map((item) => item.id === source.id
      ? { ...source, placements: [...source.placements] }
      : item));
    onFeedback(previewText(
      locale,
      "已恢复此商品的 DEMO 初始状态；服务器数据未改变。",
      "This product returned to its initial DEMO state. Server data is unchanged.",
    ));
  };

  return (
    <section className="preview-v2-page preview-v2-products-page">
      <PreviewSectionHeading
        icon={<Cube aria-hidden="true" size={22} />}
        title={previewText(locale, "商品展示页面规划", "Product display-page planning")}
        body={previewText(
          locale,
          "为每个 DEMO 商品多选展示页面，检查内容分发界面，不创建正式商品或页面。",
          "Choose multiple display pages for each DEMO product and review distribution without creating a live product or page.",
        )}
      />
      <PreviewBoundaryNote locale={locale}>
        {previewText(
          locale,
          "Skill 推荐是独立内容频道，不属于商品展示页面，也不会携带商品价格或库存。",
          "Skill recommendations are a separate content channel, not a product surface, and carry no product price or stock.",
        )}
      </PreviewBoundaryNote>

      <div className="preview-v2-workbench">
        <section className="admin-panel preview-v2-record-panel">
          <div className="preview-v2-panel-toolbar">
            <label className="preview-v2-search">
              <MagnifyingGlass aria-hidden="true" size={17} />
              <span className="sr-only">{previewText(locale, "搜索 DEMO 商品", "Search DEMO products")}</span>
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder={previewText(locale, "搜索名称或 DEMO 编号", "Search name or DEMO ID")}
                value={query}
              />
            </label>
            <span>{previewText(locale, `${visible.length} 条示例`, `${visible.length} samples`)}</span>
          </div>
          <div className="preview-v2-record-list" role="listbox" aria-label={previewText(locale, "DEMO 商品", "DEMO products")}>
            {visible.map((item) => (
              <button
                aria-selected={item.id === selected.id}
                className={item.id === selected.id ? "is-selected" : ""}
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                role="option"
                type="button"
              >
                <span><Cube aria-hidden="true" size={19} /></span>
                <div>
                  <strong>{item.name[locale]}</strong>
                  <small>{item.id}</small>
                </div>
                <em>{item.placements.length}</em>
              </button>
            ))}
            {visible.length === 0 && (
              <p role="status">{previewText(locale, "没有匹配的 DEMO 商品。", "No DEMO product matches this search.")}</p>
            )}
          </div>
        </section>

        <section className="admin-panel preview-v2-editor-panel">
          <header>
            <div>
              <small>{selected.id}</small>
              <h2>{selected.name[locale]}</h2>
              <p>{selectedPrimary.name[locale]} / {selectedSecondary.name[locale]} · {selected.price} · {selected.stock}</p>
            </div>
            <span><SquaresFour aria-hidden="true" size={22} /></span>
          </header>
          <fieldset className="preview-v2-category-cascade">
            <legend>{previewText(locale, "商品分类（最终归属二级分类）", "Product category (saved to a secondary category)")}</legend>
            <label>
              <span>{previewText(locale, "一级分类", "Primary category")}</span>
              <select onChange={(event) => updatePrimaryCategory(event.target.value)} value={selectedPrimary.id}>
                {previewPrimaryCategories.map((category) => <option key={category.id} value={category.id}>{category.name[locale]}</option>)}
              </select>
            </label>
            <label>
              <span>{previewText(locale, "二级分类", "Secondary category")}</span>
              <select onChange={(event) => updateSecondaryCategory(event.target.value)} value={selectedSecondary.id}>
                {availableSecondaryCategories.map((category) => <option key={category.id} value={category.id}>{category.name[locale]}</option>)}
              </select>
            </label>
            <small>{previewText(locale, "先选一级，再选二级；不支持三级分类。这里只更新 React 内存。", "Choose a primary category first, then a secondary category. Third-level categories are not supported. This only updates React memory.")}</small>
          </fieldset>
          <fieldset className="preview-v2-check-grid">
            <legend>{previewText(locale, "展示页面（可多选）", "Display pages (select multiple)")}</legend>
            {previewProductPlacements.map((placement) => {
              const checked = selected.placements.includes(placement.id);
              return (
                <label className={checked ? "is-selected" : ""} key={placement.id}>
                  <input
                    checked={checked}
                    onChange={(event) => updatePlacements(placement.id, event.target.checked)}
                    type="checkbox"
                  />
                  <CheckSquare aria-hidden="true" size={20} weight={checked ? "fill" : "regular"} />
                  <span><strong>{placement.label[locale]}</strong><small>{placement.path}</small></span>
                </label>
              );
            })}
          </fieldset>
          <div className="preview-v2-impact-card">
            <strong>{previewText(locale, "当前本地分发预览", "Current local distribution preview")}</strong>
            <p>
              {selected.placements.length > 0
                ? selected.placements.map((id) => previewProductPlacements.find((placement) => placement.id === id)?.label[locale]).filter(Boolean).join(" · ")
                : previewText(locale, "未选择展示页面；只展示本地空分发状态。", "No display page is selected; only the local empty-distribution state is shown.")}
            </p>
          </div>
          <footer className="preview-v2-editor-actions">
            <button className="admin-secondary" onClick={resetSelected} type="button">
              {previewText(locale, "恢复 DEMO 初始值", "Reset DEMO values")}
            </button>
            <button
              className="admin-primary"
              onClick={() => onFeedback(previewText(
                locale,
                "界面校验完成，未保存服务器数据。商品最终只归属所选二级分类。",
                "Interface validation completed. Server data was not saved. The product belongs only to the selected secondary category.",
              ))}
              type="button"
            >
              <SquaresFour aria-hidden="true" size={17} />
              {previewText(locale, "预览展示结果", "Preview display result")}
            </button>
          </footer>
        </section>
      </div>
    </section>
  );
}
