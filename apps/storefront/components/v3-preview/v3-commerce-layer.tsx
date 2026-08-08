"use client";

import type { Locale } from "@cloudbridge/contracts";
import { ArrowRight, Check, Minus, Plus, ShoppingBagOpen, Trash, X } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "cloudbridge:v3-preview-cart";

export const V3_COMMERCE_PRODUCTS = [
  { slug: "chatgpt-plus-assisted", name: "ChatGPT Plus", kind: "AI Service", image: "/assets/product-chatgpt.webp", price: { zh: 158, en: 22 } },
  { slug: "claude-pro-assisted", name: "Claude Pro", kind: "AI Service", image: "/assets/product-claude.webp", price: { zh: 168, en: 23 } },
  { slug: "gemini-advanced-assisted", name: "Gemini Advanced", kind: "AI Service", image: "/assets/product-gemini.webp", price: { zh: 148, en: 21 } },
  { slug: "cursor-pro-assisted", name: "Cursor Pro", kind: "Developer", image: "/assets/product-cursor.webp", price: { zh: 138, en: 19 } },
  { slug: "codex-access", name: "Codex Access", kind: "Developer", image: "/assets/product-codex.webp", price: { zh: 128, en: 18 } },
  { slug: "midjourney-assisted", name: "Midjourney", kind: "Creative", image: "/assets/product-midjourney.webp", price: { zh: 158, en: 22 } },
] as const;

type Product = (typeof V3_COMMERCE_PRODUCTS)[number];
type CartState = Record<string, number>;
type CommerceContextValue = {
  add: (slug: string) => void;
  clear: () => void;
  count: number;
  items: Array<{ product: Product; quantity: number }>;
  openCart: () => void;
  remove: (slug: string) => void;
  setQuantity: (slug: string, quantity: number) => void;
  total: number;
};

const CommerceContext = createContext<CommerceContextValue | null>(null);

function formatPrice(locale: Locale, value: number) {
  return locale === "zh" ? `¥${value}` : `$${value}`;
}

export function useV3Commerce() {
  const value = useContext(CommerceContext);
  if (!value) throw new Error("useV3Commerce must be used inside V3CommerceLayer");
  return value;
}

