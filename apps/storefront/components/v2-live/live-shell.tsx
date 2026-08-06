"use client";

import type { Locale, StorefrontConfig } from "@cloudbridge/contracts";
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
import { useCallback, useEffect, useState } from "react";
import { getConfig } from "../../lib/api";
import {
  getNextStorefrontTheme,
  normalizeStorefrontTheme,
  STOREFRONT_THEME_STORAGE_KEY,
  type StorefrontTheme,
} from "../../lib/theme";
import { useExperience } from "../experience-provider";
import { LanguagePicker, SupportDrawer } from "../storefront-controls";

const labels = {
  zh: {
    home: "首页",
    skills: "Skill 推荐",
    lookup: "订单查询",
    cart: "购物车",
    support: "联系客服",
    language: "切换语言",
    light: "切换到浅色模式",
    dark: "切换到深色模式",
    primary: "网站主要导航",
    brand: "云桥首页",
    services: "服务目录",
    terms: "服务条款",
    privacy: "隐私说明",
    contact: "联系我们",
    transit: "中转站",
    transitOpen: "打开中转站服务",
    transitUnavailable: "中转站地址尚未配置，本次没有打开任何外部页面。",
    footer: "把数字订阅、AI 软件和可靠工具整理成一条清晰的人工服务路径。",
    legal: "人工确认服务 · 在线支付与自动交付尚未接入",
  },
  en: {
    home: "Home",
    skills: "Skill picks",
    lookup: "Order lookup",
    cart: "Cart",
    support: "Contact support",
    language: "Switch language",
    light: "Switch to light theme",
    dark: "Switch to dark theme",
    primary: "Primary navigation",
    brand: "CloudBridge home",
    services: "Services",
    terms: "Terms",
    privacy: "Privacy",
    contact: "Contact us",
    transit: "Transit",
    transitOpen: "Open transit service",
    transitUnavailable:
      "The transit URL is not configured. No external page was opened.",
    footer:
      "A clearer human-assisted path through digital subscriptions, AI software, and trusted tools.",
    legal:
      "Human confirmation · Online payment and automatic fulfillment are not connected",
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

export function V2LiveShell({
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
  const t = labels[locale];
  const base = `/${locale}`;
  const { cartItems, closeSupport, openSupport, supportOpen } = useExperience();
  const [config, setConfig] = useState(initialConfig);
  const [theme, setTheme] = useState<StorefrontTheme>("dark");
  const [transitNotice, setTransitNotice] = useState("");
  const isHome = pathname === base || pathname === `${base}/`;
  const isProductDetail = pathname.startsWith(`${base}/products/`);
  const isCartPage = pathname === `${base}/cart`;
  const isLookupPage = pathname.startsWith(`${base}/orders/lookup`);
  const isMobileServicePage = isCartPage || isLookupPage;

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    setTheme(normalizeStorefrontTheme(document.documentElement.dataset.theme));
    setTransitNotice("");
  }, [locale, pathname]);

  useEffect(() => {
    setConfig(initialConfig);
    if (initialConfig) return undefined;
    const controller = new AbortController();
    void getConfig(locale, controller.signal)
      .then(setConfig)
      .catch(() => setConfig(null));
    return () => controller.abort();
  }, [initialConfig, locale]);

  const changeLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    const segments = pathname.split("/");
    segments[1] = nextLocale;
    const query = searchParams.toString();
    window.location.assign(
      `${segments.join("/") || `/${nextLocale}`}${query ? `?${query}` : ""}`,
    );
  };

  const toggleTheme = () => {
    const next = getNextStorefrontTheme(theme);
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    try {
      window.localStorage.setItem(STOREFRONT_THEME_STORAGE_KEY, next);
    } catch {
      /* current page still updates */
    }
  };

  const openTransit = useCallback(() => {
    const url = config?.settings.transitServiceUrl;
    if (
      config?.settings.transitServiceEnabled === true &&
      isSafeHttpsUrl(url)
    ) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    setTransitNotice(t.transitUnavailable);
  }, [
    config?.settings.transitServiceEnabled,
    config?.settings.transitServiceUrl,
    t.transitUnavailable,
  ]);

  const navItems = [
    { href: base, label: t.home, active: isHome, icon: House },
    {
      href: `${base}/skills`,
      label: t.skills,
      active: pathname.startsWith(`${base}/skills`),
      icon: Star,
    },
  ];
  const mobileNavItems = [
    ...navItems,
    {
      href: `${base}/cart`,
      label: t.cart,
      active: isCartPage,
      icon: ShoppingCartSimple,
    },
    {
      href: `${base}/orders/lookup`,
      label: t.lookup,
      active: pathname.startsWith(`${base}/orders/lookup`),
      icon: Receipt,
    },
  ];
  const siteName =
    config?.settings.siteName[locale] ??
    (locale === "zh" ? "云桥" : "CloudBridge");

  return (
    <div
      className={`v2-preview-shell v2-live-shell${isMobileServicePage ? " is-mobile-service-page" : ""}`}
    >
      {!isProductDetail && !isCartPage && (
        <header className="v2-preview-header v2-shell-frame">
          <Link aria-label={t.brand} className="v2-preview-brand" href={base}>
            <span>
              <Image
                alt=""
                height={176}
                priority
                src="/assets/cloudbridge-logo.png"
                unoptimized
                width={349}
              />
            </span>
            <strong>{siteName}</strong>
          </Link>
          <nav aria-label={t.primary} className="v2-preview-header__nav">
            {navItems.map((item) => (
              <Link
                aria-current={item.active ? "page" : undefined}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="v2-preview-header__actions">
            <button
              aria-label={theme === "dark" ? t.light : t.dark}
              aria-pressed={theme === "light"}
              className="v2-preview-icon-button v2-action v2-action--icon"
              onClick={toggleTheme}
              type="button"
            >
              {theme === "dark" ? (
                <Sun aria-hidden="true" size={19} />
              ) : (
                <Moon aria-hidden="true" size={19} />
              )}
            </button>
            <LanguagePicker
              ariaLabel={t.language}
              onChange={changeLocale}
              value={locale}
            />
            <button
              className="v2-preview-support-button"
              onClick={openSupport}
              type="button"
            >
              <Headset aria-hidden="true" size={18} />
              <span>{t.support}</span>
            </button>
          </div>
        </header>
      )}

      {!isProductDetail && (
        <nav aria-label={t.primary} className="v2-preview-mobile-bottom-nav">
          {mobileNavItems.map((item) => (
            <Link
              aria-current={item.active ? "page" : undefined}
              href={item.href}
              key={item.href}
            >
              <span>
                <item.icon aria-hidden="true" size={21} />
                {item.href.endsWith("/cart") && cartItems.length > 0 && (
                  <i>{cartItems.length}</i>
                )}
              </span>
              <strong>{item.label}</strong>
            </Link>
          ))}
        </nav>
      )}

      <div className="v2-preview-stage v2-page-stage">{children}</div>

      {!isProductDetail && !isCartPage && !isHome && (
        <footer className="v2-preview-footer v2-shell-frame">
          <div className="v2-preview-footer__brand">
            <span>
              <Image
                alt=""
                height={176}
                src="/assets/cloudbridge-logo.png"
                unoptimized
                width={349}
              />
            </span>
            <div>
              <strong>{siteName}</strong>
              <p>{t.footer}</p>
            </div>
          </div>
          <nav aria-label={locale === "zh" ? "页脚导航" : "Footer navigation"}>
            <Link href={`${base}#catalog`}>
              {t.services}
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link href={`${base}/policies/terms`}>
              {t.terms}
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link href={`${base}/policies/privacy`}>
              {t.privacy}
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <button className="v2-action v2-action--tertiary" onClick={openSupport} type="button">
              {t.contact}
              <ArrowRight aria-hidden="true" size={17} />
            </button>
          </nav>
          <div className="v2-preview-footer__legal">
            <span>© 2026 CloudBridge</span>
            <span>{t.legal}</span>
          </div>
        </footer>
      )}

      {isHome && config?.settings.transitServiceEnabled !== false && (
        <button
          aria-label={t.transitOpen}
          className="v2-preview-transit-float"
          onClick={openTransit}
          title={t.transit}
          type="button"
        >
          <Network aria-hidden="true" size={18} />
          <span>{t.transit}</span>
          <i aria-hidden="true" />
        </button>
      )}
      {transitNotice && (
        <div className="v2-preview-transit-notice" role="status">
          {transitNotice}
        </div>
      )}
      <SupportDrawer
        initialConfig={config}
        locale={locale}
        onClose={closeSupport}
        open={supportOpen}
      />
    </div>
  );
}
