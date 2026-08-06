"use client";

import type { ContactChannelType, Locale } from "@cloudbridge/contracts";
import {
  ArrowLeft,
  ArrowRight,
  Bridge,
  CaretDown,
  Check,
  CheckCircle,
  Clock,
  Code,
  Compass,
  CopySimple,
  CurrencyCircleDollar,
  GithubLogo,
  GlobeHemisphereWest,
  Headset,
  ImageSquare,
  MagnifyingGlass,
  Package,
  Plug,
  PuzzlePiece,
  Receipt,
  ShareNetwork,
  ShieldCheck,
  ShoppingCartSimple,
  Sparkle,
  Stack,
  UsersThree,
  WarningCircle,
  WifiSlash,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ContactChannelPicker } from "../contact-channel-picker";
import { ResilientImage } from "../resilient-image";
import { CurrencyPicker } from "../storefront-controls";
import {
  PREVIEW_DEMO_CHANNELS,
  PREVIEW_HEROES,
  PREVIEW_ORDER_LOOKUP,
  PREVIEW_ORDER_LOOKUPS,
  PREVIEW_PRIMARY_CATEGORIES,
  PREVIEW_PRODUCTS,
  PREVIEW_SECONDARY_CATEGORIES,
  PREVIEW_SKILL_CATEGORIES,
  PREVIEW_SKILLS,
  PREVIEW_VALIDATION_NOTICE,
  previewProductBySlug,
  previewSkillBySlug,
  type PreviewDataState,
  type PreviewHero,
  type PreviewHeroMode,
  type PreviewOrderLookup,
  type PreviewProduct,
  type PreviewPrimaryCategoryKey,
  type PreviewSecondaryCategoryKey,
  type PreviewSkill,
  type PreviewSurface,
} from "../../lib/v2-preview-data";
import { PreviewCartPage } from "./preview-cart";
import { useV2PreviewShell } from "./preview-shell";

const commonCopy = {
  zh: {
    previewControls: "预览状态",
    previewControlsHint: "这些控制只改变当前页面内存，用于检查设计状态。",
    heroMode: "广告状态",
    dataState: "内容状态",
    heroOff: "关闭",
    heroSingle: "单张",
    heroMultiple: "多张",
    ready: "正常",
    loading: "加载中",
    empty: "空数据",
    error: "请求失败",
    offline: "离线",
    imageError: "图片失败",
    imageUnavailable: "图片暂时无法显示",
    loadingTitle: "正在整理模拟内容",
    loadingBody: "该状态不会发起业务请求，也不会自动变成成功。",
    emptyTitle: "当前没有可展示内容",
    emptyBody: "这是明确的空状态，不会用 0 或虚构记录代替未知数据。",
    errorTitle: "模拟读取未完成",
    errorBody: "这是界面错误状态，没有改动任何服务器数据。",
    offlineTitle: "当前处于离线预览",
    offlineBody: "恢复连接后可重新查看；本地输入不会保存。",
    retryPreview: "返回正常状态",
    search: "搜索",
    searchPlaceholder: "输入名称或关键词",
    currency: "显示币种",
    all: "全部",
    available: "可办理",
    paused: "暂停办理",
    low: (count: number) => `仅余 ${count} 个办理名额`,
    currentPrice: "模拟当前价格",
    reference: "参考换算",
    view: "查看详情",
    noResults: "没有找到匹配内容",
    noResultsBody: "尝试缩短关键词，或切换其他分类。",
    clear: "清除筛选",
    previous: "上一张",
    next: "下一张",
    slide: (index: number) => `查看第 ${index} 张广告`,
    mockPrice: "DEMO 价格，不构成报价",
  },
  en: {
    previewControls: "Preview states",
    previewControlsHint: "These controls change in-memory UI only and help inspect design states.",
    heroMode: "Banner state",
    dataState: "Content state",
    heroOff: "Off",
    heroSingle: "Single",
    heroMultiple: "Multiple",
    ready: "Ready",
    loading: "Loading",
    empty: "Empty",
    error: "Error",
    offline: "Offline",
    imageError: "Image error",
    imageUnavailable: "Image unavailable",
    loadingTitle: "Preparing mock content",
    loadingBody: "This state makes no business request and does not auto-resolve into success.",
    emptyTitle: "There is no content to display",
    emptyBody: "This is an explicit empty state. Unknown data is never replaced with zero or invented records.",
    errorTitle: "Mock read did not complete",
    errorBody: "This is an interface error state. No server data was changed.",
    offlineTitle: "This preview is offline",
    offlineBody: "Reconnect to view it again. Local input is not saved.",
    retryPreview: "Return to ready",
    search: "Search",
    searchPlaceholder: "Search by name or keyword",
    currency: "Display currency",
    all: "All",
    available: "Available",
    paused: "Paused",
    low: (count: number) => `Only ${count} service slots left`,
    currentPrice: "Mock current price",
    reference: "Reference",
    view: "View details",
    noResults: "No matching content",
    noResultsBody: "Try a shorter keyword or another category.",
    clear: "Clear filters",
    previous: "Previous slide",
    next: "Next slide",
    slide: (index: number) => `View banner ${index}`,
    mockPrice: "DEMO price, not a live quote",
  },
} as const;

function replacePreviewQuery(input: Record<string, string>) {
  const next = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(input)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  const query = next.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
}

function PreviewScenarioBar({
  dataState,
  heroMode,
  locale,
  onDataStateChange,
  onHeroModeChange,
  showHero = true,
}: {
  dataState: PreviewDataState;
  heroMode: PreviewHeroMode;
  locale: Locale;
  onDataStateChange: (value: PreviewDataState) => void;
  onHeroModeChange: (value: PreviewHeroMode) => void;
  showHero?: boolean;
}) {
  const t = commonCopy[locale];
  const heroStateLabel = heroMode === "off" ? t.heroOff : heroMode === "single" ? t.heroSingle : t.heroMultiple;
  const dataStateLabel = {
    ready: t.ready,
    loading: t.loading,
    empty: t.empty,
    error: t.error,
    offline: t.offline,
    "image-error": t.imageError,
  }[dataState];

  return (
    <section aria-label={t.previewControls} className="v2-preview-scenario">
      <details>
        <summary>
          <i aria-hidden="true" />
          <strong>{t.previewControls}</strong>
          <small>{showHero ? `${heroStateLabel} · ${dataStateLabel}` : dataStateLabel}</small>
          <CaretDown aria-hidden="true" size={15} />
        </summary>
        <div>
          <p>{t.previewControlsHint}</p>
          {showHero && (
            <label>
              <span>{t.heroMode}</span>
              <select onChange={(event) => onHeroModeChange(event.target.value as PreviewHeroMode)} value={heroMode}>
                <option value="off">{t.heroOff}</option>
                <option value="single">{t.heroSingle}</option>
                <option value="multiple">{t.heroMultiple}</option>
              </select>
            </label>
          )}
          <label>
            <span>{t.dataState}</span>
            <select onChange={(event) => onDataStateChange(event.target.value as PreviewDataState)} value={dataState}>
              <option value="ready">{t.ready}</option>
              <option value="loading">{t.loading}</option>
              <option value="empty">{t.empty}</option>
              <option value="error">{t.error}</option>
              <option value="offline">{t.offline}</option>
              <option value="image-error">{t.imageError}</option>
            </select>
          </label>
        </div>
      </details>
    </section>
  );
}

function PreviewState({
  children,
  locale,
  onReady,
  state,
}: {
  children: React.ReactNode;
  locale: Locale;
  onReady: () => void;
  state: PreviewDataState;
}) {
  const t = commonCopy[locale];
  if (state === "ready" || state === "image-error") return <>{children}</>;

  const content = state === "loading"
    ? { icon: <Stack aria-hidden="true" size={25} />, title: t.loadingTitle, body: t.loadingBody }
    : state === "empty"
      ? { icon: <Package aria-hidden="true" size={25} />, title: t.emptyTitle, body: t.emptyBody }
      : state === "offline"
        ? { icon: <WifiSlash aria-hidden="true" size={25} />, title: t.offlineTitle, body: t.offlineBody }
        : { icon: <WarningCircle aria-hidden="true" size={25} />, title: t.errorTitle, body: t.errorBody };

  return (
    <div aria-busy={state === "loading"} className={`v2-preview-state is-${state}`} role={state === "error" ? "alert" : "status"}>
      <span>{content.icon}</span>
      <h3>{content.title}</h3>
      <p>{content.body}</p>
      {state !== "loading" && <button onClick={onReady} type="button">{t.retryPreview}</button>}
    </div>
  );
}

