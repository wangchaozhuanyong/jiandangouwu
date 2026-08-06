import {
  ArrowLeft,
  CaretRight,
  Cube,
  GearSix,
  ImageSquare,
  List,
  PuzzlePiece,
  ShieldCheck,
  TreeStructure,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import BannersPreview from "./banners-preview";
import CategoriesPreview from "./categories-preview";
import {
  PreviewScenarioBar,
  PreviewScenarioSurface,
  PreviewTruthBanner,
  previewText,
} from "./preview-components";
import {
  matchPreviewV2Route,
  previewV2PagePath,
  type PreviewLocale,
  type PreviewScenario,
  type PreviewV2PageId,
} from "./preview-model";
import ProductsPreview from "./products-preview";
import SettingsPreview from "./settings-preview";
import SkillsPreview from "./skills-preview";
import "./preview-v2.css";

const previewNavigation: Array<{
  id: PreviewV2PageId;
  icon: typeof Cube;
  zh: string;
  en: string;
}> = [
  { id: "products", icon: Cube, zh: "商品展示", en: "Product display" },
  { id: "categories", icon: TreeStructure, zh: "商品分类", en: "Product categories" },
  { id: "banners", icon: ImageSquare, zh: "广告内容", en: "Advertising" },
  { id: "skills", icon: PuzzlePiece, zh: "Skill 内容", en: "Skill content" },
  { id: "settings", icon: GearSix, zh: "网站开关", en: "Site switches" },
];

export default function PreviewV2App({
  initialLocale,
  initialPageId,
  sessionDisplayName,
}: {
  initialLocale: PreviewLocale;
  initialPageId: PreviewV2PageId;
  sessionDisplayName: string;
}) {
  const [locale, setLocale] = useState<PreviewLocale>(initialLocale);
  const [pageId, setPageId] = useState<PreviewV2PageId>(initialPageId);
  const [scenario, setScenario] = useState<PreviewScenario>("ready");
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const activePage = previewNavigation.find((item) => item.id === pageId)!;

  useEffect(() => {
    const onPopState = () => {
      const route = matchPreviewV2Route(window.location.pathname);
      if (route.pageId) {
        setPageId(route.pageId);
        setScenario("ready");
        setFeedback("");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.title = `${activePage[locale]} · ${previewText(locale, "V2 界面预览", "V2 interface preview")}`;
  }, [activePage, locale]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("keydown", closeFromKeyboard);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const go = (next: PreviewV2PageId) => {
    if (next === pageId) {
      setMenuOpen(false);
      return;
    }
    window.history.pushState({ previewV2Page: next }, "", previewV2PagePath(next));
    setPageId(next);
    setScenario("ready");
    setFeedback("");
    setMenuOpen(false);
  };

  const setPreviewScenario = (next: PreviewScenario) => {
    setScenario(next);
    setFeedback("");
  };

  return (
    <div className="admin-shell admin-preview-v2">
      <aside className={menuOpen ? "is-open" : ""}>
        <div className="admin-brand preview-v2-brand">
          <span><img alt="" height={176} src="/assets/cloudbridge-logo.png" width={349} /></span>
          <div><strong>{previewText(locale, "云桥", "CloudBridge")}</strong><small>V2 · DEMO</small></div>
          <button className="mobile-close" onClick={() => { setMenuOpen(false); menuButtonRef.current?.focus(); }} aria-label={previewText(locale, "关闭预览导航", "Close preview navigation")} type="button"><X aria-hidden="true" /></button>
        </div>
        <nav aria-label={previewText(locale, "V2 预览导航", "V2 preview navigation")}>
          {previewNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                aria-current={pageId === item.id ? "page" : undefined}
                className={`admin-nav-link${pageId === item.id ? " is-active" : ""}`}
                key={item.id}
                onClick={() => go(item.id)}
                type="button"
              >
                <Icon aria-hidden="true" size={18} weight={pageId === item.id ? "fill" : "regular"} />
                <span>{item[locale]}</span>
                <CaretRight aria-hidden="true" size={13} />
              </button>
            );
          })}
        </nav>
        <div className="preview-v2-session">
          <ShieldCheck aria-hidden="true" size={20} />
          <span><strong>{sessionDisplayName}</strong><small>{previewText(locale, "真实会话后进入", "Entered after a real session")}</small></span>
        </div>
        <a className="preview-v2-return-link" href="/admin/dashboard"><ArrowLeft aria-hidden="true" size={17} />{previewText(locale, "返回正式后台", "Return to live admin")}</a>
      </aside>
      {menuOpen && <button className="nav-backdrop" onClick={() => { setMenuOpen(false); menuButtonRef.current?.focus(); }} aria-label={previewText(locale, "关闭预览导航", "Close preview navigation")} type="button" />}
      <section className="admin-main" ref={mainRef}>
        <header className="admin-topbar">
          <button ref={menuButtonRef} className="mobile-menu" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-label={previewText(locale, "打开预览导航", "Open preview navigation")} type="button"><List aria-hidden="true" /></button>
          <div className="admin-page-title"><h1>{activePage[locale]}</h1></div>
          <div className="admin-language" aria-label={previewText(locale, "预览语言切换", "Preview language switch")}>
            <button className={locale === "zh" ? "is-active" : ""} onClick={() => setLocale("zh")} type="button">中</button>
            <span />
            <button className={locale === "en" ? "is-active" : ""} onClick={() => setLocale("en")} type="button">EN</button>
          </div>
        </header>
        <main className="admin-content">
          <PreviewTruthBanner locale={locale} />
          <PreviewScenarioBar locale={locale} onChange={setPreviewScenario} scenario={scenario} />
          <PreviewScenarioSurface locale={locale} onReady={() => setPreviewScenario("ready")} scenario={scenario}>
            {pageId === "products" && <ProductsPreview locale={locale} onFeedback={setFeedback} />}
            {pageId === "categories" && <CategoriesPreview locale={locale} onFeedback={setFeedback} />}
            {pageId === "banners" && <BannersPreview locale={locale} onFeedback={setFeedback} />}
            {pageId === "skills" && <SkillsPreview locale={locale} onFeedback={setFeedback} />}
            {pageId === "settings" && <SettingsPreview locale={locale} onFeedback={setFeedback} />}
          </PreviewScenarioSurface>
        </main>
      </section>
      <div className={`preview-v2-feedback${feedback ? " is-visible" : ""}`} role="status" aria-live="polite">
        <ShieldCheck aria-hidden="true" size={18} />
        <span>{feedback}</span>
        {feedback && <button aria-label={previewText(locale, "关闭预览反馈", "Dismiss preview feedback")} onClick={() => setFeedback("")} type="button"><X aria-hidden="true" size={16} /></button>}
      </div>
    </div>
  );
}