export function V3CommerceLayer({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  const pathname = usePathname();
  const base = `/preview/v3/${locale}`;
  const [cart, setCart] = useState<CartState>({});
  const [hydrated, setHydrated] = useState(false);
  const [peekOpen, setPeekOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setCart(JSON.parse(saved) as CartState);
    } catch {
      // Preview persistence is optional. The in-memory cart remains usable.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Keep local interaction working when storage is unavailable.
    }
  }, [cart, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!pulse) return;
    const timer = window.setTimeout(() => setPulse(false), 360);
    return () => window.clearTimeout(timer);
  }, [pulse]);

  useEffect(() => {
    if (pathname === `${base}/cart`) setPeekOpen(false);
  }, [base, pathname]);

  const add = useCallback((slug: string) => {
    const product = V3_COMMERCE_PRODUCTS.find((item) => item.slug === slug);
    if (!product) return;
    setCart((current) => ({ ...current, [slug]: (current[slug] ?? 0) + 1 }));
    setToast(locale === "zh" ? `${product.name} 已加入购物车` : `${product.name} added to cart`);
    setPulse(true);
  }, [locale]);

  const remove = useCallback((slug: string) => {
    setCart((current) => {
      const next = { ...current };
      delete next[slug];
      return next;
    });
  }, []);

  const setQuantity = useCallback((slug: string, quantity: number) => {
    if (quantity <= 0) {
      remove(slug);
      return;
    }
    setCart((current) => ({ ...current, [slug]: Math.min(quantity, 9) }));
  }, [remove]);

  const clear = useCallback(() => setCart({}), []);

  const items = useMemo(() => V3_COMMERCE_PRODUCTS
    .map((product) => ({ product, quantity: cart[product.slug] ?? 0 }))
    .filter((item) => item.quantity > 0), [cart]);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.product.price[locale] * item.quantity, 0);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const homeAdd = target.closest<HTMLButtonElement>(".product-bottom button[aria-label^='Add ']");
      if (homeAdd) {
        const name = homeAdd.getAttribute("aria-label")?.replace(/^Add\s+/, "").trim();
        const product = V3_COMMERCE_PRODUCTS.find((item) => item.name === name);
        if (product) add(product.slug);
        return;
      }

      const detailAdd = target.closest<HTMLButtonElement>(".v3p-primary");
      if (detailAdd && pathname.includes("/products/")) {
        const slug = pathname.split("/products/")[1]?.split("/")[0];
        if (slug) add(slug);
        return;
      }

      const homeCart = target.closest<HTMLButtonElement>("button.cart");
      if (homeCart && window.matchMedia("(min-width: 761px)").matches) {
        event.preventDefault();
        setPeekOpen(true);
        return;
      }

      const cartLink = target.closest<HTMLAnchorElement>(`a[href='${base}/cart']`);
      if (cartLink && pathname !== `${base}/cart` && window.matchMedia("(min-width: 761px)").matches) {
        event.preventDefault();
        setPeekOpen(true);
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [add, base, pathname]);

  const detailSlug = pathname.includes("/products/") ? pathname.split("/products/")[1]?.split("/")[0] : null;
  const detailProduct = detailSlug ? V3_COMMERCE_PRODUCTS.find((item) => item.slug === detailSlug) : null;

  const contextValue = useMemo<CommerceContextValue>(() => ({
    add,
    clear,
    count,
    items,
    openCart: () => setPeekOpen(true),
    remove,
    setQuantity,
    total,
  }), [add, clear, count, items, remove, setQuantity, total]);

  return (
    <CommerceContext.Provider value={contextValue}>
      {children}

      <button className={`v3-commerce-fab${pulse ? " pulse" : ""}`} onClick={() => setPeekOpen(true)} type="button" aria-label={locale === "zh" ? "打开购物车预览" : "Open cart preview"}>
        <ShoppingBagOpen size={18} />
        <span>{count}</span>
      </button>

      {peekOpen && (
        <div className="v3-cart-peek-layer" onMouseDown={(event) => event.target === event.currentTarget && setPeekOpen(false)}>
          <aside className="v3-cart-peek" aria-label={locale === "zh" ? "购物车预览" : "Cart preview"}>
            <header>
              <div><small>LOCAL CART / V3</small><h2>{locale === "zh" ? "购物车" : "Cart"}</h2></div>
              <button onClick={() => setPeekOpen(false)} type="button" aria-label="Close"><X size={18} /></button>
            </header>

            <div className="v3-cart-peek-list">
              {items.length ? items.map(({ product, quantity }) => (
                <article key={product.slug}>
                  <div className="v3-cart-thumb"><Image alt="" fill sizes="58px" src={product.image} unoptimized /></div>
                  <div className="v3-cart-copy"><small>{product.kind}</small><strong>{product.name}</strong><span>{formatPrice(locale, product.price[locale])} × {quantity}</span></div>
                  <button className="v3-cart-remove" onClick={() => remove(product.slug)} type="button" aria-label={`Remove ${product.name}`}><Trash size={15} /></button>
                </article>
              )) : (
                <div className="v3-cart-peek-empty"><ShoppingBagOpen size={30} /><strong>{locale === "zh" ? "还没有添加服务" : "No services yet"}</strong><p>{locale === "zh" ? "从首页或商品详情加入一个项目。" : "Add a service from home or product detail."}</p></div>
              )}
            </div>

            <footer>
              <div><span>{locale === "zh" ? "小计" : "Subtotal"}</span><strong>{formatPrice(locale, total)}</strong></div>
              <Link href={`${base}/cart`} onClick={() => setPeekOpen(false)}>{locale === "zh" ? "查看购物车" : "View cart"}<ArrowRight size={17} /></Link>
              <p>{locale === "zh" ? "V3 本地预览状态 · 不创建真实订单" : "V3 local preview state · No real order is created"}</p>
            </footer>
          </aside>
        </div>
      )}

      {toast && <div className="v3-commerce-toast" role="status"><Check size={16} weight="bold" /><span>{toast}</span><button onClick={() => setPeekOpen(true)} type="button">{locale === "zh" ? "查看" : "View"}</button></div>}

      {detailProduct && (
        <div className="v3-mobile-buybar">
          <div><small>{detailProduct.kind}</small><strong>{formatPrice(locale, detailProduct.price[locale])}</strong></div>
          <button onClick={() => add(detailProduct.slug)} type="button"><ShoppingBagOpen size={17} />{locale === "zh" ? "加入购物车" : "Add to cart"}</button>
        </div>
      )}

      <style jsx global>{`
        :where(.v3,.v3p) button,:where(.v3,.v3p) a{transition:transform .14s ease,border-color .16s ease,background-color .16s ease,opacity .16s ease,color .16s ease}
        :where(.v3,.v3p) :is(button,a,input):focus-visible{outline:2px solid rgba(137,119,255,.9)!important;outline-offset:3px!important}
        :where(.v3,.v3p) button:active{transform:scale(.975)}
        .v3p-header,.header{border-bottom-color:rgba(255,255,255,.075)!important;background:linear-gradient(to bottom,rgba(6,6,9,.88),rgba(6,6,9,.68))!important;backdrop-filter:blur(22px) saturate(1.15)!important}
        .v3p-header{position:sticky!important;top:0;z-index:60!important}
        .product,.v3p-product,.stack-card,.v3p-plan-cards article{isolation:isolate;position:relative;overflow:hidden}
        .product:before,.v3p-product:before,.stack-card:before,.v3p-plan-cards article:before{content:"";position:absolute;inset:-1px;z-index:-1;pointer-events:none;background:radial-gradient(420px circle at 50% -10%,rgba(125,105,255,.12),transparent 52%);opacity:0;transition:opacity .2s ease}
        .product:hover:before,.v3p-product:hover:before,.stack-card:hover:before,.v3p-plan-cards article:hover:before{opacity:1}
        .product:hover,.v3p-product:hover{border-color:rgba(255,255,255,.17)!important;transform:translateY(-3px)}
        .product-image img,.v3p-product img,.v3p-art img{transition:transform .45s cubic-bezier(.2,.7,.2,1),filter .3s ease}
        .product:hover .product-image img,.v3p-product:hover img{transform:scale(1.025)}
        .v3p-primary,.primary{box-shadow:0 1px 0 rgba(255,255,255,.25) inset,0 12px 34px rgba(0,0,0,.16)}
        .v3-commerce-fab{position:fixed;right:20px;bottom:68px;z-index:90;width:40px;height:40px;border:1px solid rgba(255,255,255,.11);border-radius:12px;background:rgba(10,11,16,.9);backdrop-filter:blur(18px);color:#e9ebf1;display:grid;place-items:center;box-shadow:0 18px 50px rgba(0,0,0,.28)}.v3-commerce-fab span{position:absolute;right:-5px;top:-5px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#f3f4f7;color:#090a0d;border:2px solid #090a0d;display:grid;place-items:center;font-size:9px;font-weight:800}.v3-commerce-fab.pulse{animation:v3-cart-pulse .34s ease-out}
        .v3-cart-peek-layer{position:fixed;inset:0;z-index:180;background:rgba(0,0,0,.32);backdrop-filter:blur(3px);display:flex;justify-content:flex-end}.v3-cart-peek{width:min(410px,calc(100vw - 24px));height:100%;background:rgba(8,9,13,.985);border-left:1px solid rgba(255,255,255,.1);box-shadow:-30px 0 90px rgba(0,0,0,.42);color:#f6f7fa;display:grid;grid-template-rows:auto 1fr auto;animation:v3-peek-in .24s cubic-bezier(.2,.72,.2,1)}.v3-cart-peek>header{display:flex;align-items:flex-start;justify-content:space-between;padding:24px;border-bottom:1px solid rgba(255,255,255,.08)}.v3-cart-peek header small{font-size:9px;letter-spacing:.16em;color:#686f7c}.v3-cart-peek h2{font-size:27px;letter-spacing:-.04em;margin:5px 0 0}.v3-cart-peek header button,.v3-cart-remove{border:1px solid rgba(255,255,255,.08);background:#0e1016;color:#9aa0ad;border-radius:10px;display:grid;place-items:center}.v3-cart-peek header button{width:36px;height:36px}.v3-cart-peek-list{overflow:auto;padding:8px 20px}.v3-cart-peek-list article{display:grid;grid-template-columns:58px 1fr 34px;gap:13px;align-items:center;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.075)}.v3-cart-thumb{height:58px;position:relative;overflow:hidden;border-radius:12px;background:#101117}.v3-cart-thumb img{object-fit:cover}.v3-cart-copy{min-width:0;display:flex;flex-direction:column;gap:4px}.v3-cart-copy small{font-size:9px;color:#6f7582}.v3-cart-copy strong{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v3-cart-copy span{font-size:11px;color:#9298a5}.v3-cart-remove{width:32px;height:32px}.v3-cart-peek-empty{height:100%;min-height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#7d8491}.v3-cart-peek-empty strong{color:#d8dbe3;font-size:14px;margin-top:12px}.v3-cart-peek-empty p{font-size:11px;max-width:230px;line-height:1.6}.v3-cart-peek>footer{padding:20px 24px calc(22px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.08);background:#090a0e}.v3-cart-peek footer>div{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:15px}.v3-cart-peek footer span{font-size:10px;color:#777e8b}.v3-cart-peek footer strong{font-size:26px;letter-spacing:-.04em}.v3-cart-peek footer>a{height:46px;border-radius:12px;background:#f3f4f7;color:#090a0d;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;font-weight:750}.v3-cart-peek footer p{text-align:center;color:#606774;font-size:9px;margin:11px 0 0}
        .v3-commerce-toast{position:fixed;right:20px;bottom:116px;z-index:170;min-height:44px;max-width:min(390px,calc(100vw - 32px));padding:8px 9px 8px 12px;border:1px solid rgba(255,255,255,.11);border-radius:13px;background:rgba(13,15,21,.96);backdrop-filter:blur(18px);box-shadow:0 20px 65px rgba(0,0,0,.36);color:#dce0e8;display:flex;align-items:center;gap:9px;font-size:11px;animation:v3-toast-up .2s ease-out}.v3-commerce-toast>svg{color:#72e7bc}.v3-commerce-toast button{margin-left:auto;border:1px solid rgba(255,255,255,.09);border-radius:8px;background:#171921;color:#eceef3;padding:6px 9px;font-size:10px}
        .v3-mobile-buybar{display:none}
        @keyframes v3-peek-in{from{transform:translateX(24px);opacity:.35}to{transform:none;opacity:1}}@keyframes v3-toast-up{from{transform:translateY(7px);opacity:0}to{transform:none;opacity:1}}@keyframes v3-cart-pulse{45%{transform:scale(1.13)}to{transform:scale(1)}}
        @media(max-width:1024px){.v3p-pagehero h1,.v3p-infra h1{font-size:clamp(48px,7.5vw,72px)!important}.v3p-detail{gap:32px!important}.v3p-console{padding-left:30px!important}.hero{gap:38px!important}}
        @media(max-width:760px){.v3-commerce-fab{display:none}.v3-cart-peek-layer{display:none}.v3-commerce-toast{left:16px;right:16px;bottom:calc(86px + env(safe-area-inset-bottom));max-width:none}.v3-mobile-buybar{position:fixed;left:10px;right:10px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:105;height:62px;border:1px solid rgba(255,255,255,.1);border-radius:17px;background:rgba(10,11,16,.94);backdrop-filter:blur(22px);box-shadow:0 18px 60px rgba(0,0,0,.44);padding:8px 9px 8px 14px;display:flex;align-items:center;justify-content:space-between}.v3-mobile-buybar>div{display:flex;flex-direction:column;gap:2px}.v3-mobile-buybar small{font-size:8px;color:#707784;text-transform:uppercase}.v3-mobile-buybar strong{font-size:18px}.v3-mobile-buybar button{height:44px;border:0;border-radius:12px;background:#f3f4f7;color:#090a0d;padding:0 15px;display:flex;align-items:center;gap:7px;font-size:11px;font-weight:750}.v3p-console .v3p-primary,.v3p-console .v3p-secondary{min-height:48px}.product-bottom button{min-width:44px!important;min-height:44px!important}.v3p-product{transform:none!important}.v3p-pagehero{padding-top:70px!important}.v3p-pagehero h1,.v3p-infra h1{font-size:clamp(42px,13vw,58px)!important}.hero h1{font-size:clamp(44px,13vw,62px)!important}}
        @media(max-width:390px){.v3p-pagehero,.v3p-infra,.v3p-cart,.v3p-detail{padding-left:14px!important;padding-right:14px!important}.v3p-header,.header{padding-left:12px!important;padding-right:12px!important}.v3p-console h1{font-size:42px!important}.v3p-spec-row{overflow:auto;scrollbar-width:none}.v3p-spec-row span{white-space:nowrap}.hero{padding-left:16px!important;padding-right:16px!important}.hero-copy p{font-size:14px!important}.product-grid{gap:10px!important}}
        @media(max-width:330px){.v3p-pagehero h1,.v3p-infra h1,.hero h1{font-size:40px!important}.v3p-truth,.truth{font-size:9px!important}.v3-mobile-buybar button{padding:0 11px}.v3-mobile-buybar{left:7px;right:7px}.v3-commerce-toast{left:10px;right:10px}.v3p-plan-grid button{padding:11px!important}}
        @media(prefers-reduced-motion:reduce){.v3-commerce-fab,.v3-cart-peek,.v3-commerce-toast,.product-image img,.v3p-product img,.v3p-art img{animation:none!important;transition:none!important}}
      `}</style>
    </CommerceContext.Provider>
  );
}