function PreviewHeroCarousel({ locale, mode, surface }: { locale: Locale; mode: PreviewHeroMode; surface: PreviewSurface }) {
  const t = commonCopy[locale];
  const matching = PREVIEW_HEROES.filter((item) => item.surface === surface);
  const fallback = PREVIEW_HEROES.filter((item) => item.surface === "HOME");
  const slides = mode === "multiple"
    ? (matching.length > 1 ? matching : [...matching, ...fallback.slice(0, Math.max(0, 2 - matching.length))])
    : matching.slice(0, 1);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const pointerStart = useRef<number | null>(null);

  useEffect(() => setIndex(0), [mode, surface]);

  useEffect(() => {
    if (mode !== "multiple" || paused || slides.length < 2) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), 6200);
    return () => window.clearInterval(timer);
  }, [mode, paused, slides.length]);

  if (mode === "off" || !slides.length) return null;
  const active = slides[index] ?? slides[0];
  if (!active) return null;

  const change = (next: number) => setIndex((next + slides.length) % slides.length);
  return (
    <section
      aria-label={locale === "zh" ? "专题广告" : "Featured banners"}
      className="v2-preview-hero"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      onFocus={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerCancel={() => { pointerStart.current = null; }}
      onPointerDown={(event) => { pointerStart.current = event.clientX; }}
      onPointerUp={(event) => {
        if (pointerStart.current === null) return;
        const distance = event.clientX - pointerStart.current;
        pointerStart.current = null;
        if (Math.abs(distance) >= 42 && slides.length > 1) change(index + (distance < 0 ? 1 : -1));
      }}
    >
      <article key={active.id}>
        <ResilientImage
          alt={active.imageAlt[locale]}
          fallbackLabel={t.imageUnavailable}
          fetchPriority="high"
          height={720}
          loading="eager"
          sizes="100vw"
          src={active.imageUrl}
          width={1600}
        />
        <span aria-hidden="true" className="v2-preview-hero__scrim" />
        <div className="v2-preview-hero__copy">
          <p>{active.eyebrow[locale]}</p>
          <h1>{active.title[locale]}</h1>
          <div>
            <span>{active.body[locale]}</span>
            <Link href={active.targetHref[locale]}>{active.action[locale]}<ArrowRight aria-hidden="true" size={18} /></Link>
          </div>
        </div>
      </article>
      {slides.length > 1 && (
        <div className="v2-preview-hero__dots">
          {slides.map((slide, slideIndex) => (
            <button
              aria-label={t.slide(slideIndex + 1)}
              className={slideIndex === index ? "is-active" : ""}
              key={slide.id}
              onClick={() => change(slideIndex)}
              type="button"
            />
          ))}
        </div>
      )}
      <span className="sr-only">{t.previous} · {t.next}</span>
    </section>
  );
}

function availabilityLabel(product: PreviewProduct, locale: Locale) {
  const t = commonCopy[locale];
  if (product.availability === "PAUSED") return t.paused;
  if (product.availability === "LOW") return t.low(product.lowStock ?? 1);
  return t.available;
}

function PreviewProductCard({
  currency,
  imageError,
  locale,
  product,
}: {
  currency: string;
  imageError: boolean;
  locale: Locale;
  product: PreviewProduct;
}) {
  const t = commonCopy[locale];
  const base = `/preview/v2/${locale}`;
  const { addToCart, cartItemIds, openCart } = useV2PreviewShell();
  const inCart = cartItemIds.includes(product.id);
  const amount = product.price[currency] ?? product.price.CNY;
  const reference = product.referencePrice[currency] ?? product.referencePrice.CNY;
  const token = currency === "CNY" ? "CN¥" : currency === "MYR" ? "RM" : currency === "USDT" ? "₮" : currency;
  return (
    <article className="v2-preview-product-card">
      <Link aria-label={`${t.view}: ${product.name[locale]}`} className="v2-preview-product-card__hit" href={`${base}/products/${product.slug}`} />
      <div className="v2-preview-product-card__image">
        {imageError ? (
          <span className="v2-preview-image-fallback" role="img" aria-label={t.imageUnavailable}>
            <ImageSquare aria-hidden="true" size={30} />
            <small>{t.imageUnavailable}</small>
          </span>
        ) : (
          <ResilientImage
            alt={product.imageAlt[locale]}
            fallbackLabel={t.imageUnavailable}
            height={520}
            sizes="(max-width: 760px) 92px, (max-width: 1100px) 50vw, 33vw"
            src={product.imageUrl}
            width={720}
          />
        )}
      </div>
      <div className="v2-preview-product-card__body">
        <div className="v2-preview-product-card__identity">
          <h3>{product.name[locale]}</h3>
          <p>{product.description[locale]}</p>
        </div>
        <div className="v2-preview-product-card__price">
          <small>{t.currentPrice}</small>
          <strong>{token} {amount}</strong>
          <span>{t.reference} · {reference}</span>
        </div>
        <div className="v2-preview-product-card__purchase">
          <span className={`is-${product.availability.toLowerCase()}`}><i />{availabilityLabel(product, locale)}</span>
          <div>
            <button
              aria-label={inCart ? `${product.name[locale]} · ${locale === "zh" ? "查看购物车" : "View cart"}` : `${locale === "zh" ? "加入购物车" : "Add to cart"} · ${product.name[locale]}`}
              disabled={product.availability === "PAUSED"}
              onClick={() => {
                if (inCart) openCart();
                else addToCart(product);
              }}
              type="button"
            >
              {inCart ? <Check aria-hidden="true" size={16} /> : <ShoppingCartSimple aria-hidden="true" size={16} />}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function PreviewCatalog({
  heroSurface,
  locale,
  onStateReady,
  state,
}: {
  heroSurface: PreviewSurface;
  locale: Locale;
  onStateReady: () => void;
  state: PreviewDataState;
}) {
  const searchParams = useSearchParams();
  const t = commonCopy[locale];
  const { currency, currencies, setCurrency } = useV2PreviewShell();
  const surfaceProducts = useMemo(
    () => PREVIEW_PRODUCTS.filter((product) => product.surfaces.includes(heroSurface)),
    [heroSurface],
  );
  const availablePrimaryCategories = useMemo(() => PREVIEW_PRIMARY_CATEGORIES.filter((category) => (
    surfaceProducts.some((product) => product.primaryCategoryKey === category.key)
  )), [surfaceProducts]);
  const initialPrimary = searchParams.get("primary")?.slice(0, 80) ?? "all";
  const initialSecondary = searchParams.get("secondary")?.slice(0, 80) ?? "all";
  const [primary, setPrimary] = useState<"all" | PreviewPrimaryCategoryKey>(() => (
    availablePrimaryCategories.some((category) => category.key === initialPrimary)
      ? initialPrimary as PreviewPrimaryCategoryKey
      : "all"
  ));
  const [secondary, setSecondary] = useState<"all" | PreviewSecondaryCategoryKey>(() => (
    PREVIEW_SECONDARY_CATEGORIES.some((category) => (
      category.key === initialSecondary
      && surfaceProducts.some((product) => product.secondaryCategoryKey === category.key)
      && (initialPrimary === "all" || category.primaryKey === initialPrimary)
    ))
      ? initialSecondary as PreviewSecondaryCategoryKey
      : "all"
  ));
  const [search, setSearch] = useState(() => searchParams.get("q")?.slice(0, 120) ?? "");
  const [catalogLocked, setCatalogLocked] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const availableSecondaryCategories = useMemo(() => PREVIEW_SECONDARY_CATEGORIES.filter((category) => (
    (primary === "all" || category.primaryKey === primary)
    && surfaceProducts.some((product) => product.secondaryCategoryKey === category.key)
  )), [primary, surfaceProducts]);

  useEffect(() => {
    if (primary !== "all" && !availablePrimaryCategories.some((category) => category.key === primary)) {
      setPrimary("all");
      setSecondary("all");
      replacePreviewQuery({ primary: "", secondary: "" });
      return;
    }
    if (secondary !== "all" && !availableSecondaryCategories.some((category) => category.key === secondary)) {
      setSecondary("all");
      replacePreviewQuery({ secondary: "" });
    }
  }, [availablePrimaryCategories, availableSecondaryCategories, primary, secondary]);

  useEffect(() => {
    let frame = 0;
    const syncCatalogLock = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const compact = window.matchMedia("(max-width: 760px)").matches;
        const controlsTop = controlsRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
        setCatalogLocked(compact && controlsTop <= 68.5);
      });
    };
    syncCatalogLock();
    window.addEventListener("scroll", syncCatalogLock, { passive: true });
    window.addEventListener("resize", syncCatalogLock);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", syncCatalogLock);
      window.removeEventListener("resize", syncCatalogLock);
    };
  }, []);
  const products = useMemo(() => PREVIEW_PRODUCTS.filter((product) => {
    if (!product.surfaces.includes(heroSurface)) return false;
    if (primary !== "all" && product.primaryCategoryKey !== primary) return false;
    if (secondary !== "all" && product.secondaryCategoryKey !== secondary) return false;
    const normalized = search.trim().toLocaleLowerCase(locale === "zh" ? "zh-CN" : "en-US");
    if (!normalized) return true;
    return `${product.name[locale]} ${product.description[locale]}`.toLocaleLowerCase(locale === "zh" ? "zh-CN" : "en-US").includes(normalized);
  }), [heroSurface, locale, primary, search, secondary]);

  const updateSearch = (value: string) => {
    const next = value.slice(0, 120);
    setSearch(next);
    replacePreviewQuery({ q: next.trim() });
  };
  const updatePrimary = (value: "all" | PreviewPrimaryCategoryKey) => {
    setPrimary(value);
    setSecondary("all");
    replacePreviewQuery({
      primary: value === "all" ? "" : value,
      secondary: "",
    });
  };
  const updateSecondary = (value: "all" | PreviewSecondaryCategoryKey) => {
    setSecondary(value);
    replacePreviewQuery({ secondary: value === "all" ? "" : value });
  };
  const clear = () => {
    setSearch("");
    setPrimary("all");
    setSecondary("all");
    replacePreviewQuery({ q: "", primary: "", secondary: "" });
  };

  return (
    <section className="v2-preview-catalog" id="catalog">
      <div className={`v2-preview-catalog__main${catalogLocked ? " is-scroll-locked" : ""}`}>
        <div className="v2-preview-catalog__controls" ref={controlsRef}>
          <div className="v2-preview-catalog__toolbar">
            <label className="v2-preview-catalog__search">
              <span className="sr-only">{t.search}</span>
              <MagnifyingGlass aria-hidden="true" size={19} />
              <input aria-label={t.search} onChange={(event) => updateSearch(event.target.value)} placeholder={t.searchPlaceholder} type="search" value={search} />
              {search && <button aria-label={t.clear} onClick={() => updateSearch("")} type="button"><X aria-hidden="true" size={17} /></button>}
            </label>
            <CurrencyPicker ariaLabel={t.currency} currencies={currencies} onChange={setCurrency} value={currency} />
          </div>
          <nav aria-label={locale === "zh" ? "一级商品分类" : "Primary product categories"} className="v2-preview-primary-categories">
            <button aria-pressed={primary === "all"} className={primary === "all" ? "is-active" : ""} onClick={() => updatePrimary("all")} type="button">
              {locale === "zh" ? "全部商品" : "All products"}
            </button>
            {availablePrimaryCategories.map((item) => (
              <button aria-pressed={primary === item.key} className={primary === item.key ? "is-active" : ""} key={item.id} onClick={() => updatePrimary(item.key)} type="button">
                {item.label[locale]}
              </button>
            ))}
          </nav>
        </div>
        <nav aria-label={locale === "zh" ? "二级商品分类" : "Secondary product categories"} className="v2-preview-secondary-categories">
          <button aria-pressed={secondary === "all"} className={secondary === "all" ? "is-active" : ""} onClick={() => updateSecondary("all")} type="button">
            {locale === "zh" ? "全部分类" : "All categories"}
          </button>
          {availableSecondaryCategories.map((item) => (
            <button aria-pressed={secondary === item.key} className={secondary === item.key ? "is-active" : ""} key={item.id} onClick={() => updateSecondary(item.key)} type="button">
              {item.label[locale]}
            </button>
          ))}
        </nav>
        <div className="v2-preview-catalog__results">
          <PreviewState locale={locale} onReady={onStateReady} state={state}>
            {products.length ? (
              <div className="v2-preview-product-grid">
                {products.map((product) => <PreviewProductCard currency={currency} imageError={state === "image-error"} key={product.id} locale={locale} product={product} />)}
              </div>
            ) : (
              <div className="v2-preview-state is-empty">
                <span><MagnifyingGlass aria-hidden="true" size={25} /></span>
                <h3>{t.noResults}</h3>
                <p>{t.noResultsBody}</p>
                <button onClick={clear} type="button">{t.clear}</button>
              </div>
            )}
          </PreviewState>
        </div>
      </div>
    </section>
  );
}

