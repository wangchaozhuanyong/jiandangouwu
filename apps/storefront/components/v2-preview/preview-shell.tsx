"use client";

import type { Locale, StorefrontConfig, StorefrontCurrency } from "@cloudbridge/contracts";
import {
  ArrowRight,
  Headset,
  House,
  Moon,
  Network,
  Receipt,
  ShoppingCartSimple,
  Star,
  Sun,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getNextStorefrontTheme, normalizeStorefrontTheme, STOREFRONT_THEME_STORAGE_KEY, type StorefrontTheme } from "../../lib/theme";
import { getConfig } from "../../lib/api";
import { PREVIEW_CURRENCIES, PREVIEW_NOTICE, PREVIEW_PRODUCTS, type PreviewProduct } from "../../lib/v2-preview-data";
import { LanguagePicker, SupportDrawer } from "../storefront-controls";
import { PreviewCart } from "./preview-cart";

type PreviewShellContextValue = {
  addToCart: (product: PreviewProduct) => void;
  cartItemIds: PreviewProduct["id"][];
  cartItems: PreviewProduct[];
  config: StorefrontConfig | null;
  currency: string;
  currencies: StorefrontCurrency[];
  locale: Locale;
  openCart: () => void;
  openSupport: () => void;
  openTransit: () => void;
  removeFromCart: (productId: PreviewProduct["id"]) => void;
  setCurrency: (currency: string) => void;
};

const PreviewShellContext = createContext<PreviewShellContextValue | null>(null);

const shellCopy = {
  zh: {
    home: "首页",
    transit: "中转站订阅",
    ai: "AI 软件代充",
    skills: "Skill 推荐",
    orderLookup: "订单查询",
    browse: "分类导航",
    allCategories: "全部商品",
    primaryNav: "V2 预览主要导航",
    openMenu: "打开菜单",
    closeMenu: "关闭菜单",
    customerSupport: "联系客服",
    cart: "购物车",
    language: "切换语言",
    light: "切换到浅色模式",
    dark: "切换到深色模式",
    brandHome: "云桥 V2 预览首页",
    footerIntro: "把数字订阅、AI 软件和可靠工具整理成一条清晰的人工服务路径。",
    services: "服务目录",
    terms: "服务条款",
    privacy: "隐私说明",
    contact: "联系我们",
    legal: "阶段一界面预览 · 订单查询仅为 DEMO，不读取服务器数据",
    transitOpen: "打开中转站服务",
    transitUnavailable: "中转站地址尚未配置，本次没有打开任何外部页面。",
  },
  en: {
    home: "Home",
    transit: "Transit subscriptions",
    ai: "AI recharge",
    skills: "Skill picks",
    orderLookup: "Order lookup",
    browse: "Category navigation",
    allCategories: "All products",
    primaryNav: "V2 preview primary navigation",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    customerSupport: "Contact support",
    cart: "Cart",
    language: "Switch language",
    light: "Switch to light theme",
    dark: "Switch to dark theme",
    brandHome: "CloudBridge V2 preview home",
    footerIntro: "A clearer human-assisted path through digital subscriptions, AI software, and trusted tools.",
    services: "Services",
    terms: "Terms",
    privacy: "Privacy",
    contact: "Contact us",
    legal: "Stage-one interface preview · Order lookup is DEMO-only and reads no server data",
    transitOpen: "Open transit service",
    transitUnavailable: "The transit URL is not configured. No external page was opened.",
  },
} as const;

function isSafeHttpsUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function useV2PreviewShell(): PreviewShellContextValue {
  const value = useContext(PreviewShellContext);
  if (!value) throw new Error("useV2PreviewShell must be used inside V2PreviewShell");
  return value;
}

