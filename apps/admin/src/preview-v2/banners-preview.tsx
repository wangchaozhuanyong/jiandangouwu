import {
  ArrowDown,
  ArrowUp,
  Desktop,
  ImageSquare,
  MonitorPlay,
  Phone,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import {
  previewBanners,
  type BannerPlacementId,
  type BannerTargetType,
  type PreviewBanner,
} from "./preview-fixtures";
import type { PreviewLocale } from "./preview-model";
import {
  PreviewBoundaryNote,
  PreviewSectionHeading,
  PreviewToggle,
  previewText,
} from "./preview-components";

type EditableBanner = Omit<PreviewBanner, "title" | "body" | "action"> & {
  title: { zh: string; en: string };
  body: { zh: string; en: string };
  action: { zh: string; en: string };
};

const bannerDrafts = (): EditableBanner[] => previewBanners.map((item) => ({
  ...item,
  title: { ...item.title },
  body: { ...item.body },
  action: { ...item.action },
}));

const placements: Array<{ id: BannerPlacementId; zh: string; en: string }> = [
  { id: "HOME", zh: "首页广告", en: "Home ads" },
  { id: "TRANSIT_SUBSCRIPTIONS", zh: "中转站广告", en: "Transit subscription ads" },
  { id: "AI_RECHARGE", zh: "AI 代充广告", en: "AI recharge ads" },
];

const targetTypes: Array<{ id: BannerTargetType; zh: string; en: string }> = [
  { id: "NONE", zh: "无跳转", en: "No destination" },
  { id: "PRODUCT", zh: "商品", en: "Product" },
  { id: "CATEGORY", zh: "分类", en: "Category" },
  { id: "EXTERNAL", zh: "HTTPS 外链", en: "HTTPS link" },
];

export default function BannersPreview({
  locale,
  onFeedback,
}: {
  locale: PreviewLocale;
  onFeedback: (message: string) => void;
}) {
  const [items, setItems] = useState<EditableBanner[]>(bannerDrafts);
  const [placement, setPlacement] = useState<BannerPlacementId>("HOME");
  const visible = useMemo(
    () => items.filter((item) => item.placement === placement).sort((left, right) => left.sortOrder - right.sortOrder),
    [items, placement],
  );
  const [selectedByPlacement, setSelectedByPlacement] = useState<Record<BannerPlacementId, string>>({
    HOME: "DEMO-AD-HOME-001",
    TRANSIT_SUBSCRIPTIONS: "DEMO-AD-TRANSIT-001",
    AI_RECHARGE: "DEMO-AD-AI-RECHARGE-001",
  });
  const selected = visible.find((item) => item.id === selectedByPlacement[placement]) ?? visible[0]!;

  const updateSelected = (patch: Partial<EditableBanner>) => {
    setItems((current) => current.map((item) => item.id === selected.id ? { ...item, ...patch } : item));
  };

  const updateLocalized = (
    field: "title" | "body" | "action",
    language: PreviewLocale,
    value: string,
  ) => updateSelected({ [field]: { ...selected[field], [language]: value } });

  const moveSelected = (direction: -1 | 1) => {
    const index = visible.findIndex((item) => item.id === selected.id);
    const target = visible[index + direction];
    if (!target) return;
    setItems((current) => current.map((item) => {
      if (item.id === selected.id) return { ...item, sortOrder: target.sortOrder };
      if (item.id === target.id) return { ...item, sortOrder: selected.sortOrder };
      return item;
    }));
  };

  const selectPlacement = (next: BannerPlacementId) => {
    setPlacement(next);
    onFeedback("");
  };

  return (
    <section className="preview-v2-page preview-v2-banners-page">
      <PreviewSectionHeading
        icon={<ImageSquare aria-hidden="true" size={22} />}
        title={previewText(locale, "广告内容与版位预览", "Advertising content and placement preview")}
        body={previewText(
          locale,
          "在三个内容标签中检查双语广告、目标类型、开关、排序以及桌面与移动端画面。",
          "Review bilingual ads, destination types, switches, ordering, and desktop/mobile treatments across three content tabs.",
        )}
      />
      <PreviewBoundaryNote locale={locale}>
        {previewText(
          locale,
          "外链只展示地址格式，不打开页面；开关和排序只改变当前标签页内存。",
          "Links are displayed for format review only and are never opened. Switches and ordering change current-tab memory only.",
        )}
      </PreviewBoundaryNote>

      <div className="preview-v2-tabs" role="tablist" aria-label={previewText(locale, "广告类型", "Ad types")}>
        {placements.map((item) => (
          <button
            aria-selected={placement === item.id}
            className={placement === item.id ? "is-active" : ""}
            key={item.id}
            onClick={() => selectPlacement(item.id)}
            role="tab"
            type="button"
          >
            {item[locale]}
          </button>
        ))}
      </div>

      <div className="preview-v2-banner-layout">
        <section className="admin-panel preview-v2-banner-list">
          <header><strong>{placements.find((item) => item.id === placement)?.[locale]}</strong><small>{previewText(locale, "DEMO 排序", "DEMO order")}</small></header>
          {visible.map((item, index) => (
            <button
              aria-pressed={item.id === selected.id}
              className={item.id === selected.id ? "is-selected" : ""}
              key={item.id}
              onClick={() => setSelectedByPlacement((current) => ({ ...current, [placement]: item.id }))}
              type="button"
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{item.title[locale]}</strong><small>{item.id}</small></div>
              <em>{item.enabled ? previewText(locale, "示例开启", "Sample on") : previewText(locale, "示例关闭", "Sample off")}</em>
            </button>
          ))}
          <div className="preview-v2-sort-actions">
            <button className="admin-secondary" disabled={visible[0]?.id === selected.id} onClick={() => moveSelected(-1)} type="button"><ArrowUp aria-hidden="true" size={17} />{previewText(locale, "上移", "Move up")}</button>
            <button className="admin-secondary" disabled={visible.at(-1)?.id === selected.id} onClick={() => moveSelected(1)} type="button"><ArrowDown aria-hidden="true" size={17} />{previewText(locale, "下移", "Move down")}</button>
          </div>
        </section>

        <section className="admin-panel preview-v2-banner-editor">
          <header><div><small>{selected.id}</small><h2>{previewText(locale, "广告内容草稿", "Ad content draft")}</h2></div><MonitorPlay aria-hidden="true" size={23} /></header>
          <div className="preview-v2-form-grid">
            {(["zh", "en"] as const).map((language) => (
              <fieldset key={language}>
                <legend>{language === "zh" ? previewText(locale, "中文内容", "Chinese content") : previewText(locale, "英文内容", "English content")}</legend>
                <label><span>{previewText(locale, "标题", "Title")}</span><input value={selected.title[language]} onChange={(event) => updateLocalized("title", language, event.target.value)} /></label>
                <label><span>{previewText(locale, "说明", "Body")}</span><textarea value={selected.body[language]} onChange={(event) => updateLocalized("body", language, event.target.value)} /></label>
                <label><span>{previewText(locale, "行动文字", "Action label")}</span><input value={selected.action[language]} onChange={(event) => updateLocalized("action", language, event.target.value)} /></label>
              </fieldset>
            ))}
          </div>
          <div className="preview-v2-banner-controls">
            <label><span>{previewText(locale, "目标类型", "Destination type")}</span><select value={selected.targetType} onChange={(event) => updateSelected({ targetType: event.target.value as BannerTargetType })}>{targetTypes.map((item) => <option key={item.id} value={item.id}>{item[locale]}</option>)}</select></label>
            <label><span>{previewText(locale, "目标值", "Destination value")}</span><input disabled={selected.targetType === "NONE"} value={selected.targetValue} onChange={(event) => updateSelected({ targetValue: event.target.value })} /></label>
            <PreviewToggle
              checked={selected.enabled}
              description={previewText(locale, "只控制当前 DEMO 广告状态", "Controls this DEMO ad only")}
              label={previewText(locale, "广告示例开关", "Sample ad switch")}
              onChange={(enabled) => updateSelected({ enabled })}
            />
          </div>
        </section>
      </div>

      <section className="preview-v2-device-preview" aria-label={previewText(locale, "桌面和移动端广告预览", "Desktop and mobile ad previews")}>
        <article className={`is-${selected.tone}`}>
          <header><Desktop aria-hidden="true" size={18} /><span>{previewText(locale, "桌面预览", "Desktop preview")}</span></header>
          <div><small>{selected.id}</small><h3>{selected.title[locale]}</h3><p>{selected.body[locale]}</p><button type="button">{selected.action[locale]}</button></div>
        </article>
        <article className={`is-${selected.tone} is-mobile`}>
          <header><Phone aria-hidden="true" size={18} /><span>{previewText(locale, "移动端预览", "Mobile preview")}</span></header>
          <div><small>{selected.id}</small><h3>{selected.title[locale]}</h3><p>{selected.body[locale]}</p><button type="button">{selected.action[locale]}</button></div>
        </article>
      </section>

      <div className="preview-v2-editor-actions">
        <button
          className="admin-primary"
          onClick={() => onFeedback(previewText(
            locale,
            "已更新本地广告画面；没有保存、发布或打开任何目标。",
            "The local ad treatment is updated. Nothing was saved, published, or opened.",
          ))}
          type="button"
        >
          <MonitorPlay aria-hidden="true" size={17} />
          {previewText(locale, "预览广告结果", "Preview ad result")}
        </button>
      </div>
    </section>
  );
}