function PreviewChannelCards({ locale }: { locale: Locale }) {
  const base = `/preview/v2/${locale}`;
  const cards = [
    {
      href: `${base}/transit-subscriptions`,
      icon: Bridge,
      number: "01",
      title: locale === "zh" ? "中转站订阅" : "Transit subscriptions",
      body: locale === "zh" ? "比较订阅、额度和团队方案，再安全前往外部中转站。" : "Compare subscription, usage, and team plans before a safe external handoff.",
    },
    {
      href: `${base}/ai-recharge`,
      icon: Sparkle,
      number: "02",
      title: locale === "zh" ? "AI 软件代充" : "AI software recharge",
      body: locale === "zh" ? "按平台浏览人工办理服务，不在网页收集第三方密码。" : "Browse human-assisted services by platform without entering third-party passwords.",
    },
    {
      href: `${base}/skills`,
      icon: PuzzlePiece,
      number: "03",
      title: locale === "zh" ? "Skill 推荐" : "Skill recommendations",
      body: locale === "zh" ? "从用途、兼容性和来源级别理解工具是否适合你的任务。" : "Evaluate tools by use case, compatibility, and source level.",
    },
  ];
  return (
    <section className="v2-preview-channel-section">
      <header>
        <div><small>{locale === "zh" ? "三条清晰路径" : "Three clear paths"}</small><h2>{locale === "zh" ? "从需要出发，而不是从货架出发。" : "Start from the need, not the shelf."}</h2></div>
        <p>{locale === "zh" ? "每个频道都有独立的筛选、说明和真实性边界。" : "Each channel has its own filters, guidance, and truth boundary."}</p>
      </header>
      <div>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link href={card.href} key={card.href}>
              <span>{card.number}</span>
              <Icon aria-hidden="true" size={26} />
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <i><ArrowRight aria-hidden="true" size={18} /></i>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function PreviewAssurance({ locale }: { locale: Locale }) {
  const items = [
    { icon: CurrencyCircleDollar, title: locale === "zh" ? "多币种展示" : "Multi-currency display", body: locale === "zh" ? "币种身份清楚，参考换算与实际报价分开。" : "Currency identity stays clear and references stay separate from live quotes." },
    { icon: ShieldCheck, title: locale === "zh" ? "边界透明" : "Transparent boundaries", body: locale === "zh" ? "预览、真实读取和未来能力不会混写。" : "Preview, live reads, and future capabilities are never conflated." },
    { icon: Headset, title: locale === "zh" ? "人工确认" : "Human confirmation", body: locale === "zh" ? "一个联系渠道完成后续条件确认。" : "Continue final confirmation through one contact channel." },
    { icon: GlobeHemisphereWest, title: locale === "zh" ? "安全外链" : "Safe handoff", body: locale === "zh" ? "只有经过校验的 HTTPS 地址才会打开新窗口。" : "Only validated HTTPS destinations open in a new tab." },
  ];
  return (
    <section className="v2-preview-assurance">
      {items.map((item) => {
        const Icon = item.icon;
        return <article key={item.title}><Icon aria-hidden="true" size={22} /><div><strong>{item.title}</strong><p>{item.body}</p></div></article>;
      })}
    </section>
  );
}

function PreviewProcessAndFaq({ locale, variant = "home" }: { locale: Locale; variant?: "home" | "transit" | "ai" }) {
  const steps = variant === "transit"
    ? [
      ["选择套餐", "Choose a plan", "比较订阅、额度或团队方案。", "Compare subscription, usage, or team options."],
      ["检查入口", "Check the handoff", "确认外部中转站已配置且为 HTTPS。", "Confirm the transit destination is configured and uses HTTPS."],
      ["外部继续", "Continue externally", "真实购买与账户管理不在本站进行。", "Real purchasing and account management do not happen on this site."],
    ]
    : variant === "ai"
      ? [
        ["选择平台", "Choose a platform", "按实际需要缩小服务范围。", "Narrow the catalog by what you actually need."],
        ["阅读说明", "Review the notes", "确认账号地区、办理条件和隐私边界。", "Review account region, eligibility, and privacy boundaries."],
        ["人工确认", "Confirm with support", "留下一个联系渠道，不填写第三方密码。", "Use one contact channel and never enter a third-party password."],
      ]
      : [
        ["浏览", "Explore", "从频道、分类或关键词找到服务。", "Find a service by channel, category, or keyword."],
        ["核对", "Review", "查看模拟价格、状态与服务说明。", "Review mock pricing, state, and service notes."],
        ["联系", "Connect", "在正式流程中由客服人工确认后续。", "In the live flow, support confirms the next step."],
      ];
  const faq = [
    {
      q: locale === "zh" ? "这里显示的是实时商品吗？" : "Are these live products?",
      a: locale === "zh" ? "不是。所有 DEMO 商品、价格和状态都只用于阶段一界面设计预览。" : "No. All DEMO products, prices, and states exist only for the stage-one interface preview.",
    },
    {
      q: locale === "zh" ? "预览会创建订单或保存设置吗？" : "Will the preview create an order or save settings?",
      a: locale === "zh" ? "不会。表单只做本地校验，刷新页面后输入会重置。" : "No. Forms validate locally only, and inputs reset on refresh.",
    },
    {
      q: locale === "zh" ? "为什么有些外部入口打不开？" : "Why might an external entry be unavailable?",
      a: locale === "zh" ? "只有真实配置中启用且使用有效 HTTPS 的中转站地址才会打开。" : "A transit destination opens only when live configuration enables a valid HTTPS URL.",
    },
  ];
  return (
    <div className="v2-preview-explainers">
      <section className="v2-preview-process">
        <header><small>{locale === "zh" ? "服务路径" : "Service path"}</small><h2>{locale === "zh" ? "三步完成清晰判断" : "Three steps to a clear decision"}</h2></header>
        <div>
          {steps.map((step, index) => (
            <article key={step[0]}><span>0{index + 1}</span><div><h3>{locale === "zh" ? step[0] : step[1]}</h3><p>{locale === "zh" ? step[2] : step[3]}</p></div></article>
          ))}
        </div>
      </section>
      <section className="v2-preview-faq">
        <header><small>FAQ</small><h2>{locale === "zh" ? "先把边界说清楚" : "Clear boundaries first"}</h2></header>
        <div>{faq.map((item, index) => <details key={item.q}><summary><span>0{index + 1}</span><strong>{item.q}</strong><i>+</i></summary><p>{item.a}</p></details>)}</div>
      </section>
    </div>
  );
}

export function V2PreviewHome({ locale }: { locale: Locale }) {
  const [heroMode, setHeroMode] = useState<PreviewHeroMode>("multiple");
  const [dataState, setDataState] = useState<PreviewDataState>("ready");
  return (
    <main className="v2-preview-page v2-preview-home">
      <PreviewScenarioBar dataState={dataState} heroMode={heroMode} locale={locale} onDataStateChange={setDataState} onHeroModeChange={setHeroMode} />
      <PreviewHeroCarousel locale={locale} mode={heroMode} surface="HOME" />
      <PreviewCatalog heroSurface="HOME" locale={locale} onStateReady={() => setDataState("ready")} state={dataState} />
    </main>
  );
}

export function V2PreviewMarketPage({ locale, surface }: { locale: Locale; surface: "TRANSIT_SUBSCRIPTIONS" | "AI_RECHARGE" }) {
  const [heroMode, setHeroMode] = useState<PreviewHeroMode>("single");
  const [dataState, setDataState] = useState<PreviewDataState>("ready");
  const { openSupport, openTransit } = useV2PreviewShell();
  const isTransit = surface === "TRANSIT_SUBSCRIPTIONS";
  return (
    <main className="v2-preview-page v2-preview-market-page">
      <PreviewScenarioBar dataState={dataState} heroMode={heroMode} locale={locale} onDataStateChange={setDataState} onHeroModeChange={setHeroMode} />
      <PreviewHeroCarousel locale={locale} mode={heroMode} surface={surface} />
      <section className="v2-preview-market-intro">
        <div>
          <small>{isTransit ? (locale === "zh" ? "外部服务桥接" : "External service handoff") : (locale === "zh" ? "人工办理说明" : "Human-assisted service")}</small>
          <h2>{isTransit
            ? (locale === "zh" ? "先比较，再前往真实服务。" : "Compare first, then continue to the live service.")
            : (locale === "zh" ? "只确认必要信息，不收集第三方密码。" : "Only necessary details—never a third-party password.")}</h2>
        </div>
        <button onClick={isTransit ? openTransit : openSupport} type="button">
          {isTransit ? (locale === "zh" ? "打开已配置中转站" : "Open configured transit service") : (locale === "zh" ? "咨询客服" : "Ask support")}
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      </section>
      <PreviewCatalog
        heroSurface={surface}
        locale={locale}
        onStateReady={() => setDataState("ready")}
        state={dataState}
      />
      <PreviewAssurance locale={locale} />
      <PreviewProcessAndFaq locale={locale} variant={isTransit ? "transit" : "ai"} />
    </main>
  );
}

function skillTypeLabel(skill: PreviewSkill, locale: Locale) {
  const labels = {
    SKILL: { zh: "Skill", en: "Skill" },
    PLUGIN: { zh: "Plugin", en: "Plugin" },
    CONNECTOR: { zh: "Connector", en: "Connector" },
  } as const;
  return labels[skill.type][locale];
}

function sourceLabel(skill: PreviewSkill, locale: Locale) {
  if (skill.sourceLevel === "OFFICIAL") return locale === "zh" ? "官方来源" : "Official source";
  return locale === "zh" ? "社区来源" : "Community source";
}

function PreviewSkillCard({ locale, skill }: { locale: Locale; skill: PreviewSkill }) {
  const base = `/preview/v2/${locale}`;
  const Icon = skill.type === "CONNECTOR" ? Plug : skill.type === "PLUGIN" ? PuzzlePiece : Code;
  return (
    <article className="v2-preview-skill-card">
      <div className="v2-preview-skill-card__visual"><span><Icon aria-hidden="true" size={23} /></span><small>{skillTypeLabel(skill, locale)}</small></div>
      <div className="v2-preview-skill-card__body">
        <span className="v2-preview-skill-card__source">{sourceLabel(skill, locale)}</span>
        <h2><Link href={`${base}/skills/${skill.slug}`}>{skill.name}</Link></h2>
        <p>{skill.summary[locale]}</p>
        <dl>
          <div><dt>{locale === "zh" ? "兼容" : "Works with"}</dt><dd>{skill.compatible.join(" · ")}</dd></div>
          <div><dt>{locale === "zh" ? "核验" : "Verified"}</dt><dd>{skill.verifiedOn}</dd></div>
        </dl>
      </div>
      <div className="v2-preview-skill-card__actions">
        <a aria-label={`${skill.name} GitHub`} href={skill.githubUrl} rel="noopener noreferrer" target="_blank"><GithubLogo aria-hidden="true" size={18} /><span>GitHub</span></a>
      </div>
    </article>
  );
}

export function V2PreviewSkills({ locale }: { locale: Locale }) {
  const searchParams = useSearchParams();
  const [dataState, setDataState] = useState<PreviewDataState>("ready");
  const [query, setQuery] = useState(() => searchParams.get("q")?.slice(0, 120) ?? "");
  const availableCategories = useMemo(() => PREVIEW_SKILL_CATEGORIES.filter((item) => (
    item.key === "all" || PREVIEW_SKILLS.some((skill) => skill.categoryKey === item.key)
  )), []);
  const requestedCategory = searchParams.get("filter")?.slice(0, 80) ?? "all";
  const [category, setCategory] = useState(() => {
    return availableCategories.some((item) => item.key === requestedCategory) ? requestedCategory : "all";
  });
  const [skillCatalogLocked, setSkillCatalogLocked] = useState(false);
  const skillSearchRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => PREVIEW_SKILLS.filter((skill) => {
    if (category !== "all" && skill.categoryKey !== category) return false;
    const value = query.trim().toLocaleLowerCase();
    return !value || `${skill.name} ${skill.summary[locale]} ${skill.compatible.join(" ")}`.toLocaleLowerCase().includes(value);
  }), [category, locale, query]);

  useEffect(() => {
    if (requestedCategory === "all" || availableCategories.some((item) => item.key === requestedCategory)) return;
    replacePreviewQuery({ filter: "" });
  }, [availableCategories, requestedCategory]);

  useEffect(() => {
    if (availableCategories.some((item) => item.key === category)) return;
    setCategory("all");
    replacePreviewQuery({ filter: "" });
  }, [availableCategories, category]);

  useEffect(() => {
    let frame = 0;
    const syncSkillCatalogLock = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const compact = window.matchMedia("(max-width: 760px)").matches;
        const searchTop = skillSearchRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
        setSkillCatalogLocked(compact && searchTop <= 68.5);
      });
    };
    syncSkillCatalogLock();
    window.addEventListener("scroll", syncSkillCatalogLock, { passive: true });
    window.addEventListener("resize", syncSkillCatalogLock);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", syncSkillCatalogLock);
      window.removeEventListener("resize", syncSkillCatalogLock);
    };
  }, []);

  const updateQuery = (value: string) => {
    const next = value.slice(0, 120);
    setQuery(next);
    replacePreviewQuery({ q: next.trim(), filter: category === "all" ? "" : category });
  };
  const updateCategory = (value: string) => {
    setCategory(value);
    replacePreviewQuery({ q: query.trim(), filter: value === "all" ? "" : value });
  };
  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    replacePreviewQuery({ q: "", filter: "" });
  };
  return (
    <main className="v2-preview-page v2-preview-skills-page">
      <PreviewScenarioBar dataState={dataState} heroMode="off" locale={locale} onDataStateChange={setDataState} onHeroModeChange={() => undefined} showHero={false} />
      <section className="v2-preview-skills-intro">
        <ResilientImage alt={locale === "zh" ? "Skill 工具与开发工作流视觉" : "Skill tools and development workflow artwork"} fallbackLabel={commonCopy[locale].imageUnavailable} height={720} sizes="100vw" src="/assets/hero-codex.webp" width={1600} />
        <span aria-hidden="true" />
        <div><small>CloudBridge Skills</small><h1>{locale === "zh" ? "先理解工具，再决定是否安装。" : "Understand the tool before you install it."}</h1></div>
        <p>{locale === "zh" ? "按用途、资源类型、来源与兼容环境整理。外链只使用明确的 HTTPS GitHub 地址。" : "Organized by use case, resource type, source, and compatibility. External links use explicit HTTPS GitHub destinations."}</p>
      </section>
      <section className="v2-preview-skills-catalog">
        <div className="v2-preview-skill-discovery" ref={skillSearchRef}>
          <label><span className="sr-only">{commonCopy[locale].search}</span><MagnifyingGlass aria-hidden="true" size={20} /><input aria-label={commonCopy[locale].search} onChange={(event) => updateQuery(event.target.value)} placeholder={locale === "zh" ? "搜索 Skill、Plugin、Connector 或兼容环境" : "Search skills, plugins, connectors, or compatibility"} type="search" value={query} />{query && <button aria-label={commonCopy[locale].clear} onClick={() => updateQuery("")} type="button"><X aria-hidden="true" size={17} /></button>}</label>
        </div>
        <div className={`v2-preview-skills-catalog__main${skillCatalogLocked ? " is-scroll-locked" : ""}`}>
          <nav aria-label={locale === "zh" ? "Skill 分类" : "Skill categories"} className="v2-preview-skill-categories">
            {availableCategories.map((item) => <button aria-pressed={category === item.key} className={category === item.key ? "is-active" : ""} key={item.key} onClick={() => updateCategory(item.key)} type="button">{item.key === "all" ? (locale === "zh" ? "全部 Skill" : "All skills") : item.label[locale]}</button>)}
          </nav>
          <div className="v2-preview-skill-results">
            {dataState === "loading" ? (
              <div aria-busy="true" aria-label={commonCopy[locale].loadingTitle} className="v2-preview-skill-grid is-skeleton" role="status">
                {Array.from({ length: 6 }, (_, index) => <article aria-hidden="true" key={index}><span /><i /><i /><i /></article>)}
              </div>
            ) : (
              <PreviewState locale={locale} onReady={() => setDataState("ready")} state={dataState}>
                {filtered.length ? <section className="v2-preview-skill-grid">{filtered.map((skill) => <PreviewSkillCard key={skill.id} locale={locale} skill={skill} />)}</section> : <div className="v2-preview-state is-empty"><span><MagnifyingGlass aria-hidden="true" size={25} /></span><h3>{commonCopy[locale].noResults}</h3><p>{commonCopy[locale].noResultsBody}</p><button onClick={clearFilters} type="button">{commonCopy[locale].clear}</button></div>}
              </PreviewState>
            )}
            {(dataState === "ready" || dataState === "image-error") && <section className="v2-preview-skill-safety"><ShieldCheck aria-hidden="true" size={22} /><div><h2>{locale === "zh" ? "安装前检查" : "Before installing"}</h2><p>{locale === "zh" ? "核对仓库所有者、许可证、最后核验日期、运行环境和最小权限。推荐不等于安全认证。" : "Check the repository owner, license, verification date, runtime, and least privilege. A recommendation is not a security certification."}</p></div></section>}
          </div>
        </div>
      </section>
    </main>
  );
}