export function V3CommerceCartPage({ locale }: { locale: Locale }) {
  const base = `/preview/v3/${locale}`;
  const { clear, items, remove, setQuantity, total } = useV3Commerce();
  return (
    <main className="v3-commerce-page">
      <div className="v3-commerce-page-grid" aria-hidden="true" />
      <header className="v3-commerce-page-header">
        <Link href={base}><span>CB</span><strong>CloudBridge</strong></Link>
        <nav><Link href={base}>{locale === "zh" ? "首页" : "Home"}</Link><Link href={`${base}/ai-recharge`}>{locale === "zh" ? "AI 代充" : "AI Recharge"}</Link><Link href={`${base}/transit-subscriptions`}>{locale === "zh" ? "中转站" : "Transit"}</Link><Link href={`${base}/skills`}>Skills</Link></nav>
        <small>LOCAL PREVIEW</small>
      </header>
      <section className="v3-commerce-cart-layout">
        <div className="v3-commerce-cart-main">
          <span>LOCAL CART / V3</span>
          <div className="v3-commerce-title-row"><h1>{locale === "zh" ? "购物车" : "Cart"}</h1>{items.length > 0 && <button onClick={clear} type="button">{locale === "zh" ? "清空" : "Clear"}</button>}</div>
          {items.length ? items.map(({ product, quantity }) => (
            <article key={product.slug}>
              <Link className="v3-commerce-cart-image" href={`${base}/products/${product.slug}`}><Image alt="" fill sizes="104px" src={product.image} unoptimized /></Link>
              <div><small>{product.kind}</small><Link href={`${base}/products/${product.slug}`}><h3>{product.name}</h3></Link><p>{locale === "zh" ? "数字服务 · 人工确认 · V3 预览状态" : "Digital service · Human confirmation · V3 preview state"}</p></div>
              <div className="v3-commerce-qty"><button onClick={() => setQuantity(product.slug, quantity - 1)} type="button"><Minus size={14} /></button><span>{quantity}</span><button onClick={() => setQuantity(product.slug, quantity + 1)} type="button"><Plus size={14} /></button></div>
              <strong>{formatPrice(locale, product.price[locale] * quantity)}</strong>
              <button className="v3-commerce-delete" onClick={() => remove(product.slug)} type="button"><Trash size={16} /></button>
            </article>
          )) : (
            <div className="v3-commerce-empty"><ShoppingBagOpen size={42} /><h2>{locale === "zh" ? "购物车还是空的" : "Your cart is empty"}</h2><p>{locale === "zh" ? "从首页或商品详情加入一个服务，状态只保存在当前浏览器。" : "Add a service from home or product detail. State stays in this browser only."}</p><Link href={base}>{locale === "zh" ? "浏览服务" : "Browse services"}<ArrowRight size={17} /></Link></div>
          )}
        </div>
        <aside className="v3-commerce-summary">
          <span>ORDER REVIEW</span><h2>{locale === "zh" ? "订单摘要" : "Summary"}</h2>
          <div><small>{locale === "zh" ? "项目" : "Items"}</small><strong>{items.reduce((sum, item) => sum + item.quantity, 0)}</strong></div>
          <div><small>{locale === "zh" ? "小计" : "Subtotal"}</small><strong>{formatPrice(locale, total)}</strong></div>
          <button disabled={!items.length} type="button">{locale === "zh" ? "校验人工订单" : "Validate manual order"}<ArrowRight size={17} /></button>
          <p>{locale === "zh" ? "这里只校验 V3 界面流程，不创建订单、不支付、不写入服务器。" : "This validates the V3 interface only. It creates no order, payment, or server data."}</p>
        </aside>
      </section>
      <style jsx global>{`
        .v3-commerce-page{min-height:100vh;background:#050507;color:#f5f6f8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;position:relative}.v3-commerce-page *{box-sizing:border-box}.v3-commerce-page a{color:inherit;text-decoration:none}.v3-commerce-page-grid{position:fixed;inset:0;pointer-events:none;opacity:.12;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:64px 64px;mask-image:linear-gradient(to bottom,black,transparent 76%)}.v3-commerce-page-header{height:72px;padding:0 34px;display:flex;align-items:center;gap:40px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(6,6,9,.76);backdrop-filter:blur(22px);position:sticky;top:0;z-index:50}.v3-commerce-page-header>a{display:flex;align-items:center;gap:10px}.v3-commerce-page-header>a span{width:32px;height:32px;border:1px solid rgba(255,255,255,.1);border-radius:10px;display:grid;place-items:center;font-size:10px}.v3-commerce-page-header>a strong{font-size:14px}.v3-commerce-page-header nav{display:flex;gap:24px;color:#9197a4;font-size:12px}.v3-commerce-page-header small{margin-left:auto;color:#656c79;font-size:9px;letter-spacing:.15em}.v3-commerce-cart-layout{max-width:1280px;margin:auto;padding:78px 34px 110px;display:grid;grid-template-columns:minmax(0,1fr) 350px;gap:54px}.v3-commerce-cart-main>span,.v3-commerce-summary>span{font-size:9px;letter-spacing:.18em;color:#686f7d}.v3-commerce-title-row{display:flex;align-items:end;justify-content:space-between}.v3-commerce-title-row h1{font-size:clamp(52px,7vw,88px);letter-spacing:-.065em;line-height:.92;margin:14px 0 34px}.v3-commerce-title-row>button{margin-bottom:38px;border:0;background:transparent;color:#747b88;font-size:10px}.v3-commerce-cart-main article{display:grid;grid-template-columns:104px minmax(0,1fr) auto auto 34px;align-items:center;gap:18px;padding:18px 0;border-top:1px solid rgba(255,255,255,.085)}.v3-commerce-cart-image{height:104px;position:relative;border-radius:15px;overflow:hidden;background:#0b0d12}.v3-commerce-cart-image img{object-fit:cover}.v3-commerce-cart-main article small{color:#6d7481;font-size:9px}.v3-commerce-cart-main article h3{font-size:17px;margin:6px 0}.v3-commerce-cart-main article p{color:#777e8b;font-size:10px;margin:0}.v3-commerce-qty{height:34px;border:1px solid rgba(255,255,255,.09);border-radius:10px;display:flex;align-items:center}.v3-commerce-qty button{width:32px;height:32px;border:0;background:transparent;color:#8c929e;display:grid;place-items:center}.v3-commerce-qty span{min-width:24px;text-align:center;font-size:11px}.v3-commerce-cart-main article>strong{min-width:66px;text-align:right;font-size:14px}.v3-commerce-delete{width:32px;height:32px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#0c0e13;color:#777e89;display:grid;place-items:center}.v3-commerce-summary{position:sticky;top:98px;align-self:start;border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:23px;background:linear-gradient(155deg,rgba(92,69,255,.08),#090a0f 42%)}.v3-commerce-summary h2{font-size:25px;margin:9px 0 26px}.v3-commerce-summary>div{display:flex;justify-content:space-between;padding:14px 0;border-top:1px solid rgba(255,255,255,.075)}.v3-commerce-summary small{color:#747b88;font-size:10px}.v3-commerce-summary>div strong{font-size:13px}.v3-commerce-summary>button{width:100%;height:46px;margin-top:15px;border:0;border-radius:12px;background:#f3f4f7;color:#090a0d;font-weight:750;font-size:11px;display:flex;align-items:center;justify-content:center;gap:7px}.v3-commerce-summary>button:disabled{opacity:.35}.v3-commerce-summary p{color:#666d79;font-size:9px;line-height:1.6;text-align:center}.v3-commerce-empty{border-top:1px solid rgba(255,255,255,.085);padding:86px 0}.v3-commerce-empty h2{font-size:28px;margin:18px 0 8px}.v3-commerce-empty p{color:#7b828f;font-size:12px;max-width:490px;line-height:1.65}.v3-commerce-empty>a{display:inline-flex;align-items:center;gap:7px;margin-top:16px;font-size:12px}
        @media(max-width:900px){.v3-commerce-page-header nav{display:none}.v3-commerce-cart-layout{grid-template-columns:1fr;gap:25px}.v3-commerce-summary{position:relative;top:auto}}
        @media(max-width:620px){.v3-commerce-page-header{height:62px;padding:0 14px}.v3-commerce-page-header>a strong{display:none}.v3-commerce-cart-layout{padding:58px 16px 110px}.v3-commerce-title-row h1{font-size:54px}.v3-commerce-cart-main article{grid-template-columns:82px minmax(0,1fr) auto;gap:13px}.v3-commerce-cart-image{height:82px}.v3-commerce-cart-main article p{display:none}.v3-commerce-qty{grid-column:2}.v3-commerce-cart-main article>strong{grid-column:3;grid-row:2}.v3-commerce-delete{grid-column:3;grid-row:1}.v3-commerce-summary{margin-bottom:12px}}
      `}</style>
    </main>
  );
}
