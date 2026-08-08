"use client";

import type { Locale } from "@cloudbridge/contracts";
import { Command, MagnifyingGlass, ShoppingBagOpen } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useV3Commerce } from "./v3-commerce-layer";

const copy = {
  zh: {
    preview: "V3 概念预览 · 模拟交互 · 不修改服务器数据",
    home: "首页",
    recharge: "AI 代充",
    transit: "中转站",
    skills: "Skills",
    search: "搜索",
    cart: "购物车",
    footer: "CloudBridge V3 · Intelligent Commerce Interface",
  },
  en: {
    preview: "V3 concept preview · Mock interactions · Server data will not change",
    home: "Home",
    recharge: "AI Recharge",
    transit: "Transit",
    skills: "Skills",
    search: "Search",
    cart: "Cart",
    footer: "CloudBridge V3 · Intelligent Commerce Interface",
  },
} as const;

export function V3FinalShell({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const pathname = usePathname();
  const { count, openCart } = useV3Commerce();
  const t = copy[locale];
  const base = `/preview/v3/${locale}`;
  const otherLocale = locale === "zh" ? "en" : "zh";
  const localeHref = pathname.replace(`/preview/v3/${locale}`, `/preview/v3/${otherLocale}`);

  const nav = [
    { href: base, label: t.home, active: pathname === base || pathname === `${base}/` },
    { href: `${base}/ai-recharge`, label: t.recharge, active: pathname.startsWith(`${base}/ai-recharge`) || pathname.includes("/products/") },
    { href: `${base}/transit-subscriptions`, label: t.transit, active: pathname.startsWith(`${base}/transit-subscriptions`) },
    { href: `${base}/skills`, label: t.skills, active: pathname.startsWith(`${base}/skills`) },
  ];

  const openSearch = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }));
  };

  return (
    <main className="v3-final">
      <div className="v3-final-grid" aria-hidden="true" />
      <div className="v3-final-glow" aria-hidden="true" />

      <div className="v3-final-truth">
        <span />
        {t.preview}
        <code>DEV · V3</code>
      </div>

      <header className="v3-final-header">
        <div className="v3-final-header-inner">
          <Link className="v3-final-brand" href={base} aria-label="CloudBridge V3">
            <span className="v3-final-brand-mark">
              <Image src="/assets/cloudbridge-logo.png" alt="" width={42} height={42} unoptimized />
            </span>
            <strong>CloudBridge</strong>
          </Link>

          <nav aria-label={locale === "zh" ? "V3 主导航" : "V3 primary navigation"}>
            {nav.map((item) => (
              <Link aria-current={item.active ? "page" : undefined} className={item.active ? "active" : ""} href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="v3-final-utils">
            <button className="v3-final-search" onClick={openSearch} type="button" aria-label={t.search}>
              <MagnifyingGlass size={17} />
              <span>{t.search}</span>
              <kbd><Command size={12} />K</kbd>
            </button>
            <button className="v3-final-cart" data-v3-cart-count={count} onClick={openCart} type="button" aria-label={`${t.cart} · ${count}`}>
              <ShoppingBagOpen size={18} />
              <span>{t.cart}</span>
            </button>
            <Link className="v3-final-lang" href={localeHref}>{locale === "zh" ? "EN" : "中"}</Link>
          </div>
        </div>
      </header>

      {children}

      <footer className="v3-final-footer">
        <span>{t.footer}</span>
        <span>© 2026 · PREVIEW ONLY</span>
      </footer>

      <style jsx global>{`
        .v3-final {
          --v3-bg: #050507;
          --v3-panel: #0b0d12;
          --v3-panel-2: #101219;
          --v3-line: rgba(255,255,255,.09);
          --v3-line-strong: rgba(255,255,255,.14);
          --v3-text: #f7f8fb;
          --v3-muted: #8f95a3;
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          background: var(--v3-bg);
          color: var(--v3-text);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .v3-final * { box-sizing: border-box; }
        .v3-final a { color: inherit; text-decoration: none; }
        .v3-final button, .v3-final input { font: inherit; }
        .v3-final-grid {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: .11;
          background-image:
            linear-gradient(rgba(255,255,255,.038) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.038) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: linear-gradient(to bottom, black, transparent 76%);
        }
        .v3-final-glow {
          position: fixed;
          width: 58vw;
          height: 58vw;
          right: -30vw;
          top: -30vw;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(100,73,255,.34), rgba(24,183,255,.08) 42%, transparent 68%);
          filter: blur(90px);
          opacity: .34;
          pointer-events: none;
        }
        .v3-final-truth {
          height: 31px;
          padding: 0 28px;
          border-bottom: 1px solid var(--v3-line);
          display: flex;
          align-items: center;
          gap: 9px;
          position: relative;
          z-index: 70;
          color: #9399a7;
          font-size: 10px;
          letter-spacing: .06em;
          background: rgba(5,5,7,.86);
        }
        .v3-final-truth > span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #6df1c3;
          box-shadow: 0 0 16px rgba(109,241,195,.42);
        }
        .v3-final-truth code {
          margin-left: auto;
          color: #656c7a;
          font-size: 9px;
        }
        .v3-final-header {
          height: 72px;
          position: sticky;
          top: 0;
          z-index: 65;
          border-bottom: 1px solid rgba(255,255,255,.07);
          background: linear-gradient(to bottom, rgba(6,6,9,.91), rgba(6,6,9,.70));
          backdrop-filter: blur(24px) saturate(1.12);
        }
        .v3-final-header-inner {
          width: min(1440px, 100%);
          height: 100%;
          margin: 0 auto;
          padding: 0 34px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 42px;
        }
        .v3-final-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .v3-final-brand-mark {
          width: 30px;
          height: 30px;
          overflow: hidden;
          border-radius: 9px;
          display: grid;
          place-items: center;
          background: #0d0f15;
          border: 1px solid rgba(255,255,255,.07);
        }
        .v3-final-brand-mark img { width: 44px; height: 44px; object-fit: contain; }
        .v3-final-brand strong { font-size: 15px; letter-spacing: -.025em; }
        .v3-final-header nav {
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .v3-final-header nav a {
          position: relative;
          min-height: 38px;
          padding: 0 12px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          color: #8e95a4;
          font-size: 12px;
        }
        .v3-final-header nav a:hover { color: #e8ebf2; background: rgba(255,255,255,.035); }
        .v3-final-header nav a.active {
          color: #f6f7fa;
          background: rgba(255,255,255,.055);
        }
        .v3-final-header nav a.active::after {
          content: "";
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: -17px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(148,134,255,.85), transparent);
        }
        .v3-final-utils {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .v3-final-search,
        .v3-final-cart,
        .v3-final-lang {
          height: 38px;
          border: 1px solid var(--v3-line);
          border-radius: 11px;
          background: rgba(255,255,255,.035);
          color: #dfe2e9;
        }
        .v3-final-search,
        .v3-final-cart {
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
        }
        .v3-final-search span,
        .v3-final-cart span { font-size: 11px; }
        .v3-final-search kbd {
          height: 22px;
          padding: 0 6px;
          display: inline-flex;
          align-items: center;
          gap: 2px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 6px;
          color: #737a88;
          font-size: 9px;
        }
        .v3-final-cart { position: relative; }
        .v3-final-cart::after {
          min-width: 17px;
          height: 17px;
          padding: 0 4px;
          position: absolute;
          right: -6px;
          top: -6px;
          border: 2px solid #08090c;
          border-radius: 999px;
          background: #f3f4f7;
          color: #090a0d;
          display: grid;
          place-items: center;
          font-size: 9px;
          font-weight: 800;
        }
        .v3-final-lang {
          min-width: 38px;
          display: grid;
          place-items: center;
          font-size: 11px;
        }
        .v3-final-search:hover,
        .v3-final-cart:hover,
        .v3-final-lang:hover { border-color: var(--v3-line-strong); background: rgba(255,255,255,.055); }
        .v3-final-footer {
          width: min(1360px, calc(100% - 64px));
          min-height: 82px;
          margin: 0 auto;
          border-top: 1px solid var(--v3-line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          color: #646b79;
          font-size: 10px;
          letter-spacing: .04em;
          position: relative;
          z-index: 2;
        }
        @media (max-width: 980px) {
          .v3-final-header-inner { padding: 0 22px; gap: 24px; }
          .v3-final-header nav { gap: 2px; }
          .v3-final-header nav a { padding: 0 9px; }
          .v3-final-search span, .v3-final-cart span { display: none; }
        }
        @media (max-width: 760px) {
          .v3-final-truth { padding: 0 16px; font-size: 9px; }
          .v3-final-truth code { display: none; }
          .v3-final-header { height: 62px; }
          .v3-final-header-inner {
            padding: 0 16px;
            display: flex;
            justify-content: space-between;
          }
          .v3-final-header nav,
          .v3-final-search,
          .v3-final-cart { display: none; }
          .v3-final-brand strong { font-size: 14px; }
          .v3-final-lang { height: 36px; min-width: 36px; }
          .v3-final-footer {
            width: calc(100% - 32px);
            padding: 26px 0 12px;
            align-items: flex-start;
            flex-direction: column;
          }
        }
        @media (max-width: 360px) {
          .v3-final-truth { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .v3-final-header-inner { padding: 0 13px; }
          .v3-final-brand-mark { width: 28px; height: 28px; }
        }
      `}</style>
    </main>
  );
}