type PreviewLookupMode = "local" | "contact" | "number";
type PreviewLookupState = "ready" | "checking" | "not-found" | "rate-limited" | "unavailable";

const PREVIEW_CONTACT_VERIFICATION_CODE = "DEMO-VERIFY-6028";
const previewLookupModes: PreviewLookupMode[] = ["local", "contact", "number"];

function normalizePreviewLookupValue(value: string) {
  return value.normalize("NFKC").trim().toUpperCase();
}

function PreviewLookupOrderCard({ copied, locale, onCopy, onSupport, order, source }: {
  copied: boolean;
  locale: Locale;
  onCopy: (orderNumber: string) => void;
  onSupport: () => void;
  order: PreviewOrderLookup;
  source: "local" | "query";
}) {
  const copy = {
    zh: { local: "本机保存的 DEMO 摘要", query: "DEMO 查询结果", product: "商品", amount: "金额", status: "当前状态", channel: "联系渠道", masked: "脱敏联系方式", created: "创建时间", updated: "更新时间", copied: "已复制订单号", copyOrder: "复制订单号", support: "联系客服" },
    en: { local: "DEMO summary saved on this device", query: "DEMO lookup result", product: "Product", amount: "Amount", status: "Current status", channel: "Contact channel", masked: "Masked contact", created: "Created", updated: "Updated", copied: "Order number copied", copyOrder: "Copy order number", support: "Contact support" },
  }[locale];

  return (
    <article className="v2-preview-order-record">
      <header><small>{copy[source]}</small><strong>{order.orderNumber}</strong><span>{order.status[locale]}</span></header>
      <dl>
        <div><dt>{copy.product}</dt><dd>{order.productName[locale]}</dd></div>
        <div><dt>{copy.amount}</dt><dd>CN¥ {order.amount.amount}</dd></div>
        <div><dt>{copy.channel}</dt><dd>{order.channel[locale]}</dd></div>
        <div><dt>{copy.masked}</dt><dd>{order.maskedContact}</dd></div>
        <div><dt>{copy.created}</dt><dd>{order.createdAt[locale]}</dd></div>
        <div><dt>{copy.updated}</dt><dd>{order.updatedAt[locale]}</dd></div>
      </dl>
      <footer>
        <button onClick={() => onCopy(order.orderNumber)} type="button"><CopySimple aria-hidden="true" size={17} />{copied ? copy.copied : copy.copyOrder}</button>
        <button onClick={onSupport} type="button"><Headset aria-hidden="true" size={17} />{copy.support}</button>
      </footer>
    </article>
  );
}

