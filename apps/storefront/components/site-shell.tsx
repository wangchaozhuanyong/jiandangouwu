"use client";

import {
  ArrowRight,
  Headset,
  Network,
} from "@phosphor-icons/react";
import type { Locale } from "@cloudbridge/contracts";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getConfig, type StorefrontConfig } from "../lib/api";
import { copy } from "../lib/copy";
import { UX_TIMINGS } from "../lib/experience";
import { LanguagePicker, SupportDrawer } from "./storefront-controls";

export function SiteShell({
  locale,
  initialConfig,
  children,
}: {
  locale: Locale;
  initialConfig: StorefrontConfig | null;
  children: React.ReactNode;
}) {
  const t = copy[locale];
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, setNavigating] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [transitNotice, setTransitNotice] = useState("");
  const [config, setConfig] = useState<StorefrontConfig | null>(initialConfig);
  const hasConsumedInitialConfig = useRef(false);
  const closeSupport = useCallback(() => setSupportOpen(false), []);
  const isProductDetail = pathname.startsWith(`/${locale}/products/`);
  const settings = config?.settings;
  const transitEnabled = settings?.transitServiceEnabled === true;
  const transitUrl = settings?.transitServiceUrl ?? null;
  const siteName = settings?.siteName[locale] ?? t.brandPrimary;

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    setNavigating(false);
    setShowProgress(false);
  }, [locale, pathname, searchParams]);

  useEffect(() => {
    if (!hasConsumedInitialConfig.current && initialConfig) {
      hasConsumedInitialConfig.current = true;
      setConfig(initialConfig);
      return undefined;
    }
    hasConsumedInitialConfig.current = true;
    const controller = new AbortController();
    void getConfig(locale, controller.signal)
      .then((nextConfig) => setConfig(nextConfig))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setConfig(null);
      });
    return () => controller.abort();
  }, [initialConfig, locale, pathname]);

  useEffect(() => {
    if (!transitNotice) return undefined;
    const timer = window.setTimeout(() => setTransitNotice(""), 2800);
    return () => window.clearTimeout(timer);
  }, [transitNotice]);

  useEffect(() => {
    if (!transitEnabled) setTransitNotice("");
  }, [transitEnabled]);

  useEffect(() => {
    if (!navigating) return undefined;
    const timer = window.setTimeout(() => setShowProgress(true), UX_TIMINGS.feedbackDelayMs);
    return () => window.clearTimeout(timer);
  }, [navigating]);

  const changeLocale = (next: Locale) => {
    if (next === locale) return;
    const segments = pathname.split("/");
    segments[1] = next;
    const query = searchParams.toString();
    const target = `${segments.join("/") || `/${next}`}${query ? `?${query}` : ""}`;
    setNavigating(true);
    window.location.assign(target);
  };

  return (
    <div className="site-shell">
      <div className={`route-progress ${showProgress ? "is-visible" : ""}`} aria-hidden="true" />
      <header className="site-header">
        <Link className="brand" href={`/${locale}`} onClick={() => setNavigating(true)} aria-label={locale === "zh" ? "云桥首页" : "CloudBridge home"}>
          <span className="brand-mark">
            <Image
              src="/assets/cloudbridge-logo.png"
              width={349}
              height={176}
              priority
              unoptimized
              alt=""
            />
          </span>
          <span>
            <strong>{siteName}</strong>
            {t.brandSecondary && <small>{t.brandSecondary}</small>}
          </span>
        </Link>
        <nav aria-label={locale === "zh" ? "主要导航" : "Primary navigation"}>
          <Link href={`/${locale}#catalog`} onClick={() => pathname !== `/${locale}` && setNavigating(true)}>{t.navServices}</Link>
        </nav>
        <div className="header-utilities">
          <LanguagePicker
            ariaLabel={t.languageLabel}
            onChange={changeLocale}
            value={locale}
          />
          <button
            aria-label={t.customerSupport}
            className="support-trigger"
            onClick={() => setSupportOpen(true)}
            type="button"
          >
            <Headset aria-hidden="true" size={18} />
            <span>{t.customerSupport}</span>
          </button>
        </div>
      </header>
      {children}
      {transitEnabled && (
        transitUrl ? (
          <a
            className={`transit-service-entry${isProductDetail ? " is-detail" : ""}`}
            href={transitUrl}
            rel="noreferrer"
            target="_blank"
          >
            <span><Network size={19} aria-hidden="true" /><i /></span>
            <strong>{t.transitService}</strong>
            <ArrowRight size={17} aria-hidden="true" />
          </a>
        ) : (
          <button
            className={`transit-service-entry${isProductDetail ? " is-detail" : ""}`}
            onClick={() => setTransitNotice(t.transitUnavailable)}
            type="button"
          >
            <span><Network size={19} aria-hidden="true" /><i /></span>
            <strong>{t.transitService}</strong>
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        )
      )}
      <div
        className={`transit-service-notice${isProductDetail ? " is-detail" : ""}${transitNotice ? " is-visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {transitNotice}
      </div>
      {!isProductDetail && (
        <footer id="support" className="site-footer">
          <div className="footer-brand">
            <span className="footer-brand__mark" aria-hidden="true">
              <Image
                src="/assets/cloudbridge-logo.png"
                width={349}
                height={176}
                unoptimized
                alt=""
              />
            </span>
            <strong>{siteName}</strong>
          </div>
          <nav className="footer-links" aria-label={locale === "zh" ? "页脚导航" : "Footer navigation"}>
            <Link href={`/${locale}#catalog`} onClick={() => pathname !== `/${locale}` && setNavigating(true)}>
              <span>{t.navServices}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href={`/${locale}/policies/terms`} onClick={() => setNavigating(true)}>
              <span>{t.terms}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href={`/${locale}/policies/privacy`} onClick={() => setNavigating(true)}>
              <span>{t.privacy}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <button onClick={() => setSupportOpen(true)} type="button">
              <span>{t.navSupport}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </nav>
          <p className="footer-legal">{t.footerNote}</p>
        </footer>
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
