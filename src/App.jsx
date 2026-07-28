import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  ArrowsClockwise,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  ChatsCircle,
  Clock,
  Copy,
  CurrencyCircleDollar,
  EnvelopeSimple,
  GlobeHemisphereWest,
  Headset,
  LinkSimple,
  LockKey,
  MagnifyingGlass,
  PaperPlaneTilt,
  QrCode,
  Receipt,
  ShieldCheck,
  WarningCircle,
  WechatLogo,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import {
  copy,
  currencies,
  heroes,
  merchantChannels,
  mockOrders,
  productCategories,
  products,
} from "./data.js";
import {
  filterCatalogProducts,
  readProductCategories,
  readProductCategoryAssignments,
  saveProductCategories,
  saveProductCategoryAssignments,
  sortProductCategories,
} from "./catalog.js";
import {
  consumeLookupPrefill,
  createCancelableDelay,
  createOrderId,
  readHomeScroll,
  readHorizontalOverflow,
  readOrderSummary,
  resolveOrderSummary,
  saveHomeScroll,
  saveLookupPrefill,
  saveOrderSummary,
  UX_TIMINGS,
  validateContact,
  validateLookup,
} from "./client-ux.js";
import { PaymentDemoPage, StorefrontStatesPage } from "./ClientDesignPages.jsx";
import { BrandMark } from "./BrandMark.jsx";
import { TransitServiceLink } from "./TransitServiceLink.jsx";
import AdminAuthFlow from "./AdminAuthFlow.jsx";
import {
  readTransitServiceConfig,
  saveTransitServiceConfig,
  TRANSIT_SERVICE_STORAGE_KEY,
} from "./transit-service.js";

const routeFromHash = () => window.location.hash.replace(/^#/, "") || "/home";
const AdminApp = lazy(() => import("./AdminApp.jsx"));
const go = (path, { resetScroll = false } = {}) => {
  const currentRoute = routeFromHash();
  if ((currentRoute === "/home" || currentRoute === "/") && path.startsWith("/product/")) {
    saveHomeScroll(window.sessionStorage, window.scrollY);
  }
  if (path === "/home" && resetScroll) {
    saveHomeScroll(window.sessionStorage, 0);
  }
  if (window.location.hash === `#${path}`) {
    if (path === "/home" && resetScroll) window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    return;
  }
  window.location.hash = path;
};

const channelIcons = {
  whatsapp: WhatsappLogo,
  wechat: WechatLogo,
  qq: ChatsCircle,
  email: EnvelopeSimple,
  telegram: PaperPlaneTilt,
};

const getChannelLabel = (channel, lang) => {
  const configured = merchantChannels.find((item) => item.type === channel || item.label.en === channel);
  return configured?.label?.[lang] ?? channel;
};

const getChannelHref = (channel, lang) => {
  if (channel.type === "whatsapp") {
    const message = lang === "zh"
      ? "你好，我想咨询云桥 CloudBridge 的 AI 软件服务。"
      : "Hello, I would like to ask about CloudBridge AI software services.";
    return `https://wa.me/${channel.rawAccount}?text=${encodeURIComponent(message)}`;
  }
  if (channel.type === "qq") {
    return `mqqwpa://im/chat?chat_type=wpa&uin=${channel.rawAccount}&version=1&src_type=web&web_src=cloudbridge`;
  }
  if (channel.type === "email") return `mailto:${channel.rawAccount}`;
  if (channel.type === "telegram") return `https://t.me/${channel.rawAccount.replace(/^@/, "")}`;
  return "";
};

const adminPageLabels = {
  dashboard: { zh: "运营总览", en: "Operations" },
  orders: { zh: "订单中心", en: "Orders" },
  products: { zh: "商品中心", en: "Products" },
  categories: { zh: "商品分类", en: "Product categories" },
  banners: { zh: "首页轮播", en: "Hero stories" },
  media: { zh: "媒体资源", en: "Media library" },
  translations: { zh: "语言与内容", en: "Language & copy" },
  contacts: { zh: "联系方式", en: "Contact channels" },
  currencies: { zh: "币种与汇率", en: "Currencies & rates" },
  notifications: { zh: "通知中心", en: "Notifications" },
  "telegram-bot": { zh: "Telegram 机器人", en: "Telegram bot" },
  team: { zh: "员工账户", en: "Team accounts" },
  roles: { zh: "角色与权限", en: "Roles & permissions" },
  logs: { zh: "日志与监控", en: "Logs & monitoring" },
  security: { zh: "安全中心", en: "Security" },
  "security-events": { zh: "安全事件", en: "Security events" },
  payments: { zh: "支付与收款", en: "Payments" },
  reconciliation: { zh: "支付对账", en: "Reconciliation" },
  disputes: { zh: "退款与争议", en: "Refunds & disputes" },
  "data-security": { zh: "数据安全", en: "Data security" },
  backups: { zh: "备份与恢复", en: "Backup & recovery" },
  secrets: { zh: "密钥与机密", en: "Secrets" },
  integrations: { zh: "系统与集成", en: "Systems & integrations" },
  settings: { zh: "网站设置", en: "Site settings" },
  login: { zh: "管理员登录", en: "Admin sign in" },
};

const adminAuthPages = new Set(["login"]);

function CurrencyToken({ currency, compact = false }) {
  return (
    <span className={`currency-token ${compact ? "currency-token--compact" : ""} ${currency.code === "USDT" ? "is-usdt" : ""}`}>
      <span>{currency.token}</span>
      <i aria-hidden="true" />
    </span>
  );
}

function LocalizedText({ value, lang, as: Tag = "span", ...props }) {
  const text = typeof value === "string" ? value : value?.[lang] ?? "";
  return <Tag {...props}>{text}</Tag>;
}

function AsyncImage({
  src,
  alt,
  className = "",
  priority = false,
  loading,
  fallbackLabel,
  ...props
}) {
  const [state, setState] = useState("loading");
  useEffect(() => setState("loading"), [src]);
  return (
    <>
      <img
        {...props}
        src={src}
        alt={alt}
        className={`${className} async-image is-${state}`.trim()}
        loading={loading || (priority ? "eager" : "lazy")}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
      />
      {state !== "loaded" && (
        <span className={`async-image-status is-${state}`} aria-hidden="true">
          {state === "error" && <img src="/assets/cloudbridge-logo.png" alt="" />}
          <small>{state === "error" ? fallbackLabel : ""}</small>
        </span>
      )}
    </>
  );
}

function StatusCenter({ status, routeAnnouncement }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!status?.message) return undefined;
    setVisible(true);
    if (status.type === "error") return undefined;
    const timer = window.setTimeout(() => setVisible(false), 2800);
    return () => window.clearTimeout(timer);
  }, [status]);
  return (
    <>
      <div
        className={`status-toast is-${status?.type || "info"} ${visible ? "is-visible" : ""}`}
        aria-hidden="true"
      >
        {status?.type === "error" ? <WarningCircle size={17} /> : <CheckCircle size={17} />}
        <span>{status?.message || ""}</span>
        {status?.type === "error" && (
          <button type="button" onClick={() => setVisible(false)} aria-label="关闭错误提示 / Dismiss error">
            <X size={15} />
          </button>
        )}
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{routeAnnouncement}</div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{status?.message || ""}</div>
    </>
  );
}

function DelayedRouteFallback({ lang }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), UX_TIMINGS.feedbackDelayMs);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <div className="route-loading" role="status">
      <span />
      {lang === "zh" ? "正在打开页面" : "Opening page"}
    </div>
  );
}

function NumberedItem({
  number,
  title,
  description,
  as: Item = "div",
  headingAs: Heading = "h3",
  className = "",
}) {
  return (
    <Item className={`numbered-item ${className}`.trim()} role="listitem">
      <span className="numbered-item__number">{number}</span>
      <div className="numbered-item__body">
        <Heading className="numbered-item__title">{title}</Heading>
        <p className="numbered-item__copy">{description}</p>
      </div>
    </Item>
  );
}

function LanguageToggle({ lang, setLang, compact = false }) {
  const t = copy[lang];
  return (
    <div className={`language-toggle ${compact ? "is-compact" : ""}`} aria-label={lang === "zh" ? "语言切换" : "Language switch"}>
      <button className={lang === "zh" ? "is-active" : ""} aria-pressed={lang === "zh"} onClick={() => setLang("zh")}>{t.languageChinese}</button>
      <span />
      <button className={lang === "en" ? "is-active" : ""} aria-pressed={lang === "en"} onClick={() => setLang("en")}>{t.languageEnglish}</button>
    </div>
  );
}