export function V2PreviewOrderLookup({ locale }: { locale: Locale }) {
  const { openSupport } = useV2PreviewShell();
  const [mode, setMode] = useState<PreviewLookupMode>("local");
  const [localOrders, setLocalOrders] = useState<readonly PreviewOrderLookup[]>(PREVIEW_ORDER_LOOKUPS);
  const [contactChannel, setContactChannel] = useState("whatsapp");
  const [contactValue, setContactValue] = useState("");
  const [contactStep, setContactStep] = useState<"input" | "verify">("input");
  const [verificationCode, setVerificationCode] = useState("");
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [scenario, setScenario] = useState<PreviewLookupState>("ready");
  const [errors, setErrors] = useState<{ contactValue?: string; orderNumber?: string; verificationCode?: string }>({});
  const [copiedOrderNumber, setCopiedOrderNumber] = useState<string | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const copy = {
    zh: {
      eyebrow: "订单查询",
      title: "选择一种方式，找到你的订单。",
      intro: "查看本机保存的摘要，或通过已验证的下单联系方式、提交成功时获得的订单号查询。当前页面只演示交互，不读取服务器订单。",
      tabLabel: "订单查询方式",
      modes: { local: "本机订单", contact: "联系方式", number: "订单号" },
      localTitle: "当前浏览器中的订单",
      localBody: "这里只显示保存在当前浏览器中的安全摘要。清理浏览器数据或更换设备后，记录可能无法找回。",
      localCount: (count: number) => `${count} 笔 DEMO 记录`,
      clearLocal: "清除本机模拟记录",
      restoreLocal: "恢复模拟记录",
      localEmptyTitle: "本机暂时没有订单记录",
      localEmptyBody: "你可以切换到联系方式或订单号查询。这里没有从服务器补齐任何记录。",
      localTruth: "预览使用 React 内存模拟本机缓存，不写入 localStorage，也不读取真实订单。",
      contactTitle: "通过下单联系方式查询",
      contactBody: "先填写购买时使用的联系方式。正式能力只有在完成所有权验证后才会显示订单。",
      contactChannel: "联系方式类型",
      contact: "下单联系方式",
      contactPlaceholder: "填写手机号、WhatsApp、QQ 或微信账号",
      continueVerify: "继续安全验证",
      verifyTitle: "验证联系方式所有权",
      verifyBody: "这是第二步安全门禁。未知联系方式和错误验证码使用同一结果，不暴露订单是否存在。",
      verificationCode: "安全验证码",
      verificationPlaceholder: "填写 DEMO 验证码",
      verifyAndLookup: "验证并查询",
      editContact: "返回修改联系方式",
      numberTitle: "使用订单号查询",
      numberBody: "填写订单提交成功后提示并保存的完整订单号。结果只展示精简订单信息。",
      orderNumber: "订单号",
      orderPlaceholder: "例如 DEMO-CB20260802A7C91F2B",
      lookupOrder: "查询订单",
      requiredOrder: "请填写完整的 DEMO 订单号。",
      requiredContact: "请填写至少 4 个字符的 DEMO 联系方式。",
      requiredVerification: "请填写完整的 DEMO 安全验证码。",
      demoSummary: "查看 DEMO 测试凭证",
      demoBoundary: "请勿填写真实联系方式。本页不会发送验证码、调用订单接口或保存查询内容。",
      scenarioSummary: "预览辅助状态",
      scenario: "查询界面状态",
      ready: "正常交互",
      checking: "正在核对",
      notFound: "没有匹配",
      limited: "尝试过多",
      unavailable: "服务不可用",
      checkingTitle: "正在安全核对",
      checkingBody: "这是固定加载状态，不会通过计时器自动变成成功，也没有发送网络请求。",
      notFoundTitle: "没有找到可显示的订单",
      notFoundBody: "联系方式、验证码或订单号错误时使用完全相同的提示，避免泄露订单是否存在。",
      limitedTitle: "查询尝试过多",
      limitedBody: "正式能力会暂时限制继续尝试，并显示可重试时间。",
      unavailableTitle: "订单查询暂时不可用",
      unavailableBody: "验证或查询服务不可用时失败关闭，不会降级为不安全查询。",
      readyTitle: "填写信息后开始查询",
      readyContactBody: "联系方式查询需要先完成安全验证；当前预览不会发送真实验证码。",
      readyNumberBody: "订单号不会写入 URL、浏览历史或服务器日志。",
    },
    en: {
      eyebrow: "Order lookup",
      title: "Choose the way that fits your order.",
      intro: "View a summary saved on this device, or use a verified purchase contact or the order number shown after submission. This page demonstrates the interaction and never reads server orders.",
      tabLabel: "Order lookup method",
      modes: { local: "On this device", contact: "Purchase contact", number: "Order number" },
      localTitle: "Orders in this browser",
      localBody: "Only safe summaries saved in this browser appear here. Clearing browser data or changing devices may remove them.",
      localCount: (count: number) => `${count} DEMO records`,
      clearLocal: "Clear mock device records",
      restoreLocal: "Restore mock records",
      localEmptyTitle: "No orders are saved on this device",
      localEmptyBody: "Switch to purchase contact or order number lookup. No server records were filled in here.",
      localTruth: "The preview simulates device cache in React memory. It does not write localStorage or read live orders.",
      contactTitle: "Look up by purchase contact",
      contactBody: "Enter the contact used at purchase. A live capability would show orders only after ownership verification.",
      contactChannel: "Contact type",
      contact: "Purchase contact",
      contactPlaceholder: "Enter phone, WhatsApp, QQ, or WeChat account",
      continueVerify: "Continue to secure verification",
      verifyTitle: "Verify contact ownership",
      verifyBody: "This second step is the safety gate. Unknown contacts and invalid codes share the same result so order existence stays private.",
      verificationCode: "Security code",
      verificationPlaceholder: "Enter the DEMO security code",
      verifyAndLookup: "Verify and look up",
      editContact: "Edit purchase contact",
      numberTitle: "Look up by order number",
      numberBody: "Enter the complete order number shown after order submission. Results expose only a minimal order summary.",
      orderNumber: "Order number",
      orderPlaceholder: "For example, DEMO-CB20260802A7C91F2B",
      lookupOrder: "Look up order",
      requiredOrder: "Enter the complete DEMO order number.",
      requiredContact: "Enter at least four characters of the DEMO contact value.",
      requiredVerification: "Enter the complete DEMO security code.",
      demoSummary: "View DEMO test credentials",
      demoBoundary: "Do not enter a real contact. This page does not send codes, call the order API, or save lookup input.",
      scenarioSummary: "Preview state controls",
      scenario: "Lookup interface state",
      ready: "Interactive",
      checking: "Checking",
      notFound: "No match",
      limited: "Rate limited",
      unavailable: "Unavailable",
      checkingTitle: "Checking securely",
      checkingBody: "This is a fixed loading state. It does not auto-resolve or make a network request.",
      notFoundTitle: "No order can be displayed",
      notFoundBody: "Unknown contacts, invalid codes, and unknown order numbers share the same message so order existence stays private.",
      limitedTitle: "Too many lookup attempts",
      limitedBody: "A live capability would pause further attempts and show when retry is available.",
      unavailableTitle: "Order lookup is temporarily unavailable",
      unavailableBody: "When verification or lookup is unavailable, the flow fails closed instead of becoming less secure.",
      readyTitle: "Enter details to start",
      readyContactBody: "Contact lookup requires secure verification first. This preview sends no real code.",
      readyNumberBody: "The order number is not placed in the URL, browser history, or server logs.",
    },
  }[locale];

  const modeItems = [
    { key: "local" as const, icon: Package },
    { key: "contact" as const, icon: Headset },
    { key: "number" as const, icon: Receipt },
  ];
  const contactMatches = PREVIEW_ORDER_LOOKUPS.filter((order) => normalizePreviewLookupValue(order.contactValue) === normalizePreviewLookupValue(contactValue));
  const contactVerified = normalizePreviewLookupValue(verificationCode) === PREVIEW_CONTACT_VERIFICATION_CODE;
  const numberMatches = PREVIEW_ORDER_LOOKUPS.filter((order) => normalizePreviewLookupValue(order.orderNumber) === normalizePreviewLookupValue(orderNumber));
  const activeRecords = mode === "contact" && contactSubmitted && contactVerified ? contactMatches : mode === "number" && orderSubmitted ? numberMatches : [];
  const didSubmit = mode === "contact" ? contactSubmitted : orderSubmitted;
  const visibleState: PreviewLookupState = scenario === "ready" && didSubmit && activeRecords.length === 0 ? "not-found" : scenario;

  const selectMode = (nextMode: PreviewLookupMode) => {
    setMode(nextMode);
    setCopiedOrderNumber(null);
    setScenario("ready");
  };
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % previewLookupModes.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + previewLookupModes.length) % previewLookupModes.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = previewLookupModes.length - 1;
    else return;
    event.preventDefault();
    const nextMode = previewLookupModes[nextIndex];
    if (!nextMode) return;
    selectMode(nextMode);
    tabRefs.current[nextIndex]?.focus();
  };
  const startContactVerification = () => {
    if (contactValue.trim().length < 4) {
      setErrors({ contactValue: copy.requiredContact });
      return;
    }
    setErrors({});
    setContactSubmitted(false);
    setContactStep("verify");
  };
  const submitContactLookup = () => {
    if (verificationCode.trim().length < 8) {
      setErrors({ verificationCode: copy.requiredVerification });
      return;
    }
    setErrors({});
    setContactSubmitted(true);
    setCopiedOrderNumber(null);
  };
  const submitOrderLookup = () => {
    if (orderNumber.trim().length < 12) {
      setErrors({ orderNumber: copy.requiredOrder });
      return;
    }
    setErrors({});
    setOrderSubmitted(true);
    setCopiedOrderNumber(null);
  };
  const copyDemoOrderNumber = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedOrderNumber(value);
    } catch {
      setCopiedOrderNumber(null);
    }
  };

  const feedback = visibleState === "checking" ? (
    <div className="v2-preview-lookup-feedback is-loading" role="status"><span aria-hidden="true" /><h2>{copy.checkingTitle}</h2><p>{copy.checkingBody}</p></div>
  ) : visibleState === "not-found" ? (
    <div className="v2-preview-lookup-feedback is-error" role="status"><WarningCircle aria-hidden="true" size={28} /><h2>{copy.notFoundTitle}</h2><p>{copy.notFoundBody}</p></div>
  ) : visibleState === "rate-limited" ? (
    <div className="v2-preview-lookup-feedback is-warning" role="status"><Clock aria-hidden="true" size={28} /><h2>{copy.limitedTitle}</h2><p>{copy.limitedBody}</p></div>
  ) : visibleState === "unavailable" ? (
    <div className="v2-preview-lookup-feedback is-error" role="status"><WifiSlash aria-hidden="true" size={28} /><h2>{copy.unavailableTitle}</h2><p>{copy.unavailableBody}</p></div>
  ) : didSubmit && activeRecords.length ? (
    <div className="v2-preview-lookup-records">{activeRecords.map((order) => <PreviewLookupOrderCard copied={copiedOrderNumber === order.orderNumber} key={order.id} locale={locale} onCopy={(value) => void copyDemoOrderNumber(value)} onSupport={openSupport} order={order} source="query" />)}</div>
  ) : (
    <div className="v2-preview-lookup-feedback"><ShieldCheck aria-hidden="true" size={29} /><h2>{copy.readyTitle}</h2><p>{mode === "contact" ? copy.readyContactBody : copy.readyNumberBody}</p></div>
  );

  return (
    <main className="v2-preview-page v2-preview-lookup-page">
      <header className="v2-preview-lookup-heading"><small>{copy.eyebrow}</small><h1>{copy.title}</h1><p>{copy.intro}</p></header>
      <nav aria-label={copy.tabLabel} className="v2-preview-lookup-tabs" role="tablist">
        {modeItems.map((item, index) => <button aria-controls={`v2-preview-lookup-panel-${item.key}`} aria-selected={mode === item.key} id={`v2-preview-lookup-tab-${item.key}`} key={item.key} onClick={() => selectMode(item.key)} onKeyDown={(event) => handleTabKeyDown(event, index)} ref={(node) => { tabRefs.current[index] = node; }} role="tab" tabIndex={mode === item.key ? 0 : -1} type="button"><item.icon aria-hidden="true" size={18} /><span>{copy.modes[item.key]}</span></button>)}
      </nav>

      <section aria-labelledby={`v2-preview-lookup-tab-${mode}`} className="v2-preview-lookup-workbench" id={`v2-preview-lookup-panel-${mode}`} role="tabpanel" tabIndex={0}>
        {mode === "local" ? (
          <div className="v2-preview-lookup-local">
            <header><div><h2>{copy.localTitle}</h2><p>{copy.localBody}</p></div><span>{copy.localCount(localOrders.length)}</span></header>
            {localOrders.length ? <div className="v2-preview-lookup-records">{localOrders.map((order) => <PreviewLookupOrderCard copied={copiedOrderNumber === order.orderNumber} key={order.id} locale={locale} onCopy={(value) => void copyDemoOrderNumber(value)} onSupport={openSupport} order={order} source="local" />)}</div> : <div className="v2-preview-lookup-feedback is-empty"><Receipt aria-hidden="true" size={28} /><h2>{copy.localEmptyTitle}</h2><p>{copy.localEmptyBody}</p><button onClick={() => setLocalOrders(PREVIEW_ORDER_LOOKUPS)} type="button">{copy.restoreLocal}</button></div>}
            <footer><p>{copy.localTruth}</p>{localOrders.length > 0 && <button onClick={() => { setLocalOrders([]); setCopiedOrderNumber(null); }} type="button">{copy.clearLocal}</button>}</footer>
          </div>
        ) : (
          <div className="v2-preview-lookup-query">
            {mode === "contact" ? (
              <form onSubmit={(event) => { event.preventDefault(); contactStep === "input" ? startContactVerification() : submitContactLookup(); }}>
                <header><h2>{contactStep === "input" ? copy.contactTitle : copy.verifyTitle}</h2><p>{contactStep === "input" ? copy.contactBody : copy.verifyBody}</p></header>
                {contactStep === "input" ? <div className="v2-preview-lookup-fields is-contact"><label><span>{copy.contactChannel}</span><select onChange={(event) => setContactChannel(event.target.value)} value={contactChannel}><option value="phone">{locale === "zh" ? "手机号" : "Phone"}</option><option value="whatsapp">WhatsApp</option><option value="qq">QQ</option><option value="wechat">{locale === "zh" ? "微信" : "WeChat"}</option></select></label><label><span>{copy.contact}</span><input aria-invalid={Boolean(errors.contactValue)} autoComplete="off" onChange={(event) => { setContactValue(event.target.value.slice(0, 120)); setErrors({}); setContactSubmitted(false); }} placeholder={copy.contactPlaceholder} value={contactValue} />{errors.contactValue && <small role="alert">{errors.contactValue}</small>}</label></div> : <div className="v2-preview-lookup-verification"><div><small>{copy.contactChannel}</small><strong>{contactChannel === "wechat" ? (locale === "zh" ? "微信" : "WeChat") : contactChannel === "phone" ? (locale === "zh" ? "手机号" : "Phone") : contactChannel === "qq" ? "QQ" : "WhatsApp"}</strong><span>{contactValue}</span></div><label><span>{copy.verificationCode}</span><input aria-invalid={Boolean(errors.verificationCode)} autoComplete="one-time-code" onChange={(event) => { setVerificationCode(event.target.value.slice(0, 32)); setErrors({}); setContactSubmitted(false); }} placeholder={copy.verificationPlaceholder} value={verificationCode} />{errors.verificationCode && <small role="alert">{errors.verificationCode}</small>}</label></div>}
                <div className="v2-preview-lookup-actions">{contactStep === "verify" && <button className="is-secondary" onClick={() => { setContactStep("input"); setVerificationCode(""); setContactSubmitted(false); setErrors({}); }} type="button">{copy.editContact}</button>}<button type="submit">{contactStep === "input" ? copy.continueVerify : copy.verifyAndLookup}<ArrowRight aria-hidden="true" size={18} /></button></div>
                <details className="v2-preview-lookup-demo"><summary>{copy.demoSummary}</summary><div><code>{PREVIEW_ORDER_LOOKUP.contactValue}</code><code>{PREVIEW_CONTACT_VERIFICATION_CODE}</code><p>{copy.demoBoundary}</p></div></details>
              </form>
            ) : (
              <form onSubmit={(event) => { event.preventDefault(); submitOrderLookup(); }}>
                <header><h2>{copy.numberTitle}</h2><p>{copy.numberBody}</p></header>
                <div className="v2-preview-lookup-fields"><label><span>{copy.orderNumber}</span><input aria-invalid={Boolean(errors.orderNumber)} autoComplete="off" onChange={(event) => { setOrderNumber(event.target.value.slice(0, 40)); setErrors({}); setOrderSubmitted(false); }} placeholder={copy.orderPlaceholder} value={orderNumber} />{errors.orderNumber && <small role="alert">{errors.orderNumber}</small>}</label></div>
                <div className="v2-preview-lookup-actions"><button type="submit">{copy.lookupOrder}<ArrowRight aria-hidden="true" size={18} /></button></div>
                <details className="v2-preview-lookup-demo"><summary>{copy.demoSummary}</summary><div><code>{PREVIEW_ORDER_LOOKUP.orderNumber}</code><p>{copy.demoBoundary}</p></div></details>
              </form>
            )}
            <section aria-live="polite" className="v2-preview-lookup-results">{feedback}</section>
          </div>
        )}
      </section>

      {mode !== "local" && <details className="v2-preview-lookup-preview-tools"><summary>{copy.scenarioSummary}</summary><label><span>{copy.scenario}</span><select onChange={(event) => setScenario(event.target.value as PreviewLookupState)} value={scenario}><option value="ready">{copy.ready}</option><option value="checking">{copy.checking}</option><option value="not-found">{copy.notFound}</option><option value="rate-limited">{copy.limited}</option><option value="unavailable">{copy.unavailable}</option></select></label></details>}
    </main>
  );
}

