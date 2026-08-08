"use client";

import type { Locale } from "@cloudbridge/contracts";
import {
  ArrowRight,
  Command,
  House,
  MagnifyingGlass,
  Network,
  ShoppingBagOpen,
  Sparkle,
  Star,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const routes = [
  { key: "home", suffix: "", icon: House, zh: "首页", en: "Home", hint: "CloudBridge V3" },
  { key: "ai", suffix: "/ai-recharge", icon: Sparkle, zh: "AI 代充", en: "AI Recharge", hint: "ChatGPT · Claude · Gemini" },
  { key: "transit", suffix: "/transit-subscriptions", icon: Network, zh: "中转站", en: "Transit", hint: "API infrastructure" },
  { key: "skills", suffix: "/skills", icon: Star, zh: "Skills", en: "Skills", hint: "Developer marketplace" },
  { key: "cart", suffix: "/cart", icon: ShoppingBagOpen, zh: "购物车", en: "Cart", hint: "Local preview cart" },
] as const;

const products = [
  { slug: "chatgpt-plus-assisted", name: "ChatGPT Plus", hint: "AI Service" },
  { slug: "claude-pro-assisted", name: "Claude Pro", hint: "AI Service" },
  { slug: "gemini-advanced-assisted", name: "Gemini Advanced", hint: "AI Service" },
  { slug: "cursor-pro-assisted", name: "Cursor Pro", hint: "Developer" },
] as const;

const copy = {
  zh: {
    search: "搜索 V3",
    placeholder: "搜索页面、商品、Skill…",
    suggested: "推荐入口",
    results: "搜索结果",
    noResult: "没有匹配结果",
    offline: "当前离线 · 已加载页面仍可浏览",
    online: "网络已恢复",
    command: "全局 Command Search",
  },
  en: {
    search: "Search V3",
    placeholder: "Search pages, products, Skills…",
    suggested: "Suggested",
    results: "Results",
    noResult: "No matching results",
    offline: "You are offline · Loaded pages remain available",
    online: "Back online",
    command: "Global Command Search",
  },
} as const;

export function V3ExperienceShell({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/preview/v3/${locale}`;
  const t = copy[locale];
  const isHome = pathname === base || pathname === `${base}/`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [online, setOnline] = useState(true);
  const [connectionToast, setConnectionToast] = useState<"offline" | "online" | null>(null);

  const results = useMemo(() => {
    const value = query.trim().toLowerCase();
    const routeResults = routes.map((item) => ({
      id: `route-${item.key}`,
      name: item[locale],
      hint: item.hint,
      href: `${base}${item.suffix}`,
      Icon: item.icon,
    }));
    const productResults = products.map((item) => ({
      id: `product-${item.slug}`,
      name: item.name,
      hint: item.hint,
      href: `${base}/products/${item.slug}`,
      Icon: ArrowRight,
    }));
    const all = [...routeResults, ...productResults];
    if (!value) return all.slice(0, 6);
    return all.filter((item) => `${item.name} ${item.hint}`.toLowerCase().includes(value)).slice(0, 8);
  }, [base, locale, query]);

  useEffect(() => {
    setOnline(window.navigator.onLine);
    const handleOnline = () => {
      setOnline(true);
      setConnectionToast("online");
    };
    const handleOffline = () => {
      setOnline(false);
      setConnectionToast("offline");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!connectionToast) return;
    const timer = window.setTimeout(() => setConnectionToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [connectionToast]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (isHome) return;
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key === "ArrowDown" && results.length) {
        event.preventDefault();
        setActiveIndex((value) => (value + 1) % results.length);
      }
      if (event.key === "ArrowUp" && results.length) {
        event.preventDefault();
        setActiveIndex((value) => (value - 1 + results.length) % results.length);
      }
      if (event.key === "Enter" && results[activeIndex]) {
        event.preventDefault();
        router.push(results[activeIndex].href);
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIndex, isHome, open, results, router]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, [pathname]);

  const mobileItems = routes.filter((item) => ["home", "skills", "cart"].includes(item.key));
  const openMobileSearch = () => {
    if (isHome) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
      return;
    }
    setOpen(true);
  };

  return (
    <>
      {children}

      {!isHome && (
        <button className="v3-command-fab" onClick={() => setOpen(true)} type="button" aria-label={t.command}>
          <MagnifyingGlass size={16} />
          <span>{t.search}</span>
          <kbd><Command size={12} />K</kbd>
        </button>
      )}

      <nav className="v3-mobile-dock" aria-label={locale === "zh" ? "V3 移动端导航" : "V3 mobile navigation"}>
        {mobileItems.map((item) => {
          const href = `${base}${item.suffix}`;
          const active = item.key === "home" ? isHome : pathname.startsWith(href);
          const Icon = item.icon;
          return (
            <Link className={active ? "active" : ""} href={href} key={item.key}>
              <Icon size={20} weight={active ? "fill" : "regular"} />
              <span>{item[locale]}</span>
            </Link>
          );
        })}
        <button onClick={openMobileSearch} type="button">
          <MagnifyingGlass size={20} />
          <span>{locale === "zh" ? "搜索" : "Search"}</span>
        </button>
      </nav>

      {!online && !connectionToast && <div className="v3-offline-pill" role="status">{t.offline}</div>}
      {connectionToast && (
        <div className={`v3-connection-toast ${connectionToast}`} role="status">
          <i />
          {connectionToast === "offline" ? t.offline : t.online}
        </div>
      )}

      {open && (
        <div className="v3-global-overlay" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="v3-global-palette" role="dialog" aria-modal="true" aria-label={t.command}>
            <header>
              <MagnifyingGlass size={20} />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.placeholder} />
              <button onClick={() => setOpen(false)} type="button" aria-label="Close"><X size={18} /></button>
            </header>
            <div className="v3-global-label">{query ? t.results : t.suggested}</div>
            <div className="v3-global-results">
              {results.length ? results.map((item, index) => {
                const Icon = item.Icon;
                return (
                  <Link className={index === activeIndex ? "active" : ""} href={item.href} key={item.id} onMouseEnter={() => setActiveIndex(index)}>
                    <span className="glyph"><Icon size={18} /></span>
                    <span className="copy"><strong>{item.name}</strong><small>{item.hint}</small></span>
                    <kbd>{index + 1}</kbd>
                  </Link>
                );
              }) : <div className="v3-global-empty">{t.noResult}</div>}
            </div>
            <footer><span>↑ ↓ Navigate</span><span>↵ Open</span><span>ESC Close</span></footer>
          </section>
        </div>
      )}

      <style jsx global>{`
        .v3-command-fab{position:fixed;right:20px;bottom:20px;z-index:80;height:40px;border:1px solid rgba(255,255,255,.11);border-radius:12px;background:rgba(10,11,16,.88);backdrop-filter:blur(18px);color:#d8dbe4;padding:0 10px;display:flex;align-items:center;gap:8px;box-shadow:0 18px 50px rgba(0,0,0,.28);font-size:12px}.v3-command-fab kbd{display:flex;align-items:center;gap:2px;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:3px 5px;color:#858b98;font-size:10px}.v3-mobile-dock{display:none}.v3-offline-pill,.v3-connection-toast{position:fixed;left:50%;transform:translateX(-50%);z-index:120;border:1px solid rgba(255,255,255,.1);background:rgba(12,14,20,.94);backdrop-filter:blur(18px);color:#cdd1da;font-size:11px;border-radius:999px;padding:9px 13px;box-shadow:0 18px 50px rgba(0,0,0,.25)}.v3-offline-pill{top:42px}.v3-connection-toast{top:46px;display:flex;align-items:center;gap:8px;animation:v3-toast-in .24s ease-out both}.v3-connection-toast i{width:6px;height:6px;border-radius:50%;background:#ffbd66}.v3-connection-toast.online i{background:#6df1c3}.v3-global-overlay{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.64);backdrop-filter:blur(14px);display:flex;align-items:flex-start;justify-content:center;padding:11vh 18px 30px}.v3-global-palette{width:min(680px,100%);overflow:hidden;border:1px solid rgba(255,255,255,.12);border-radius:19px;background:rgba(10,11,16,.97);box-shadow:0 36px 110px rgba(0,0,0,.52);color:#f6f7fa;animation:v3-palette-in .18s ease-out both}.v3-global-palette header{height:62px;display:flex;align-items:center;gap:12px;padding:0 16px;border-bottom:1px solid rgba(255,255,255,.08)}.v3-global-palette input{flex:1;border:0;outline:0;background:transparent;color:white;font:inherit;font-size:15px}.v3-global-palette header button{width:34px;height:34px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#101219;color:#aeb3bf;display:grid;place-items:center}.v3-global-label{padding:13px 16px 7px;color:#666d7b;font-size:9px;letter-spacing:.15em;text-transform:uppercase}.v3-global-results{padding:4px 8px 10px}.v3-global-results a{height:58px;border-radius:12px;color:inherit;text-decoration:none;display:flex;align-items:center;gap:12px;padding:0 10px}.v3-global-results a:hover,.v3-global-results a:focus-visible,.v3-global-results a.active{background:rgba(255,255,255,.055);outline:0}.v3-global-results .glyph{width:36px;height:36px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#0f1117;display:grid;place-items:center;color:#b8bdc9}.v3-global-results .copy{display:flex;flex-direction:column;gap:4px;min-width:0}.v3-global-results strong{font-size:13px}.v3-global-results small{font-size:10px;color:#747b89}.v3-global-results kbd{margin-left:auto;color:#666d78;font-size:10px}.v3-global-empty{padding:30px 12px;color:#777e8c;font-size:12px}.v3-global-palette footer{height:38px;border-top:1px solid rgba(255,255,255,.07);display:flex;align-items:center;gap:18px;padding:0 16px;color:#626976;font-size:9px}.v3-route-frame{animation:v3-route-in .22s ease-out both}@keyframes v3-palette-in{from{opacity:0;transform:translateY(-7px) scale(.985)}to{opacity:1;transform:none}}@keyframes v3-toast-in{from{opacity:0;transform:translate(-50%,-7px)}to{opacity:1;transform:translate(-50%,0)}}@keyframes v3-route-in{from{opacity:.72;transform:translateY(5px)}to{opacity:1;transform:none}}
        @media(max-width:900px){.v3p-header nav{display:none!important}.v3p-detail,.v3p-infra,.v3p-cart{grid-template-columns:1fr!important}.v3p-console,.v3p-summary{position:relative!important;top:auto!important;border-left:0!important;padding-left:0!important}.v3p-cards{grid-template-columns:repeat(2,1fr)!important}.v3p-orbit{position:relative!important;right:auto!important;top:auto!important;margin:42px auto 0!important}.v3p-plan-cards{grid-template-columns:1fr!important}.v3p-skill-list article{grid-template-columns:50px 1fr auto!important}.v3p-skill-list code{display:none!important}}
        @media(max-width:760px){body{padding-bottom:calc(74px + env(safe-area-inset-bottom))}.v3-command-fab{display:none}.v3-mobile-dock{position:fixed;left:10px;right:10px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:110;height:62px;display:grid;grid-template-columns:repeat(4,1fr);padding:5px;border:1px solid rgba(255,255,255,.1);border-radius:18px;background:rgba(9,10,14,.91);backdrop-filter:blur(22px);box-shadow:0 18px 60px rgba(0,0,0,.45)}.v3-mobile-dock a,.v3-mobile-dock button{border:0;background:transparent;color:#737a88;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-decoration:none;font-size:9px;border-radius:12px;min-width:0}.v3-mobile-dock a.active{color:#f5f6f8;background:rgba(255,255,255,.055)}.v3-global-overlay{padding-top:7vh}.v3-global-palette{border-radius:17px}.v3-offline-pill,.v3-connection-toast{top:36px;max-width:calc(100vw - 30px);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v3p-header{position:sticky!important;top:0!important}.v3p-utils a{min-width:44px!important;min-height:44px!important;justify-content:center!important}.v3p-summary{padding-bottom:18px!important}}
        @media(prefers-reduced-motion:reduce){.v3-global-palette,.v3-connection-toast,.v3-route-frame{animation:none!important}}
      `}</style>
    </>
  );
}