function IconButton({ label, children, onClick, className = "" }) {
  return (
    <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

function Modal({ open, onClose, children, className = "", label }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    document.body.classList.add("is-modal-open");
    requestAnimationFrame(() => dialogRef.current?.focus());
    const onKey = (event) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((node) => !node.hasAttribute("hidden"));
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("is-modal-open");
      previous?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal-panel ${className}`} role="dialog" aria-modal="true" aria-label={label} tabIndex="-1" ref={dialogRef}>
        {children}
      </div>
    </div>
  );
}

function DrawerHeader({ title, subtitle, onClose, lang = "en" }) {
  return (
    <div className="drawer-header">
      <div>
        <p className="eyebrow">{subtitle}</p>
        <h2>{title}</h2>
      </div>
      <IconButton label={lang === "zh" ? "关闭" : "Close"} onClick={onClose}><X size={20} /></IconButton>
    </div>
  );
}

function formatPrice(amount, currency) {
  const value = amount * currency.rate;
  if (currency.code === "USDT") return `${value.toFixed(currency.digits)} USDT`;
  try {
    return new Intl.NumberFormat(currency.code === "CNY" ? "zh-CN" : "en-US", {
      style: "currency",
      currency: currency.code,
      minimumFractionDigits: currency.digits,
      maximumFractionDigits: currency.digits,
    }).format(value);
  } catch {
    return `${currency.token} ${value.toFixed(currency.digits)}`;
  }
}

function getReferencePrice(product, currency) {
  if (currency.code === "USDT") {
    return {
      token: "RM",
      value: formatPrice(product.price, currencies[0]),
    };
  }
  return {
    token: "₮",
    value: `${product.usdt.toFixed(2)} USDT`,
  };
}

function ReferencePrice({ product, currency, className = "usdt-line" }) {
  const reference = getReferencePrice(product, currency);
  return <span className={className}><i>{reference.token}</i> ≈ {reference.value}</span>;
}

function ClientHeader({ lang, setLang, currency, onCurrency, onSupport, notify }) {
  const t = copy[lang];
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={`client-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="client-header__inner">
        <button className="brand-lockup" onClick={() => go("/home", { resetScroll: true })} aria-label={t.homeLabel}>
          <BrandMark size="client" />
          <span className="brand-lockup__text">
            <strong>{lang === "zh" ? <>云桥 <em>CloudBridge</em></> : "CloudBridge"}</strong>
          </span>
        </button>
        <nav className="client-header__actions" aria-label={lang === "zh" ? "快捷操作" : "Utility actions"}>
          <LanguageToggle
            lang={lang}
            setLang={(nextLang) => {
              setLang(nextLang);
              notify({
                type: "success",
                message: nextLang === "zh" ? "语言已切换为中文" : "Language changed to English",
              });
            }}
            compact
          />
          <button
            className="currency-trigger"
            aria-label={lang === "zh" ? `当前币种 ${currency.code}，切换币种` : `Current currency ${currency.code}, change currency`}
            title={lang === "zh" ? "切换币种" : "Change currency"}
            onClick={onCurrency}
          >
            <CurrencyToken currency={currency} compact />
            <strong>{currency.code}</strong>
            <CaretDown size={13} />
          </button>
          <button className="support-trigger" aria-label={t.contactSupport} title={t.contactSupport} onClick={onSupport}>
            <Headset size={18} />
            <span>{t.contactSupport}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}

function HeroCarousel({ lang, onProduct, compact = false }) {
  const [index, setIndex] = useState(compact ? 1 : 0);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStart = useRef(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);
  const paused = hovered || focusWithin || manualPaused || reducedMotion;
  useEffect(() => {
    if (paused) return undefined;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % heroes.length), 6500);
    return () => window.clearInterval(timer);
  }, [paused]);
  const hero = heroes[index];
  const move = (direction) => {
    setManualPaused(true);
    setIndex((value) => (value + direction + heroes.length) % heroes.length);
  };
  const activate = () => {
    if (hero.target === "products") document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
    else onProduct(hero.target);
  };
  const Heading = compact ? "h2" : "h1";
  return (
    <section
      className={`hero-shell ${compact ? "is-compact" : ""}`}
      aria-roledescription={lang === "zh" ? "轮播图" : "carousel"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
      }}
      onTouchStart={(event) => {
        touchStart.current = event.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchStart.current === null) return;
        const distance = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
        touchStart.current = null;
        if (Math.abs(distance) >= 42) move(distance < 0 ? 1 : -1);
      }}
      onPointerDown={(event) => {
        if (event.pointerType !== "touch") touchStart.current = event.clientX;
      }}
      onPointerUp={(event) => {
        if (event.pointerType === "touch" || touchStart.current === null) return;
        const distance = event.clientX - touchStart.current;
        touchStart.current = null;
        if (Math.abs(distance) >= 42) move(distance < 0 ? 1 : -1);
      }}
    >
      <div className={`hero-stage tone-${hero.tone}`}>
        <AsyncImage
          key={hero.image}
          className="hero-image"
          src={hero.image}
          alt=""
          priority={index === 0}
          fallbackLabel={lang === "zh" ? "品牌图片暂不可用" : "Brand image unavailable"}
        />
        <div className="hero-shade" />
        <div className="hero-copy" key={`${lang}-${index}`}>
          <p className="eyebrow"><span />{hero.eyebrow[lang]}</p>
          <Heading>{hero.title[lang].split("\n").map((line) => <span key={line}>{line}</span>)}</Heading>
          <p>{hero.copy[lang]}</p>
          <button className="bridge-button" onClick={activate}>
            <span>{hero.cta[lang]}</span>
            <i><ArrowRight size={17} /></i>
          </button>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <i /><i /><i />
        </div>
        <div className="hero-controls">
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div className="hero-progress"><i style={{ width: `${((index + 1) / heroes.length) * 100}%` }} /></div>
          <span>{String(heroes.length).padStart(2, "0")}</span>
          <div className="hero-arrows">
            <IconButton label={copy[lang].previousStory} onClick={() => move(-1)}><CaretLeft size={17} /></IconButton>
            <IconButton label={copy[lang].nextStory} onClick={() => move(1)}><CaretRight size={17} /></IconButton>
          </div>
        </div>
        <div
          className="hero-mobile-dots"
          role="status"
          aria-label={lang === "zh"
            ? `第 ${index + 1} 张，共 ${heroes.length} 张`
            : `Slide ${index + 1} of ${heroes.length}`}
        >
          {heroes.map((item, dotIndex) => (
            <i
              className={dotIndex === index ? "is-active" : ""}
              aria-hidden="true"
              key={item.image}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CapabilityRail({ lang }) {
  const t = copy[lang];
  const icons = [GlobeHemisphereWest, CurrencyCircleDollar, LinkSimple, Headset];
  return (
    <section className="capability-rail" aria-label={t.capabilitiesLabel}>
      <div className="capability-line" aria-hidden="true"><i /><i /><i /><i /></div>
      {t.capability.map((label, index) => {
        const Glyph = icons[index];
        return (
          <div className="capability-item" key={label}>
            <span className="capability-glyph"><Glyph size={22} /></span>
            <div><strong>{label}</strong><small>{t.capabilityCopy[index]}</small></div>
          </div>
        );
      })}
    </section>
  );
}

function StockLabel({ product, lang }) {
  const t = copy[lang];
  if (product.stock === 0) return <span className="stock-label sold"><i />{t.soldOut}</span>;
  if (product.stock <= 3) {
    return <span className="stock-label low"><i />{t.lowStock.replace("{count}", product.stock)}</span>;
  }
  return <span className="stock-label"><i />{t.inStock}</span>;
}

function ProductCard({ product, lang, currency, onOpen, onBuy, compact = false, index = 0 }) {
  const t = copy[lang];
  const openProduct = () => onOpen(product);
  return (
    <article className={`product-card ${compact ? "is-compact" : ""} ${product.stock === 0 ? "is-sold" : ""}`}>
      <button className="product-card__visual" aria-label={`${t.viewDetail}: ${product.name[lang]}`} onClick={openProduct}>
        <AsyncImage
          src={product.image}
          alt={product.name[lang]}
          fallbackLabel={lang === "zh" ? "品牌图片暂不可用" : "Brand image unavailable"}
        />
        <span className="product-index">CB / {String(index + 1).padStart(2, "0")}</span>
        <span className="product-arrow"><ArrowRight size={16} /></span>
      </button>
      <div className="product-card__content">
        <div className="product-identity">
          <button className="product-title-button" onClick={openProduct}>
            <LocalizedText as="h3" value={product.name} lang={lang} />
          </button>
        </div>
        <div className="price-block">
          <div className="price-line">
            <strong>{formatPrice(product.price, currency)}</strong>
            <del>{formatPrice(product.compare, currency)}</del>
          </div>
          <ReferencePrice product={product} currency={currency} />
        </div>
        <div className="product-card__footer">
          <StockLabel product={product} lang={lang} />
          <button className="product-cta" disabled={product.stock === 0} onClick={() => onBuy(product)}>
            <span>{product.stock === 0 ? t.soldOut : t.buyNow}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

function ContactSection({ lang, onSupport }) {
  const t = copy[lang];
  return (
    <section className="contact-section page-section">
      <div className="contact-art" aria-hidden="true"><i /><i /><i /><i /></div>
      <div>
        <p className="eyebrow">{t.humanConnection}</p>
        <h2>{t.contactTitle}</h2>
        <p>{t.contactCopy}</p>
      </div>
      <button className="bridge-button light" onClick={onSupport}>
        <span>{t.contactSupport}</span><i><ChatsCircle size={18} /></i>
      </button>
    </section>
  );
}

function ClientFooter({ lang }) {
  const t = copy[lang];
  return (
    <footer className="client-footer">
      <div className="footer-brand">
        <BrandMark size="footer" />
        <div><strong>{t.brandName}</strong></div>
      </div>
      <div className="footer-links">
        <button onClick={() => go("/policy/privacy")}><span>{t.privacy}</span><ArrowRight size={16} /></button>
        <button onClick={() => go("/policy/terms")}><span>{t.terms}</span><ArrowRight size={16} /></button>
        <button onClick={() => go("/policy/delivery")}><span>{t.delivery}</span><ArrowRight size={16} /></button>
        <button onClick={() => go("/policy/refund")}><span>{t.refund}</span><ArrowRight size={16} /></button>
        <button onClick={() => go("/policy/cookies")}><span>{t.cookies}</span><ArrowRight size={16} /></button>
      </div>
      <p>{t.footerLegal}</p>
    </footer>
  );
}

function ClientHome({
  lang,
  currency,
  onProduct,
  onBuy,
  onSupport,
  categories,
  catalogProducts,
}) {
  const t = copy[lang];
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const categoryFilterRef = useRef(null);
  const [categoryOverflow, setCategoryOverflow] = useState({
    canScrollBackward: false,
    canScrollForward: false,
  });
  const activeCategories = useMemo(
    () => sortProductCategories(categories).filter((category) => category.active),
    [categories],
  );
  const visibleProducts = useMemo(
    () => filterCatalogProducts(catalogProducts, { query, categoryId }),
    [catalogProducts, categoryId, query],
  );
  useEffect(() => {
    if (categoryId !== "all" && !activeCategories.some((category) => category.id === categoryId)) {
      setCategoryId("all");
    }
  }, [activeCategories, categoryId]);
  const updateCategoryOverflow = useCallback(() => {
    const filter = categoryFilterRef.current;
    if (!filter) return;
    const nextOverflow = readHorizontalOverflow(filter);
    setCategoryOverflow((current) => (
      current.canScrollBackward === nextOverflow.canScrollBackward
      && current.canScrollForward === nextOverflow.canScrollForward
        ? current
        : nextOverflow
    ));
  }, []);
  useEffect(() => {
    const filter = categoryFilterRef.current;
    if (!filter) return undefined;
    const frame = window.requestAnimationFrame(updateCategoryOverflow);
    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(updateCategoryOverflow)
      : null;

    filter.addEventListener("scroll", updateCategoryOverflow, { passive: true });
    if (resizeObserver) resizeObserver.observe(filter);
    else window.addEventListener("resize", updateCategoryOverflow);

    return () => {
      window.cancelAnimationFrame(frame);
      filter.removeEventListener("scroll", updateCategoryOverflow);
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", updateCategoryOverflow);
    };
  }, [activeCategories, lang, updateCategoryOverflow]);
  const selectCategory = useCallback((nextCategoryId, button) => {
    setCategoryId(nextCategoryId);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    button.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, []);
  return (
    <>
      <HeroCarousel lang={lang} onProduct={onProduct} />
      <main id="products" className="client-main">
        <CapabilityRail lang={lang} />
        <section className="product-section page-section" aria-labelledby="catalog-title">
          <div className="section-heading-row">
            <div className="section-heading">
              <h2 id="catalog-title">{t.productsTitle}</h2>
              <p className="section-heading__copy">{t.productsCopy}</p>
            </div>
            <div className="section-currency"><span>{t.currentCurrency}</span><strong>{currency.code}</strong></div>
          </div>
          <div className="catalog-tools" aria-label={t.discoverTitle}>
            <label className="product-search">
              <MagnifyingGlass size={24} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.searchProducts}
                aria-label={t.searchProducts}
                autoComplete="off"
              />
              {query && (
                <button type="button" aria-label={t.clearSearch} title={t.clearSearch} onClick={() => setQuery("")}>
                  <X size={18} />
                </button>
              )}
            </label>
            <div
              className={[
                "category-filter-shell",
                categoryOverflow.canScrollBackward ? "can-scroll-backward" : "",
                categoryOverflow.canScrollForward ? "can-scroll-forward" : "",
              ].filter(Boolean).join(" ")}
            >
              <div
                className="category-filter"
                aria-label={lang === "zh" ? "商品分类" : "Product categories"}
                role="group"
                ref={categoryFilterRef}
              >
                <button
                  type="button"
                  className={categoryId === "all" ? "is-active" : ""}
                  aria-pressed={categoryId === "all"}
                  onClick={(event) => selectCategory("all", event.currentTarget)}
                >
                  {t.categoryAll}
                </button>
                {activeCategories.map((category) => (
                  <button
                    type="button"
                    className={categoryId === category.id ? "is-active" : ""}
                    aria-pressed={categoryId === category.id}
                    onClick={(event) => selectCategory(category.id, event.currentTarget)}
                    key={category.id}
                  >
                    {category.name[lang]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {visibleProducts.length ? (
            <div className="product-grid catalog-product-grid">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  lang={lang}
                  currency={currency}
                  onOpen={onProduct}
                  onBuy={onBuy}
                  index={catalogProducts.findIndex((item) => item.id === product.id)}
                />
              ))}
            </div>
          ) : (
            <div className="product-empty" role="status">
              <MagnifyingGlass size={28} />
              <strong>{t.noResultsTitle}</strong>
              <p>{t.noResultsCopy}</p>
              <button type="button" onClick={() => { setQuery(""); setCategoryId("all"); }}>{t.clearSearch}</button>
            </div>
          )}
        </section>
        <ContactSection lang={lang} onSupport={onSupport} />
      </main>
      <ClientFooter lang={lang} />
    </>
  );
}

function ProductDetail({ product, lang, currency, onBuy, onSupport }) {
  const t = copy[lang];
  if (!product) return <NotFound lang={lang} />;
  return (
    <main className="detail-page client-main">
      <button className="back-link" onClick={() => go("/home")}><ArrowLeft size={17} />{t.backHome}</button>
      <section className="detail-hero">
        <div className="detail-visual">
          <AsyncImage
            src={product.image}
            alt={product.name[lang]}
            priority
            fallbackLabel={lang === "zh" ? "品牌图片暂不可用" : "Brand image unavailable"}
          />
          <span>{lang === "zh" ? "CB / 服务" : "CB / SERVICE"} / {product.id.toUpperCase()}</span>
        </div>
        <div className="detail-info">
          <h1>{product.name[lang]}</h1>
          <div className="detail-price">
            <strong>{formatPrice(product.price, currency)}</strong>
            <del>{formatPrice(product.compare, currency)}</del>
            <ReferencePrice product={product} currency={currency} />
          </div>
          <div className="detail-status-row">
            <p className="detail-time"><Clock size={17} />{t.processingTime}</p>
            <StockLabel product={product} lang={lang} />
          </div>
          <div className="detail-actions">
            <button className="bridge-button" disabled={product.stock === 0} onClick={() => onBuy(product)}>
              <span>{product.stock === 0 ? t.soldOut : t.buyNow}</span><i><ArrowRight size={17} /></i>
            </button>
            <button className="outline-button" onClick={onSupport}><Headset size={18} />{t.contactSupport}</button>
          </div>
        </div>
      </section>
      <section className="detail-intro">
        <p className="eyebrow">{t.serviceNotes}</p>
        <h2>{t.productIntro}</h2>
        <p>{product.description[lang]}</p>
        <div className="intro-notes" role="list">
          <NumberedItem
            number="01"
            title={lang === "zh" ? "清楚报价" : "Clear pricing"}
            description={lang === "zh" ? "币种与 USDT 参考价格同时展示。" : "Selected currency and USDT reference are shown together."}
          />
          <NumberedItem
            number="02"
            title={lang === "zh" ? "极简下单" : "Minimal checkout"}
            description={lang === "zh" ? "只填写一种联系方式，不创建商城账号。" : "Leave one contact channel. No store account is created."}
          />
          <NumberedItem
            number="03"
            title={lang === "zh" ? "人工交付" : "Human delivery"}
            description={lang === "zh" ? "客服确认付款与最终交付信息。" : "Support confirms payment and final delivery details."}
          />
        </div>
      </section>
    </main>
  );
}

function CurrencyDrawer({ open, onClose, lang, currency, setCurrency, notify }) {
  const t = copy[lang];
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);
  const visibleCurrencies = currencies.filter((item) => {
    const haystack = `${item.code} ${item.token} ${item.name.zh} ${item.name.en}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  return (
    <Modal open={open} onClose={onClose} className="side-drawer currency-drawer" label={lang === "zh" ? "选择币种" : "Choose currency"}>
      <DrawerHeader title={t.currency} subtitle={t.currencyTokens} onClose={onClose} lang={lang} />
      <div className="detected-currency">
        <GlobeHemisphereWest size={22} />
        <div><strong>{t.autoRecommend}</strong><span>{lang === "zh" ? "马来西亚 · MYR" : "Malaysia · MYR"}</span></div>
      </div>
      <label className="drawer-search">
        <MagnifyingGlass size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={lang === "zh" ? "搜索币种" : "Search currencies"}
          type="search"
        />
      </label>
      <div className="currency-list" role="listbox" aria-label={t.currency}>
        {visibleCurrencies.map((item) => (
          <button
            key={item.code}
            className={currency.code === item.code ? "is-active" : ""}
            role="option"
            aria-selected={currency.code === item.code}
            onClick={() => {
              setCurrency(item);
              notify({
                type: "success",
                message: lang === "zh" ? `价格已切换为 ${item.code}` : `Prices changed to ${item.code}`,
              });
              onClose();
            }}
          >
            <CurrencyToken currency={item} />
            <span><strong>{item.code}</strong><small>{item.name[lang]}</small></span>
            {currency.code === item.code && <Check size={17} weight="bold" />}
          </button>
        ))}
        {!visibleCurrencies.length && (
          <div className="currency-empty" role="status">
            <MagnifyingGlass size={21} />
            <strong>{lang === "zh" ? "没有匹配的币种" : "No matching currency"}</strong>
            <span>{lang === "zh" ? "请尝试币种代码或名称" : "Try a currency code or name"}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

function SupportDrawer({ open, onClose, lang, notify }) {
  const [copied, setCopied] = useState("");
  const [wechatQrOpen, setWechatQrOpen] = useState(false);
  const [qqFallbackVisible, setQqFallbackVisible] = useState(false);
  useEffect(() => {
    if (!open) {
      setWechatQrOpen(false);
      setQqFallbackVisible(false);
    }
  }, [open]);
  const handleCopy = async (value) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setCopied(value);
      notify({ type: "success", message: lang === "zh" ? "账号已复制" : "Account copied" });
      window.setTimeout(() => setCopied(""), 1400);
    } catch {
      notify({ type: "error", message: lang === "zh" ? "复制失败，请手动选择账号" : "Copy failed. Select the account manually." });
    }
  };
  const handleQqJump = () => {
    window.setTimeout(() => setQqFallbackVisible(true), 900);
  };
  return (
    <Modal open={open} onClose={onClose} className="side-drawer support-drawer" label={lang === "zh" ? "人工客服连接" : "Human support"}>
      <DrawerHeader title={lang === "zh" ? "人工客服连接" : "Human support"} subtitle={copy[lang].supportBridge} onClose={onClose} lang={lang} />
      <p className="drawer-lead">{lang === "zh" ? "联系方式由后台统一配置。WhatsApp、Email、Telegram 与 QQ 可直接打开；微信使用二维码或复制账号。" : "Channels are managed in the admin. WhatsApp, email, Telegram and QQ can open directly; use a QR code or copied ID for WeChat."}</p>
      <div className="channel-list">
        {merchantChannels.map((channel) => {
          const Glyph = channelIcons[channel.type];
          const directHref = getChannelHref(channel, lang);
          const isWechat = channel.type === "wechat";
          const isQq = channel.type === "qq";
          const capability = isWechat
            ? (lang === "zh" ? "扫码 / 复制" : "QR / copy")
            : (lang === "zh" ? "可直接打开" : "Direct link");
          return (
            <article className={`channel-card channel-card--${channel.type}`} key={channel.type}>
              <header>
                <span className={`channel-icon ${channel.type}`}><Glyph size={25} /></span>
                <div><strong>{channel.label[lang]}</strong><span>{channel.account}</span></div>
                <em className={channel.direct ? "is-direct" : "is-copy-only"}>
                  {channel.direct ? <ArrowSquareOut size={13} /> : <QrCode size={13} />}
                  {capability}
                </em>
              </header>
              <div className="channel-meta">
                <span><Clock size={13} />{channel.hours}</span>
                <small>
                  {channel.type === "whatsapp" && (lang === "zh" ? "自动带入咨询消息" : "Prefills a support message")}
                  {isWechat && (lang === "zh" ? "网页无法稳定直达个人微信" : "Personal WeChat cannot be opened reliably from the web")}
                  {isQq && (lang === "zh" ? "优先唤起 QQ 客户端" : "Attempts to open the QQ app first")}
                  {channel.type === "email" && (lang === "zh" ? "仅用于客服往来，不发送订单营销邮件" : "For support only; no order marketing emails")}
                  {channel.type === "telegram" && (lang === "zh" ? "打开 Telegram 客服会话" : "Opens the Telegram support chat")}
                </small>
              </div>
              <div className="channel-actions">
                {channel.direct ? (
                  <a
                    className="channel-primary-action"
                    href={directHref}
                    target={["whatsapp", "telegram"].includes(channel.type) ? "_blank" : undefined}
                    rel={["whatsapp", "telegram"].includes(channel.type) ? "noreferrer" : undefined}
                    onClick={isQq ? handleQqJump : undefined}
                  >
                    <ArrowSquareOut size={16} />
                    {lang === "zh" ? `打开 ${channel.label.zh}` : `Open ${channel.label.en}`}
                  </a>
                ) : (
                  <button className="channel-primary-action" onClick={() => setWechatQrOpen((value) => !value)}>
                    <QrCode size={16} />
                    {lang === "zh" ? "查看二维码" : "View QR code"}
                  </button>
                )}
                <button className="channel-copy-action" onClick={() => handleCopy(channel.account)}>
                  {copied === channel.account ? <Check size={16} /> : <Copy size={16} />}
                  {copied === channel.account
                    ? (lang === "zh" ? "已复制" : "Copied")
                    : (lang === "zh" ? "复制账号" : "Copy ID")}
                </button>
              </div>
              {isWechat && wechatQrOpen && (
                <div className="wechat-qr-panel">
                  <span><QrCode size={34} /></span>
                  <div>
                    <strong>{lang === "zh" ? "微信二维码位置" : "WeChat QR position"}</strong>
                    <small>{lang === "zh" ? "正式版本显示后台上传的客服二维码" : "The live site will show the QR uploaded in the admin."}</small>
                  </div>
                </div>
              )}
              {isQq && qqFallbackVisible && (
                <div className="qq-fallback">
                  <WarningCircle size={15} />
                  <span>{lang === "zh" ? "QQ 没有打开？请复制 QQ 号后手动搜索。" : "QQ did not open? Copy the QQ number and search manually."}</span>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className="support-note"><ShieldCheck size={20} /><span>{lang === "zh" ? "客服不会在订单表单中索取第三方账号密码。" : "Support will not ask for third-party account passwords in the order form."}</span></div>
    </Modal>
  );
}

function BuyDialog({ product, open, onClose, lang, currency, onSuccess, notify }) {
  const t = copy[lang];
  const [channel, setChannel] = useState("whatsapp");
  const [value, setValue] = useState("");
  const [step, setStep] = useState("contact");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState("");
  const [consentError, setConsentError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const cancelPendingRef = useRef(null);
  useEffect(() => {
    if (open) {
      setStep("contact");
      setValue("");
      setConsentAccepted(false);
      setError("");
      setConsentError("");
      setSubmitError("");
      setSubmitting(false);
    }
  }, [open, product]);
  useEffect(() => () => cancelPendingRef.current?.(), []);
  if (!product) return null;
  const close = () => {
    cancelPendingRef.current?.();
    cancelPendingRef.current = null;
    setSubmitting(false);
    onClose();
  };
  const submit = (event) => {
    event.preventDefault();
    if (submitting) return;
    if (step === "contact") {
      const nextError = validateContact(channel, value, {
        required: t.requiredError,
        format: t.formatError,
      });
      setError(nextError);
      setConsentError(consentAccepted ? "" : (lang === "zh" ? "请确认隐私与数字服务交付说明。" : "Confirm the privacy and digital delivery notice."));
      if (nextError) requestAnimationFrame(() => inputRef.current?.focus());
      if (nextError || !consentAccepted) return;
      setStep("review");
      setSubmitError("");
      return;
    }
    const nextError = validateContact(channel, value, {
      required: t.requiredError,
      format: t.formatError,
    });
    if (nextError) {
      setError(nextError);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    setError("");
    setSubmitError("");
    setSubmitting(true);
    cancelPendingRef.current = createCancelableDelay(() => {
      cancelPendingRef.current = null;
      if (!navigator.onLine || window.__CLOUDBRIDGE_FORCE_ORDER_ERROR__) {
        setSubmitting(false);
        setSubmitError(lang === "zh" ? "连接订单失败，请检查网络后重试。" : "Could not connect the order. Check your network and retry.");
        notify({ type: "error", message: lang === "zh" ? "订单提交失败" : "Order submission failed" });
        return;
      }
      setSubmitting(false);
      onClose();
      onSuccess({
        id: createOrderId(),
        product,
        currency,
        channel,
        contact: value,
        paymentMode: "manual",
        status: "manualPending",
        reservedUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
    }, 850);
  };
  return (
    <Modal open={open} onClose={close} className="buy-dialog" label={t.buyTitle}>
      <form onSubmit={submit} noValidate aria-busy={submitting}>
        <DrawerHeader
          title={step === "review" ? (lang === "zh" ? "确认人工订单" : "Review manual order") : t.buyTitle}
          subtitle={`${t.checkoutBridge} · ${step === "review" ? "02" : "01"} / 02`}
          onClose={close}
          lang={lang}
        />
        <div className="checkout-mode-note" role="status">
          <ShieldCheck size={18} />
          <div>
            <strong>{lang === "zh" ? "在线支付未开启" : "Online payment is off"}</strong>
            <span>{lang === "zh" ? "提交后只生成“待人工处理”凭证，不会跳转支付或自动扣款。" : "Submitting creates an “awaiting manual review” receipt only. No payment redirect or charge occurs."}</span>
          </div>
        </div>
        <div className="buy-summary">
          <span className="buy-summary__visual">
            <AsyncImage
              src={product.image}
              alt=""
              fallbackLabel={lang === "zh" ? "品牌图片暂不可用" : "Brand image unavailable"}
            />
          </span>
          <div>
            <small>{product.kicker[lang]}</small>
            <strong>{product.name[lang]}</strong>
            <span>{formatPrice(product.price, currency)} · {getReferencePrice(product, currency).value}</span>
          </div>
        </div>
        {step === "contact" ? (
          <>
            <div className="contact-tabs" role="group" aria-label={t.contactType}>
              {merchantChannels.map((item) => {
                const Glyph = channelIcons[item.type];
                return (
                  <button
                    type="button"
                    key={item.type}
                    className={channel === item.type ? "is-active" : ""}
                    aria-pressed={channel === item.type}
                    disabled={submitting}
                    onClick={() => {
                      setChannel(item.type);
                      setError("");
                      setSubmitError("");
                      requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                  >
                    <Glyph size={19} />{item.label[lang]}
                  </button>
                );
              })}
            </div>
            <label className={`field-label ${error ? "has-error" : ""}`}>
              <span>{t.contactValue}</span>
              <div>
                <LinkSimple size={18} />
                <input
                  ref={inputRef}
                  value={value}
                  disabled={submitting}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "checkout-contact-error" : "checkout-consent"}
                  onChange={(event) => {
                    setValue(event.target.value);
                    setError("");
                    setSubmitError("");
                  }}
                  placeholder={{
                    whatsapp: "+60128886618",
                    email: "name@example.com",
                    telegram: "@cloudbridge_user",
                    wechat: "CloudBridge_AI",
                    qq: "288661812",
                  }[channel]}
                />
              </div>
              {error && <small id="checkout-contact-error" role="alert"><WarningCircle size={14} />{error}</small>}
            </label>
            <label className={`checkout-consent ${consentError ? "has-error" : ""}`} id="checkout-consent">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(event) => {
                  setConsentAccepted(event.target.checked);
                  setConsentError("");
                }}
              />
              <span>
                {lang === "zh"
                  ? "我同意仅为处理订单使用此联系方式，并已阅读隐私政策、数字服务交付与退款规则。"
                  : "I agree that this contact may be used only to handle the order, and I have read the privacy, digital delivery and refund policies."}
              </span>
            </label>
            {consentError && <small className="checkout-consent-error" role="alert"><WarningCircle size={14} />{consentError}</small>}
          </>
        ) : (
          <section className="checkout-review" aria-label={lang === "zh" ? "订单确认信息" : "Order review"}>
            <dl>
              <div><dt>{lang === "zh" ? "订单状态" : "Order status"}</dt><dd><span className="manual-status-dot" />{lang === "zh" ? "待人工处理" : "Awaiting manual review"}</dd></div>
              <div><dt>{lang === "zh" ? "联系渠道" : "Contact channel"}</dt><dd>{getChannelLabel(channel, lang)}</dd></div>
              <div><dt>{lang === "zh" ? "联系方式" : "Contact"}</dt><dd>{value}</dd></div>
              <div><dt>{lang === "zh" ? "价格有效期" : "Price validity"}</dt><dd>{lang === "zh" ? "提交后 30 分钟" : "30 minutes after submission"}</dd></div>
              <div><dt>{lang === "zh" ? "交付方式" : "Delivery"}</dt><dd>{lang === "zh" ? "客服确认后通过所选渠道人工交付" : "Manual fulfilment through the selected channel after confirmation"}</dd></div>
            </dl>
            <p><WarningCircle size={16} />{lang === "zh" ? "库存或汇率若在提交时变化，将停止创建并要求重新确认。" : "If stock or rates change at submission, creation stops and asks for confirmation again."}</p>
          </section>
        )}
        {submitError && (
          <div className="form-error" role="alert">
            <WarningCircle size={16} />
            <span>{submitError}</span>
          </div>
        )}
        {step === "review" && (
          <button type="button" className="checkout-back-button" disabled={submitting} onClick={() => setStep("contact")}>
            <ArrowLeft size={16} />{lang === "zh" ? "返回修改" : "Back to edit"}
          </button>
        )}
        <button type="submit" className={`submit-button ${submitting ? "is-loading" : ""}`} disabled={submitting}>
          <span className="submit-node" />
          <i />
          <span>
            {submitting
              ? t.submitting
              : step === "contact"
                ? (lang === "zh" ? "查看订单确认" : "Review order")
                : submitError
                  ? (lang === "zh" ? "重试提交" : "Retry order")
                  : (lang === "zh" ? "确认并生成凭证" : "Confirm and create receipt")}
          </span>
          <span className="submit-node" />
        </button>
      </form>
    </Modal>
  );
}

function OrderSuccess({ order, lang, onSupport, notify }) {
  const t = copy[lang];
  if (!order) {
    return (
      <main className="success-page client-main success-page--empty">
        <div className="success-signal is-empty" aria-hidden="true"><i /><span><Receipt size={27} /></span><i /></div>
        <p className="eyebrow">{t.connectionEstablished}</p>
        <h1>{lang === "zh" ? "没有可恢复的订单" : "No order to restore"}</h1>
        <p className="success-lead">
          {lang === "zh" ? "本页不会伪造订单。请返回浏览商品，或联系人工客服处理已有凭证。" : "This page does not create a placeholder order. Browse products or contact support about an existing receipt."}
        </p>
        <div className="success-actions">
          <button className="bridge-button" onClick={() => go("/home", { resetScroll: true })}><span>{t.backHome}</span><i><ArrowLeft size={17} /></i></button>
          <button className="outline-button" onClick={onSupport}><Headset size={17} />{t.openSupport}</button>
        </div>
      </main>
    );
  }
  const reference = getReferencePrice(order.product, order.currency);
  const reservedUntil = new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(order.reservedUntil));
  const copyOrderId = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(order.id);
      notify({ type: "success", message: lang === "zh" ? "订单号已复制" : "Order number copied" });
    } catch {
      notify({ type: "error", message: lang === "zh" ? "复制失败，请手动选择订单号" : "Copy failed. Select the order number manually." });
    }
  };
  return (
    <main className="success-page client-main">
      <div className="success-signal" aria-hidden="true"><i /><span><Check size={28} weight="bold" /></span><i /></div>
      <p className="eyebrow">{t.connectionEstablished}</p>
      <h1>{t.successTitle}</h1>
      <p className="success-lead">{t.successCopy}</p>
      <section className="success-card">
        <div className="success-status-row">
          <span><i />{lang === "zh" ? "待人工处理" : "Awaiting manual review"}</span>
          <small>{lang === "zh" ? "尚未付款" : "Not paid"}</small>
        </div>
        <div className="success-product">
          <span>
            <AsyncImage
              src={order.product.image}
              alt=""
              fallbackLabel={lang === "zh" ? "品牌图片暂不可用" : "Brand image unavailable"}
            />
          </span>
          <div><small>{order.product.kicker[lang]}</small><strong>{order.product.name[lang]}</strong></div>
        </div>
        <dl>
          <div>
            <dt>{t.orderNo}</dt>
            <dd className="order-id-value">{order.id}<button type="button" onClick={copyOrderId} aria-label={lang === "zh" ? "复制订单号" : "Copy order number"}><Copy size={14} /></button></dd>
          </div>
          <div><dt>{lang === "zh" ? "应付金额" : "Amount"}</dt><dd>{formatPrice(order.product.price, order.currency)}</dd></div>
          <div><dt>{order.currency.code === "USDT" ? "MYR" : "USDT"}</dt><dd>{reference.value}</dd></div>
          <div><dt>{t.reservedUntil}</dt><dd>{reservedUntil}</dd></div>
        </dl>
        <div className="success-timeline" aria-label={lang === "zh" ? "订单处理进度" : "Order progress"}>
          <span className="done" aria-label={lang === "zh" ? "已完成：订单提交" : "Complete: order submitted"}>1</span>
          <i className="done" />
          <span className="active" aria-current="step" aria-label={lang === "zh" ? "当前：人工处理" : "Current: manual review"}>2</span>
          <i />
          <span className="upcoming" aria-label={lang === "zh" ? "待进行：服务完成" : "Upcoming: fulfilment"}>3</span>
        </div>
        <div className="timeline-labels">
          <span className="done">{lang === "zh" ? "订单已提交" : "Order submitted"}</span>
          <span className="active">{lang === "zh" ? "等待人工处理" : "Manual review pending"}</span>
          <span className="upcoming">{lang === "zh" ? "付款与交付" : "Payment & fulfilment"}</span>
        </div>
      </section>
      <div className="success-actions">
        <button className="bridge-button" onClick={onSupport}><span>{t.openSupport}</span><i><ChatsCircle size={18} /></i></button>
        <button className="outline-button" onClick={() => go("/home", { resetScroll: true })}><ArrowLeft size={17} />{t.backHome}</button>
      </div>
    </main>
  );
}

function OrderLookup({ lang, restoredOrder, notify }) {
  const t = copy[lang];
  const [orderNo, setOrderNo] = useState(() => consumeLookupPrefill(window.sessionStorage));
  const [contact, setContact] = useState("");
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");
  const [errorField, setErrorField] = useState("");
  const orderRef = useRef(null);
  const contactRef = useRef(null);
  const resultRef = useRef(null);
  const cancelPendingRef = useRef(null);
  useEffect(() => () => cancelPendingRef.current?.(), []);
  useEffect(() => {
    if (state !== "success") return;
    requestAnimationFrame(() => {
      resultRef.current?.focus({ preventScroll: true });
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [state]);
  const submitLookup = (event) => {
    event.preventDefault();
    if (state === "loading") return;
    cancelPendingRef.current?.();
    const result = validateLookup(orderNo, contact, {
      missing: t.lookupMissing,
      invalid: t.lookupInvalid,
    });
    if (result.error) {
      setMessage(result.error);
      setErrorField(result.field);
      setState("error");
      requestAnimationFrame(() => (result.field === "contact" ? contactRef : orderRef).current?.focus());
      return;
    }
    setState("loading");
    setMessage("");
    setErrorField("");
    cancelPendingRef.current = createCancelableDelay(() => {
      cancelPendingRef.current = null;
      if (!navigator.onLine || window.__CLOUDBRIDGE_FORCE_LOOKUP_ERROR__) {
        setMessage(lang === "zh" ? "网络连接失败，请检查后重试。" : "Network connection failed. Check your connection and retry.");
        setState("network-error");
        notify({ type: "error", message: lang === "zh" ? "订单查询失败" : "Order lookup failed" });
        return;
      }
      if (result.normalizedOrder === mockOrders[0].id || result.normalizedOrder === restoredOrder?.id) {
        setState("success");
        notify({ type: "success", message: lang === "zh" ? "已找到订单" : "Order found" });
      } else {
        setMessage(t.lookupNotFound);
        setState("not-found");
      }
    }, 650);
  };
  const resetFeedback = () => {
    cancelPendingRef.current?.();
    cancelPendingRef.current = null;
    setState("idle");
    setMessage("");
    setErrorField("");
  };
  const resultOrderId = orderNo.trim().toUpperCase();
  return (
    <main className="lookup-page client-main">
      <button className="back-link" onClick={() => go("/home")}><ArrowLeft size={17} />{t.backHome}</button>
      <section className="lookup-shell">
        <div className="lookup-intro">
          <p className="eyebrow">{t.secureOrderLookup}</p>
          <h1>{t.lookupTitle}</h1>
          <p>{t.lookupCopy}</p>
          <div className="lookup-graphic" aria-hidden="true"><span /><i /><span /></div>
        </div>
        <form className="lookup-form" onSubmit={submitLookup} noValidate aria-busy={state === "loading"}>
          <label className={errorField === "orderNo" ? "has-error" : ""}>
            <span>{t.orderNo}</span>
            <div>
              <Receipt size={18} />
              <input
                ref={orderRef}
                value={orderNo}
                disabled={state === "loading"}
                aria-invalid={errorField === "orderNo"}
                aria-describedby={message ? "lookup-feedback" : undefined}
                onChange={(event) => {
                  setOrderNo(event.target.value);
                  resetFeedback();
                }}
                placeholder="CB-260727-8K3P9M"
                autoComplete="off"
              />
            </div>
          </label>
          <label className={errorField === "contact" ? "has-error" : ""}>
            <span>{t.contactValue}</span>
            <div>
              <LinkSimple size={18} />
              <input
                ref={contactRef}
                value={contact}
                disabled={state === "loading"}
                aria-invalid={errorField === "contact"}
                aria-describedby={message ? "lookup-feedback" : undefined}
                onChange={(event) => {
                  setContact(event.target.value);
                  resetFeedback();
                }}
                placeholder="+60128886618"
                autoComplete="off"
              />
            </div>
          </label>
          <button type="submit" className={`bridge-button ${state === "loading" ? "is-loading" : ""}`} disabled={state === "loading"}>
            <span>{state === "loading" ? t.querying : t.query}</span><i>{state === "loading" ? <ArrowsClockwise size={17} /> : <MagnifyingGlass size={17} />}</i>
          </button>
          {["error", "not-found", "network-error"].includes(state) && (
            <div id="lookup-feedback" className={`lookup-message ${state}`} role="alert">
              <WarningCircle size={17} />
              <span>{message}</span>
            </div>
          )}
          <p><LockKey size={15} />{lang === "zh" ? "需要同时验证订单号和原始联系方式。" : "Both the order number and original contact are required."}</p>
        </form>
      </section>
      {state === "success" && (
        <section className="lookup-result" ref={resultRef} tabIndex="-1" aria-label={lang === "zh" ? "订单查询结果" : "Order lookup result"}>
          <div><span className="status-dot" /><div><small>{lang === "zh" ? "查询结果" : "Result"}</small><strong>{resultOrderId}</strong></div><em>{lang === "zh" ? "等待客服联系" : "Awaiting contact"}</em></div>
          <div className="order-progress"><span className="done">01 <small>{lang === "zh" ? "订单提交" : "Submitted"}</small></span><i /><span className="active">02 <small>{lang === "zh" ? "客服接力" : "Support relay"}</small></span><i /><span>03 <small>{lang === "zh" ? "订单完成" : "Completed"}</small></span></div>
        </section>
      )}
    </main>
  );
}

function PolicyPage({ type, lang }) {
  const t = copy[lang];
  const titles = { privacy: t.privacy, terms: t.terms, delivery: t.delivery, refund: t.refund, cookies: t.cookies };
  const zhSections = {
    privacy: [
      ["01", "我们收集什么", "无注册模式仅处理订单商品、币种、金额、订单号、所选联系渠道与客户主动提供的联系方式。本站不要求第三方账号密码，也不保存银行卡信息。"],
      ["02", "处理目的与依据", "联系方式只用于订单确认、人工交付、售后和必要的安全沟通；不得用于订单营销邮件或转售。提交订单前必须取得明确同意。"],
      ["03", "访问、脱敏与审计", "后台默认隐藏敏感联系方式。获授权人员因处理订单揭示信息时，必须填写原因并记录人员、时间、订单和设备。"],
      ["04", "保留、删除与请求", "正式上线前应由业务和法律负责人确认各类数据保留期。到期自动删除或匿名化，并为访问、更正、导出和删除请求提供登记与处理记录。"],
      ["05", "安全措施", "生产系统应采用传输和静态加密、最小权限、MFA、会话保护、备份恢复、异常告警和供应商安全审查。"],
    ],
    terms: [
      ["01", "服务模式", "云桥提供无需注册的数字服务订单。支付关闭时，提交只生成待人工处理凭证，不代表订单已付款、已接受或已完成。"],
      ["02", "价格与有效期", "页面金额按独立选择的币种展示；参考汇率不等于结算承诺。库存、价格或汇率变化时，客户必须重新确认。"],
      ["03", "客户责任", "客户需提供可联系的渠道和准确订单信息，不得提交第三方密码、支付卡资料、违法内容或绕过平台规则的请求。"],
      ["04", "订单接受与取消", "订单经人工确认后才成立。云桥可因库存、地区限制、风控或服务不可用拒绝或取消，并明确告知下一步。"],
      ["05", "责任与争议", "正式条款应按运营主体和适用法律补充责任限制、争议解决、未成年人限制和第三方服务边界，并经法律审核。"],
    ],
    delivery: [
      ["01", "交付方式", "数字服务由客服在人工确认后，通过客户选择的 WhatsApp、Email、Telegram、微信或 QQ 渠道交付。"],
      ["02", "交付时效", "商品页必须显示预计响应和交付时段。维护、库存不足或风控复核造成延迟时，订单凭证应清楚显示降级状态。"],
      ["03", "安全交付", "客户不得发送第三方账号密码。需要第三方授权时，应采用该服务官方授权流程或一次性安全链接。"],
      ["04", "完成证据", "后台记录交付人员、时间、渠道和最少必要的交付结果；不得在日志中存储完整密钥、Token 或不必要的客户隐私。"],
    ],
    refund: [
      ["01", "可退款情形", "未开始交付、重复付款、错误金额、无法提供服务或法律要求的情况，可进入退款审核；部分交付可按实际完成范围评估部分退款。"],
      ["02", "不可退款说明", "数字服务已完整交付并被使用后，除服务缺陷、描述不符或法律另有要求外，通常不能仅因改变主意退款。"],
      ["03", "申请与审核", "客户通过客服提供订单凭证和原因。后台记录证据、审批人、金额、渠道与审计事件；敏感操作必须重新认证。"],
      ["04", "退款、拒付与争议", "退款原路退回；到账时间由支付提供商决定。拒付和争议应进入独立案件流程，禁止直接修改已结算订单。"],
    ],
    cookies: [
      ["01", "必要存储", "语言、币种和界面偏好属于保证网站可用的必要本地存储；语言与币种相互独立，客户可以随时切换。"],
      ["02", "可选追踪", "当前原型未接入分析或广告追踪。正式接入前应列明供应商、目的、期限，并在需要的地区取得选择同意。"],
      ["03", "偏好控制", "正式版本应提供接受、拒绝非必要追踪和重新打开偏好设置的入口；拒绝不得阻止浏览或人工下单。"],
      ["04", "第三方链接", "打开 WhatsApp、Telegram 等外部服务后，其 Cookie 与隐私处理由相应平台政策管理。"],
    ],
  };
  const enSections = {
    privacy: [
      ["01", "What we collect", "The no-account flow handles the product, currency, amount, order number, selected channel and contact voluntarily provided by the customer. It never asks for third-party passwords or stores card data."],
      ["02", "Purpose and basis", "Contact details are used only for order confirmation, manual delivery, support and necessary security communications—not order marketing or resale. Explicit consent is required before submission."],
      ["03", "Access, masking and audit", "Sensitive contact details are masked by default. An authorised reveal requires a reason and records the operator, time, order and device."],
      ["04", "Retention and requests", "Business and legal owners must approve retention periods before launch. Expired data is deleted or anonymised, with tracked access, correction, export and deletion requests."],
      ["05", "Security measures", "Production controls should include encryption in transit and at rest, least privilege, MFA, protected sessions, tested recovery, anomaly alerts and vendor review."],
    ],
    terms: [
      ["01", "Service model", "CloudBridge uses a no-account digital service order. With payments off, submission creates an awaiting-manual-review receipt only; it does not mean paid, accepted or fulfilled."],
      ["02", "Price and validity", "Amounts follow the independently selected currency. Reference rates are not settlement commitments. Stock, price or rate changes require a new confirmation."],
      ["03", "Customer responsibility", "Customers provide a reachable channel and accurate order details, and must not submit passwords, card details, unlawful content or requests that bypass platform rules."],
      ["04", "Acceptance and cancellation", "An order is accepted only after manual confirmation. CloudBridge may decline or cancel for stock, region, risk or service availability and must explain the next step."],
      ["05", "Liability and disputes", "The production terms require legal review of the operating entity, applicable law, liability limits, disputes, minors and third-party service boundaries."],
    ],
    delivery: [
      ["01", "Delivery channel", "After manual confirmation, digital services are delivered through the selected WhatsApp, email, Telegram, WeChat or QQ channel."],
      ["02", "Delivery timing", "Each product states an expected response and fulfilment window. Maintenance, low stock or risk review must appear as a clear degraded state on the receipt."],
      ["03", "Secure delivery", "Customers never send third-party passwords. Where authorisation is needed, use the provider’s official authorisation flow or a one-time secure link."],
      ["04", "Completion evidence", "The admin records the operator, time, channel and minimum necessary delivery result without storing full secrets, tokens or unnecessary personal data in logs."],
    ],
    refund: [
      ["01", "Refund eligibility", "Unstarted delivery, duplicate payment, incorrect amount, unavailable service or legal requirements may enter review. Partial fulfilment may qualify for a proportional refund."],
      ["02", "Non-refundable cases", "Once a digital service is fully delivered and used, change-of-mind refunds are generally unavailable unless the service is defective, misdescribed or law requires otherwise."],
      ["03", "Request and review", "Customers contact support with the receipt and reason. Evidence, approver, amount, channel and audit event are recorded; sensitive actions require reauthentication."],
      ["04", "Refunds and disputes", "Refunds return to the original method and timing depends on the provider. Chargebacks and disputes use a separate case workflow instead of editing settled orders."],
    ],
    cookies: [
      ["01", "Essential storage", "Language, currency and interface preferences are necessary local storage. Language and currency remain independent and can be changed at any time."],
      ["02", "Optional tracking", "This prototype has no analytics or advertising trackers. A production integration must disclose vendors, purpose and duration and obtain choice where required."],
      ["03", "Preference controls", "The live site should allow acceptance, rejection of non-essential tracking and reopening preferences. Rejection must not block browsing or manual ordering."],
      ["04", "External links", "When WhatsApp, Telegram or another external service opens, its own cookie and privacy rules apply."],
    ],
  };
  const sections = (lang === "zh" ? zhSections : enSections)[type] || [];
  return (
    <main className="policy-page client-main">
      <button className="back-link" onClick={() => go("/home")}><ArrowLeft size={17} />{t.backHome}</button>
      <header>
        <p className="eyebrow">{t.policyEyebrow}</p>
        <h1>{titles[type] || "CloudBridge"}</h1>
        <p>{lang === "zh" ? "设计版本：2026 年 7 月 28 日 · 上线前需法律审核" : "Design version: July 28, 2026 · Legal review required before launch"}</p>
      </header>
      <div className="policy-grid" role="list">
        {sections.map(([number, title, text]) => (
          <NumberedItem
            key={number}
            as="section"
            headingAs="h2"
            number={number}
            title={title}
            description={text}
          />
        ))}
      </div>
    </main>
  );
}

function NotFound({ lang }) {
  const t = copy[lang];
  return (
    <main className="not-found client-main">
      <div className="error-code">4<span>0</span>4</div>
      <p className="eyebrow">{t.notFoundEyebrow}</p>
      <h1>{lang === "zh" ? "这条连接暂时不存在" : "This connection does not exist"}</h1>
      <p>{lang === "zh" ? "返回云桥首页，继续浏览可用的 AI 服务。" : "Return home to continue browsing available AI services."}</p>
      <button className="bridge-button" onClick={() => go("/home")}><span>{lang === "zh" ? "返回首页" : "Back home"}</span><i><ArrowRight size={17} /></i></button>
    </main>
  );
}

function ClientApp({
  route,
  lang,
  setLang,
  currency,
  setCurrency,
  notify,
  categories,
  catalogProducts,
  transitServiceConfig,
}) {
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [buyProduct, setBuyProduct] = useState(null);
  const [lastOrder, setLastOrder] = useState(() => resolveOrderSummary(
    readOrderSummary(window.sessionStorage),
    catalogProducts,
    currencies,
  ));
  const productId = route.startsWith("/product/") ? route.split("/").pop() : null;
  const product = catalogProducts.find((item) => item.id === productId);
  const onProduct = (item) => go(`/product/${typeof item === "string" ? item : item.id}`);
  const onBuy = (item) => setBuyProduct(item);
  const onSuccess = (order) => {
    saveOrderSummary(window.sessionStorage, order);
    setLastOrder(resolveOrderSummary(readOrderSummary(window.sessionStorage), catalogProducts, currencies));
    notify({ type: "success", message: lang === "zh" ? "订单提交成功" : "Order submitted" });
    go("/order/success");
  };
  let content;
  if (route === "/home" || route === "/") content = <ClientHome lang={lang} currency={currency} onProduct={onProduct} onBuy={onBuy} onSupport={() => setSupportOpen(true)} categories={categories} catalogProducts={catalogProducts} />;
  else if (productId) content = <ProductDetail product={product} lang={lang} currency={currency} onBuy={onBuy} onSupport={() => setSupportOpen(true)} />;
  else if (route === "/order/success") content = <OrderSuccess order={lastOrder} lang={lang} onSupport={() => setSupportOpen(true)} notify={notify} />;
  else if (route === "/payment/demo") content = <PaymentDemoPage lang={lang} onBack={() => go("/home")} />;
  else if (route === "/states") content = <StorefrontStatesPage lang={lang} onBack={() => go("/home")} />;
  else if (route.startsWith("/policy/")) content = <PolicyPage type={route.split("/").pop()} lang={lang} />;
  else content = <NotFound lang={lang} />;
  return (
    <div className="client-app">
      <ClientHeader lang={lang} setLang={setLang} currency={currency} onCurrency={() => setCurrencyOpen(true)} onSupport={() => setSupportOpen(true)} notify={notify} />
      <div className="client-route-frame" key={route} tabIndex="-1">
        {content}
      </div>
      <TransitServiceLink
        config={transitServiceConfig}
        lang={lang}
        productDetail={Boolean(productId)}
        onUnavailable={() => notify({
          type: "info",
          message: lang === "zh" ? "中转站服务地址暂未配置" : "Transit Service address is not configured yet",
        })}
      />
      <CurrencyDrawer open={currencyOpen} onClose={() => setCurrencyOpen(false)} lang={lang} currency={currency} setCurrency={setCurrency} notify={notify} />
      <SupportDrawer open={supportOpen} onClose={() => setSupportOpen(false)} lang={lang} notify={notify} />
      <BuyDialog product={buyProduct} open={Boolean(buyProduct)} onClose={() => setBuyProduct(null)} lang={lang} currency={currency} onSuccess={onSuccess} notify={notify} />
    </div>
  );
}

export function App() {
  const [route, setRoute] = useState(routeFromHash);
  const [lang, setLang] = useState(() => localStorage.getItem("cloudbridge-lang") || "zh");
  const [currency, setCurrency] = useState(() => currencies.find((item) => item.code === localStorage.getItem("cloudbridge-currency")) || currencies[0]);
  const [categories, setCategories] = useState(() => readProductCategories(window.localStorage, productCategories));
  const [productCategoryAssignments, setProductCategoryAssignments] = useState(
    () => readProductCategoryAssignments(window.localStorage, products),
  );
  const [transitServiceConfig, setTransitServiceConfig] = useState(
    () => readTransitServiceConfig(window.localStorage),
  );
  const catalogProducts = useMemo(
    () => products.map((product) => ({
      ...product,
      categoryId: productCategoryAssignments[product.id] || product.categoryId,
    })),
    [productCategoryAssignments],
  );
  const [status, setStatus] = useState(null);
  const [adminSession, setAdminSession] = useState(null);
  const [googleAuthenticatorEnabled, setGoogleAuthenticatorEnabled] = useState(true);
  const [routeAnnouncement, setRouteAnnouncement] = useState("");
  const previousRouteRef = useRef(route);
  const notify = useCallback((nextStatus) => {
    setStatus({ ...nextStatus, id: `${Date.now()}-${Math.random()}` });
  }, []);
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    if (!window.location.hash) window.location.hash = "/home";
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useLayoutEffect(() => {
    const previousRoute = previousRouteRef.current;
    const adminPage = route.startsWith("/admin") ? adminPageLabels[route.split("/")[2]] : null;
    const productId = route.startsWith("/product/") ? route.split("/").pop() : null;
    const product = products.find((item) => item.id === productId);
    const pageTitle = adminPage?.[lang]
      || product?.name[lang]
      || (route === "/order/success" ? copy[lang].successTitle : null)
      || (route === "/payment/demo" ? (lang === "zh" ? "托管支付状态" : "Hosted payment states") : null)
      || (route === "/states" ? (lang === "zh" ? "异常状态预览" : "Storefront state previews") : null)
      || (lang === "zh" ? "云桥 CloudBridge" : "CloudBridge");
    document.title = `${pageTitle} · CloudBridge`;
    setRouteAnnouncement(lang === "zh" ? `已进入${pageTitle}` : `${pageTitle} page opened`);
    if (!route.startsWith("/admin") && previousRoute !== route) {
      const shouldRestoreHome = (route === "/home" || route === "/") && previousRoute.startsWith("/product/");
      const targetScroll = shouldRestoreHome ? readHomeScroll(window.sessionStorage) : 0;
      requestAnimationFrame(() => {
        window.scrollTo({ top: targetScroll, left: 0, behavior: "auto" });
        document.querySelector(".client-route-frame")?.focus({ preventScroll: true });
      });
    }
    previousRouteRef.current = route;
  }, [route, lang]);
  useEffect(() => {
    localStorage.setItem("cloudbridge-lang", lang);
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);
  useEffect(() => localStorage.setItem("cloudbridge-currency", currency.code), [currency]);
  useEffect(() => {
    saveProductCategories(window.localStorage, categories);
  }, [categories]);
  useEffect(() => {
    saveProductCategoryAssignments(window.localStorage, productCategoryAssignments);
  }, [productCategoryAssignments]);
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== TRANSIT_SERVICE_STORAGE_KEY) return;
      setTransitServiceConfig(readTransitServiceConfig(window.localStorage));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const saveTransitService = useCallback((nextConfig) => {
    const saved = saveTransitServiceConfig(window.localStorage, nextConfig);
    if (saved) setTransitServiceConfig(readTransitServiceConfig(window.localStorage));
    return saved;
  }, []);
  const isAdmin = route.startsWith("/admin");
  const adminPageKey = route.split("/")[2] || "dashboard";
  const showAdminAuth = isAdmin && (adminAuthPages.has(adminPageKey) || !adminSession);
  return (
    <>
      {isAdmin
        ? (
          <Suspense fallback={<DelayedRouteFallback lang={lang} />}>
            {showAdminAuth ? (
              <AdminAuthFlow
                lang={lang}
                setLang={setLang}
                googleAuthenticatorEnabled={googleAuthenticatorEnabled}
                onAuthenticated={(session) => {
                  setAdminSession(session);
                  go(adminAuthPages.has(adminPageKey) ? "/admin/dashboard" : route);
                }}
              />
            ) : (
              <AdminApp
                route={route}
                lang={lang}
                setLang={setLang}
                categories={categories}
                setCategories={setCategories}
                catalogProducts={catalogProducts}
                setProductCategoryAssignments={setProductCategoryAssignments}
                transitServiceConfig={transitServiceConfig}
                onSaveTransitService={saveTransitService}
                notify={notify}
                googleAuthenticatorEnabled={googleAuthenticatorEnabled}
                onGoogleAuthenticatorToggle={setGoogleAuthenticatorEnabled}
                onSignOut={() => {
                  setAdminSession(null);
                  go("/admin/login");
                }}
              />
            )}
          </Suspense>
        )
        : <ClientApp route={route} lang={lang} setLang={setLang} currency={currency} setCurrency={setCurrency} notify={notify} categories={categories} catalogProducts={catalogProducts} transitServiceConfig={transitServiceConfig} />}
      <StatusCenter status={status} routeAnnouncement={routeAnnouncement} />
    </>
  );
}