function PreviewNotFound({ locale, resource }: { locale: Locale; resource: "product" | "skill" }) {
  const base = `/preview/v2/${locale}`;
  return (
    <main className="v2-preview-page v2-preview-not-found">
      <span>404</span>
      <h1>{locale === "zh" ? "这个模拟内容不存在" : "This mock item does not exist"}</h1>
      <p>{locale === "zh" ? "没有回退到真实业务数据，也没有创建新的模拟记录。" : "The preview did not fall back to live business data or invent another record."}</p>
      <Link href={resource === "skill" ? `${base}/skills` : base}><ArrowLeft aria-hidden="true" size={17} />{locale === "zh" ? "返回预览目录" : "Back to preview catalog"}</Link>
    </main>
  );
}

export function V2PreviewSkillDetail({ locale, slug }: { locale: Locale; slug: string }) {
  const skill = previewSkillBySlug(slug);
  if (!skill) return <PreviewNotFound locale={locale} resource="skill" />;
  const base = `/preview/v2/${locale}`;
  const related = skill.relatedSlugs.map(previewSkillBySlug).filter((item): item is PreviewSkill => Boolean(item));
  return (
    <main className="v2-preview-page v2-preview-skill-detail">
      <nav aria-label={locale === "zh" ? "面包屑" : "Breadcrumb"}><Link href={`${base}/skills`}>{locale === "zh" ? "Skill 推荐" : "Skill picks"}</Link><ArrowRight aria-hidden="true" size={13} /><span>{skill.name}</span></nav>
      <header>
        <div><span><Code aria-hidden="true" size={28} /></span><small>{skillTypeLabel(skill, locale)} · {sourceLabel(skill, locale)}</small><h1>{skill.name}</h1><p>{skill.summary[locale]}</p></div>
        <dl><div><dt>{locale === "zh" ? "兼容环境" : "Compatible"}</dt><dd>{skill.compatible.join(" · ")}</dd></div><div><dt>{locale === "zh" ? "许可证" : "License"}</dt><dd>{skill.license}</dd></div><div><dt>{locale === "zh" ? "最近核验" : "Last verified"}</dt><dd>{skill.verifiedOn}</dd></div></dl>
      </header>
      <div className="v2-preview-skill-detail__content">
        <section>
          <article><span>01</span><div><h2>{locale === "zh" ? "适合这些任务" : "Good for these tasks"}</h2>{skill.bestFor.map((item) => <p key={item.en}><CheckCircle aria-hidden="true" size={18} />{item[locale]}</p>)}</div></article>
          <article><span>02</span><div><h2>{locale === "zh" ? "不适合这些任务" : "Not a fit for"}</h2>{skill.notFor.map((item) => <p key={item.en}><X aria-hidden="true" size={18} />{item[locale]}</p>)}</div></article>
          <article><span>03</span><div><h2>{locale === "zh" ? "安装提示" : "Installation note"}</h2><p>{skill.installHint[locale]}</p></div></article>
        </section>
        <aside>
          <small>{locale === "zh" ? "外部来源" : "External source"}</small>
          <h2>{locale === "zh" ? "离开本站前核对地址" : "Verify the destination before leaving"}</h2>
          <a href={skill.githubUrl} rel="noopener noreferrer" target="_blank"><GithubLogo aria-hidden="true" size={19} />GitHub<ArrowRight aria-hidden="true" size={16} /></a>
          {skill.docsUrl && <a href={skill.docsUrl} rel="noopener noreferrer" target="_blank"><Compass aria-hidden="true" size={19} />{locale === "zh" ? "官方文档" : "Documentation"}<ArrowRight aria-hidden="true" size={16} /></a>}
          <p>{locale === "zh" ? "本页没有一键安装，也不会代替你执行下载或授权。" : "This page does not offer one-click install and never downloads or authorizes on your behalf."}</p>
        </aside>
      </div>
      <section className="v2-preview-related-skills"><header><small>{locale === "zh" ? "相关内容" : "Related"}</small><h2>{locale === "zh" ? "继续比较" : "Keep comparing"}</h2></header>{related.length ? <div>{related.map((item) => <PreviewSkillCard key={item.id} locale={locale} skill={item} />)}</div> : <p>{locale === "zh" ? "暂时没有相关 Skill。" : "No related skills yet."}</p>}</section>
    </main>
  );
}