export function V2PreviewShell({
  children,
  initialConfig,
  locale,
}: {
  children: React.ReactNode;
  initialConfig: StorefrontConfig | null;
  locale: Locale;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = shellCopy[locale];
  const base = `/preview/v2/${locale}`;
  const [config, setConfig] = useState<StorefrontConfig | null>(initialConfig);
  const [currency, setCurrency] = useState(initialConfig?.currencies[0]?.code ?? "CNY");
  const [theme, setTheme] = useState<StorefrontTheme>("dark");
  const [supportOpen, setSupportOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItemIds, setCartItemIds] = useState<PreviewProduct["id"][]>([]);
  const [transitNotice, setTransitNotice] = useState("");
  const isProductDetail = pathname.startsWith(`${base}/products/`);
  const showTransitFloat = pathname === base || pathname === `${base}/`;
  const isHome = pathname === base || pathname === `${base}/`;
  const isCartPage = pathname === `${base}/cart`;
  const transitExplicitlyDisabled = config?.settings.transitServiceEnabled === false;
  const transitUrl = config?.settings.transitServiceUrl;

  useEffect(() => {
    setConfig(initialConfig);
    if (initialConfig) return undefined;
    const controller = new AbortController();
    void getConfig(locale, controller.signal).then(setConfig).catch(() => {
      // The local preview keeps typed fixtures and truthful unavailable states when this one allowed read fails.
    });
    return () => controller.abort();
  }, [initialConfig, locale]);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    window.scrollTo(0, 0);
    setTheme(normalizeStorefrontTheme(document.documentElement.dataset.theme));
    setTransitNotice("");
  }, [locale, pathname]);

  const changeLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    const segments = pathname.split("/");
    segments[3] = nextLocale;
    const query = searchParams.toString();
    window.location.assign(`${segments.join("/")}${query ? `?${query}` : ""}`);
  };

  const toggleTheme = () => {
    const nextTheme = getNextStorefrontTheme(theme);
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    try {
      window.localStorage.setItem(STOREFRONT_THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Theme persistence is optional; the current preview still updates in memory.
    }
  };

  const openTransit = useCallback(() => {
    if (config?.settings.transitServiceEnabled === true && isSafeHttpsUrl(transitUrl)) {
      window.open(transitUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setTransitNotice(t.transitUnavailable);
  }, [config?.settings.transitServiceEnabled, t.transitUnavailable, transitUrl]);

  const currencies = useMemo(() => {
    if (config?.currencies.length) return config.currencies;
    return PREVIEW_CURRENCIES.map((item) => ({
      code: item.code,
      token: item.token,
      digits: item.digits,
      name: item.name[locale],
    }));
  }, [config?.currencies, locale]);

  useEffect(() => {
    if (!currencies.some((item) => item.code === currency)) {
      setCurrency(currencies[0]?.code ?? "CNY");
    }
  }, [currencies, currency]);

  const cartItems = useMemo(() => cartItemIds
    .map((id) => PREVIEW_PRODUCTS.find((product) => product.id === id))
    .filter((product): product is PreviewProduct => Boolean(product)), [cartItemIds]);

  const addToCart = useCallback((product: PreviewProduct) => {
    setCartItemIds((current) => current.includes(product.id) ? current : [...current, product.id]);
  }, []);
  const removeFromCart = useCallback((productId: PreviewProduct["id"]) => {
    setCartItemIds((current) => current.filter((id) => id !== productId));
  }, []);
  const openCart = useCallback(() => {
    if (window.matchMedia("(max-width: 760px)").matches) {
      window.location.assign(`${base}/cart`);
      return;
    }
    setCartOpen(true);
  }, [base]);

  const contextValue = useMemo<PreviewShellContextValue>(() => ({
    addToCart,
    cartItemIds,
    cartItems,
    config,
    currency,
    currencies,
    locale,
    openCart,
    openSupport: () => setSupportOpen(true),
    openTransit,
    removeFromCart,
    setCurrency,
  }), [addToCart, cartItemIds, cartItems, config, currency, currencies, locale, openCart, openTransit, removeFromCart]);

  const navItems = [
    { href: base, label: t.home, active: pathname === base || pathname === `${base}/`, icon: House },
    { href: `${base}/skills`, label: t.skills, active: pathname.startsWith(`${base}/skills`), icon: Star },
  ];

  const mobileNavItems = [
    { href: base, label: t.home, active: pathname === base || pathname === `${base}/`, icon: House },
    { href: `${base}/skills`, label: t.skills, active: pathname.startsWith(`${base}/skills`), icon: Star },
    { href: `${base}/cart`, label: t.cart, active: pathname.startsWith(`${base}/cart`), icon: ShoppingCartSimple },
    { href: `${base}/orders/lookup`, label: t.orderLookup, active: pathname.startsWith(`${base}/orders/lookup`), icon: Receipt },
  ];

  const footer = (
    <footer className="v2-preview-footer">
      <div className="v2-preview-footer__brand">
        <span><Image alt="" height={176} src="/assets/cloudbridge-logo.png" unoptimized width={349} /></span>
        <div><strong>{locale === "zh" ? "云桥" : "CloudBridge"}</strong><p>{t.footerIntro}</p></div>
      </div>
      <nav aria-label={locale === "zh" ? "页脚导航" : "Footer navigation"}>
        <Link href={`${base}#catalog`}>{t.services}<ArrowRight aria-hidden="true" size={17} /></Link>
        <Link href={`${base}/policies/terms`}>{t.terms}<ArrowRight aria-hidden="true" size={17} /></Link>
        <Link href={`${base}/policies/privacy`}>{t.privacy}<ArrowRight aria-hidden="true" size={17} /></Link>
        <button onClick={() => setSupportOpen(true)} type="button">{t.contact}<ArrowRight aria-hidden="true" size={17} /></button>
      </nav>
      <div className="v2-preview-footer__legal"><span>© 2026 CloudBridge</span><span>{t.legal}</span></div>
    </footer>
  );

  return (
    <PreviewShellContext.Provider value={contextValue}>
      <div className="v2-preview-shell">
        <div className="v2-preview-truth" role="status">
          <span aria-hidden="true" />
          <strong>{PREVIEW_NOTICE[locale]}</strong>
          <code>DEV · V2</code>
        </div>

        {!isProductDetail && (
          <header className="v2-preview-header">
            <Link aria-label={t.brandHome} className="v2-preview-brand" href={base}>
              <span>
                <Image alt="" height={176} priority src="/assets/cloudbridge-logo.png" unoptimized width={349} />
              </span>
              <strong>{locale === "zh" ? "云桥" : "CloudBridge"}</strong>
            </Link>
            <nav aria-label={t.primaryNav} className="v2-preview-header__nav">
              {navItems.map((item) => (
                <Link aria-current={item.active ? "page" : undefined} href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="v2-preview-header__actions">
              <Link className="v2-preview-order-lookup-button" href={`${base}/orders/lookup`}>
                <Receipt aria-hidden="true" size={18} /><span>{t.orderLookup}</span>
              </Link>
              <button
                aria-label={theme === "dark" ? t.light : t.dark}
                aria-pressed={theme === "light"}
                className="v2-preview-icon-button"
                onClick={toggleTheme}
                type="button"
              >
                {theme === "dark" ? <Sun aria-hidden="true" size={19} /> : <Moon aria-hidden="true" size={19} />}
              </button>
              <LanguagePicker ariaLabel={t.language} onChange={changeLocale} value={locale} />
              <button className="v2-preview-support-button" onClick={() => setSupportOpen(true)} type="button">
                <Headset aria-hidden="true" size={18} />
                <span>{t.customerSupport}</span>
              </button>
              <button aria-label={`${t.cart} · ${cartItems.length}`} className="v2-preview-cart-button" onClick={() => setCartOpen(true)} type="button">
                <ShoppingCartSimple aria-hidden="true" size={19} />
                <span>{t.cart}</span>
                {cartItems.length > 0 && <i aria-hidden="true">{cartItems.length}</i>}
              </button>
            </div>
          </header>
        )}

        {!isProductDetail && (
          <nav aria-label={t.primaryNav} className="v2-preview-mobile-bottom-nav">
            {mobileNavItems.map((item) => (
              <Link aria-current={item.active ? "page" : undefined} href={item.href} key={item.href}>
                <span><item.icon aria-hidden="true" size={21} />{item.href.endsWith("/cart") && cartItems.length > 0 && <i>{cartItems.length}</i>}</span><strong>{item.label}</strong>
              </Link>
            ))}
          </nav>
        )}

        {children}
        {!isProductDetail && !isCartPage && !isHome && footer}

        {showTransitFloat && !transitExplicitlyDisabled && (
          <button aria-label={t.transitOpen} className="v2-preview-transit-float" onClick={openTransit} title={t.transit} type="button">
            <Network aria-hidden="true" size={18} weight="regular" />
            <span>{locale === "zh" ? "中转站" : "Transit"}</span>
            <i aria-hidden="true" />
          </button>
        )}
        {transitNotice && <div className="v2-preview-transit-notice" role="status">{transitNotice}</div>}

        <SupportDrawer
          initialConfig={config}
          locale={locale}
          onClose={() => setSupportOpen(false)}
          open={supportOpen}
        />
        <PreviewCart currency={currency} items={cartItems} locale={locale} onClose={() => setCartOpen(false)} onRemove={removeFromCart} open={cartOpen} />
      </div>
    </PreviewShellContext.Provider>
  );
}