export function V2PreviewCartPage({ locale }: { locale: Locale }) {
  const { addToCart, cartItemIds, cartItems, currency, removeFromCart } = useV2PreviewShell();
  const recommendations = PREVIEW_PRODUCTS.filter((product) => !cartItemIds.includes(product.id)).slice(0, 6);
  return <PreviewCartPage cartItemIds={cartItemIds} currency={currency} items={cartItems} locale={locale} onAdd={addToCart} onRemove={removeFromCart} recommendations={recommendations} />;
}

export function V2PreviewProductDetail({ locale, slug }: { locale: Locale; slug: string }) {
  const product = previewProductBySlug(slug);
  const { addToCart, cartItemIds, currency, openCart } = useV2PreviewShell();
  const [channel, setChannel] = useState<ContactChannelType | "">("WHATSAPP");
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [compactBar, setCompactBar] = useState(false);
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const base = `/preview/v2/${locale}`;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;
    const observer = new IntersectionObserver(([entry]) => setCompactBar(!entry?.isIntersecting), { threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  if (!product) return <PreviewNotFound locale={locale} resource="product" />;
  const inCart = cartItemIds.includes(product.id);
  const amount = product.price[currency] ?? product.price.CNY;
  const reference = product.referencePrice[currency] ?? product.referencePrice.CNY;
  const token = currency === "CNY" ? "CN¥" : currency === "MYR" ? "RM" : currency === "USDT" ? "₮" : currency;
  const submit = () => {
    setFeedback("");
    if (!channel || contact.trim().length < 4) {
      setError(locale === "zh" ? "请选择示例联系渠道，并填写至少 4 个字符。" : "Choose a demo channel and enter at least 4 characters.");
      return;
    }
    setError("");
    setFeedback(PREVIEW_VALIDATION_NOTICE[locale]);
  };
  const share = async () => {
    const text = `${product.name[locale]} · ${token} ${amount} · ${window.location.href}`;
    try {
      if (typeof navigator.share === "function") await navigator.share({ title: product.name[locale], text, url: window.location.href });
      else await navigator.clipboard.writeText(text);
      setFeedback(locale === "zh" ? "已打开系统分享或复制预览内容；未发送任何外部消息。" : "Share options opened or preview text copied. No external message was sent.");
    } catch {
      setFeedback(locale === "zh" ? "分享已取消，没有发送任何内容。" : "Sharing was cancelled. Nothing was sent.");
    }
  };
  return (
    <main className="v2-preview-product-detail">
      <span aria-hidden="true" ref={sentinelRef} />
      <div className={`v2-preview-detail-compact ${compactBar ? "is-visible" : ""}`}>
        <Link aria-label={locale === "zh" ? "返回" : "Back"} href={`${base}#catalog`}><ArrowLeft aria-hidden="true" size={20} /></Link>
        <strong>{product.name[locale]}</strong>
        <button aria-label={locale === "zh" ? "分享" : "Share"} onClick={() => void share()} type="button"><ShareNetwork aria-hidden="true" size={20} /></button>
      </div>
      <section className="v2-preview-detail-visual">
        <ResilientImage alt={product.imageAlt[locale]} fallbackLabel={commonCopy[locale].imageUnavailable} fetchPriority="high" height={900} loading="eager" sizes="(max-width: 760px) 100vw, 56vw" src={product.imageUrl} width={1200} />
        <span aria-hidden="true" />
        <div className="v2-preview-detail-visual__actions">
          <Link aria-label={locale === "zh" ? "返回预览目录" : "Back to preview catalog"} href={`${base}#catalog`}><ArrowLeft aria-hidden="true" size={21} /></Link>
          <button aria-label={locale === "zh" ? "分享服务" : "Share service"} onClick={() => void share()} type="button"><ShareNetwork aria-hidden="true" size={21} /></button>
        </div>
      </section>
      <section className="v2-preview-detail-copy">
        <header><h1>{product.name[locale]}</h1><p>{product.description[locale]}</p></header>
        <div className="v2-preview-detail-price"><div><small>{commonCopy[locale].currentPrice}</small><strong>{token} {amount}</strong></div><span>{commonCopy[locale].reference} · {reference}</span></div>
        <div className="v2-preview-detail-meta"><span className={`is-${product.availability.toLowerCase()}`}><i />{availabilityLabel(product, locale)}</span><span><Clock aria-hidden="true" size={17} />{product.responseTime[locale]}</span></div>
        <section className="v2-preview-detail-notes">
          {product.notes.map((note, index) => <article key={note.title.en}><span>0{index + 1}</span><div><h2>{note.title[locale]}</h2><p>{note.body[locale]}</p></div></article>)}
        </section>
        <form className="v2-preview-order-form" onSubmit={(event) => { event.preventDefault(); submit(); }} ref={formRef}>
          <header><span><Headset aria-hidden="true" size={21} /></span><div><h2>{locale === "zh" ? "非提交式订单表单" : "Non-submitting order form"}</h2><p>{locale === "zh" ? "仅检查字段与流程，不调用订单接口。" : "Validates fields and flow only. The order API is never called."}</p></div></header>
          <label><span>{locale === "zh" ? "示例联系渠道" : "Demo contact channel"}</span><ContactChannelPicker ariaLabel={locale === "zh" ? "选择示例联系渠道" : "Choose a demo contact channel"} channels={PREVIEW_DEMO_CHANNELS} disabled={false} locale={locale} onChange={setChannel} value={channel} /></label>
          <label><span>{locale === "zh" ? "联系账号" : "Contact account"}</span><input aria-invalid={Boolean(error)} autoComplete="off" onChange={(event) => { setContact(event.target.value.slice(0, 120)); setError(""); setFeedback(""); }} placeholder={locale === "zh" ? "输入示例账号，不要填写真实敏感信息" : "Enter a demo account; do not use sensitive data"} type="text" value={contact} /></label>
          {error && <p className="v2-preview-form-error" role="alert"><WarningCircle aria-hidden="true" size={17} />{error}</p>}
          {feedback && <p className="v2-preview-form-feedback" role="status"><Check aria-hidden="true" size={17} />{feedback}</p>}
          {feedback && (
            <div className="v2-preview-order-followup">
              <p>{locale === "zh" ? "正式订单创建后，这里会提供保存订单号和安全查询入口；本次预览没有生成编号。" : "After a live order is created, this area will offer order-number copy and secure lookup. No number was generated in this preview."}</p>
              <div>
                <button disabled type="button"><CopySimple aria-hidden="true" size={16} />{locale === "zh" ? "保存订单号" : "Save order number"}</button>
                <Link href={`${base}/orders/lookup`}><Receipt aria-hidden="true" size={16} />{locale === "zh" ? "预览订单查询" : "Preview order lookup"}</Link>
              </div>
            </div>
          )}
          <p className="v2-preview-form-boundary">{commonCopy[locale].mockPrice} · {locale === "zh" ? "刷新后本地输入会重置" : "Local input resets on refresh"}</p>
        </form>
      </section>
      <div className="v2-preview-detail-dock">
        <span><small>{commonCopy[locale].currentPrice}</small><strong>{token} {amount}</strong></span>
        <button disabled={product.availability === "PAUSED"} onClick={() => {
          if (inCart) openCart();
          else addToCart(product);
        }} type="button">{product.availability === "PAUSED" ? commonCopy[locale].paused : inCart ? (locale === "zh" ? "查看购物车" : "View cart") : (locale === "zh" ? "加入购物车" : "Add to cart")}<ShoppingCartSimple aria-hidden="true" size={17} /></button>
      </div>
    </main>
  );
}

const policyCopy = {
  terms: {
    zh: {
      title: "服务条款预览",
      intro: "这份页面用于确认 V2 政策版式；正式条款仍以当前生产版本与后台配置为准。",
      sections: [
        ["人工服务范围", "CloudBridge 当前正式服务仍是单商品人工确认；V2 仅模拟多商品购物车界面，不提供在线支付或自动发货，也不会创建服务器订单。"],
        ["预览数据", "V2 路径中的 DEMO 商品、价格、Skill 与广告均为模拟数据，不构成真实报价或服务承诺。"],
        ["外部服务", "中转站是独立外部入口。只有后台真实配置的 HTTPS 地址会被打开，CloudBridge 不提供站内中转控制台。"],
      ],
    },
    en: {
      title: "Terms preview",
      intro: "This page validates the V2 policy layout. Current production terms and configured policy versions remain authoritative.",
      sections: [
        ["Human-assisted scope", "CloudBridge production still supports a single-product human-confirmation flow. V2 only simulates a multi-item cart interface without online payment, automatic fulfillment, or server order creation."],
        ["Preview data", "DEMO products, prices, skills, and banners on V2 paths are mock data and are not live quotes or service commitments."],
        ["External services", "The transit service is an independent external destination. Only a live configured HTTPS URL opens, and CloudBridge provides no in-site transit console."],
      ],
    },
  },
  privacy: {
    zh: {
      title: "隐私说明预览",
      intro: "预览状态只保存在当前 React 内存；本页不创建订单，不保存联系信息，也不调用后台写入接口。",
      sections: [
        ["预览输入", "请勿在模拟表单中填写真实密码、Token、验证码或其他敏感信息。刷新页面后预览输入会重置。"],
        ["真实只读配置", "预览只可读取公开的 storefront/config，用于显示币种、客服状态和中转站可用性。"],
        ["外部链接", "Skill 与中转站链接在新窗口打开；离开本站后适用目标网站自己的隐私规则。"],
      ],
    },
    en: {
      title: "Privacy preview",
      intro: "Preview state remains in current React memory. This page creates no order, stores no contact value, and calls no admin mutation.",
      sections: [
        ["Preview input", "Do not enter real passwords, tokens, verification codes, or other sensitive data in mock forms. Preview input resets on refresh."],
        ["Live read-only configuration", "The preview may read public storefront/config only to display currencies, support state, and transit availability."],
        ["External links", "Skill and transit links open in a new window. The destination's own privacy policy applies after leaving this site."],
      ],
    },
  },
} as const;

export function V2PreviewPolicy({ locale, policy }: { locale: Locale; policy: "terms" | "privacy" }) {
  const content = policyCopy[policy][locale];
  return (
    <main className="v2-preview-page v2-preview-policy">
      <header><small>CloudBridge / {policy === "terms" ? "Terms" : "Privacy"}</small><h1>{content.title}</h1><p>{content.intro}</p></header>
      <section>{content.sections.map((section, index) => <article key={section[0]}><span>0{index + 1}</span><div><h2>{section[0]}</h2><p>{section[1]}</p></div></article>)}</section>
    </main>
  );
}

export function V2PreviewLoading({ locale }: { locale: Locale }) {
  return <main className="v2-preview-page v2-preview-route-state"><div className="v2-preview-loading-line" /><Stack aria-hidden="true" size={28} /><h1>{commonCopy[locale].loadingTitle}</h1><p>{commonCopy[locale].loadingBody}</p></main>;
}

export function V2PreviewError({ locale, reset }: { locale: Locale; reset: () => void }) {
  return <main className="v2-preview-page v2-preview-route-state is-error"><WarningCircle aria-hidden="true" size={28} /><h1>{commonCopy[locale].errorTitle}</h1><p>{commonCopy[locale].errorBody}</p><button onClick={reset} type="button">{commonCopy[locale].retryPreview}</button></main>;
}
