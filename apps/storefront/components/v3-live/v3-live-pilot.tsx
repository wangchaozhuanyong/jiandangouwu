"use client";

import type {
  CategorySummary,
  Locale,
  ProductDetail,
  ProductSummary,
  ProductSurface,
  StorefrontBanner,
  StorefrontConfig,
} from "@cloudbridge/contracts";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MagnifyingGlass,
  ShoppingBagOpen,
  Trash,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { toV3LiveProductCard, toV3LiveProductDetail } from "../../lib/v3-live-adapter";
import { useExperience } from "../experience-provider";
import { ResilientImage } from "../resilient-image";

const copy = {
  zh: {
    pilot: "V3 LIVE DATA PILOT · 读取真实 API · 不提交订单",
    home: "首页",
    recharge: "AI 代充",
    transit: "中转站",
    cart: "购物车",
    search: "筛选当前真实商品",
    all: "全部",
    add: "加入购物车",
    added: "已加入",
    view: "查看详情",
    empty: "当前 API 没有返回可展示商品",
    emptyBody: "这不是模拟数据。请检查当前 surface、分类或 API 状态。",
    categories: "真实分类",
    products: "真实商品",
    source: "数据来源",
    sourceBody: "Storefront API / ProductSummary",
    cartTitle: "Live Pilot 购物车",
    cartBody: "这里直接读取正式 ExperienceProvider。为了避免测试误创建真实订单，本 pilot 不提供提交订单动作。",
    clear: "清空",
    remove: "移除",
    subtotal: "当前小计",
    noCart: "还没有加入真实商品",
    noCartBody: "从 HOME / AI 代充 / Transit pilot 加入商品。",
    back: "返回目录",
    realData: "REAL DATA",
    noBanner: "当前 surface 没有启用 banner",
    detail: "真实商品详情",
    category: "分类",
    status: "状态",
    stock: "库存",
    platform: "平台",
    plan: "套餐类型",
    productionBoundary: "Production migration boundary",
    productionBoundaryBody: "本页验证真实读取、库存与 cart 接线；createOrder、支付和自动履约均未在 pilot 中调用。",
  },
  en: {
    pilot: "V3 LIVE DATA PILOT · Real API reads · No order submission",
    home: "Home",
    recharge: "AI Recharge",
    transit: "Transit",
    cart: "Cart",
    search: "Filter current live products",
    all: "All",
    add: "Add to cart",
    added: "Added",
    view: "View detail",
    empty: "The API returned no displayable products",
    emptyBody: "This is not mock data. Check the current surface, category, or API state.",
    categories: "Live categories",
    products: "Live products",
    source: "Data source",
    sourceBody: "Storefront API / ProductSummary",
    cartTitle: "Live Pilot cart",
    cartBody: "This reads the production ExperienceProvider directly. Order submission stays disabled so the pilot cannot accidentally create a real order.",
    clear: "Clear",
    remove: "Remove",
    subtotal: "Current subtotal",
    noCart: "No live products in cart yet",
    noCartBody: "Add products from the HOME / AI Recharge / Transit pilots.",
    back: "Back to catalog",
    realData: "REAL DATA",
    noBanner: "No active banner for this surface",
    detail: "Live product detail",
    category: "Category",
    status: "Status",
    stock: "Stock",
    platform: "Platform",
    plan: "Plan type",
    productionBoundary: "Production migration boundary",
    productionBoundaryBody: "This page validates live reads, inventory, and cart wiring. createOrder, payment, and automatic fulfillment are not invoked by the pilot.",
  },
} as const;

function decimalTotal(items: ProductSummary[], currency: string) {
  const values = items
    .filter((item) => item.price.currency === currency)
    .map((item) => item.price.amount);
  const scale = Math.max(0, ...values.map((value) => value.split(".")[1]?.length ?? 0));
  const factor = 10n ** BigInt(scale);
  const total = values.reduce((sum, value) => {
    const [whole = "0", fraction = ""] = value.split(".");
    return sum + BigInt(whole) * factor + BigInt(`${fraction}${"0".repeat(scale)}`.slice(0, scale) || "0");
  }, 0n);
  if (!scale) return total.toString();
  return `${total / factor}.${(total % factor).toString().padStart(scale, "0")}`;
}

export function V3LivePilotShell({
  children,
  config,
  locale,
}: {
  children: React.ReactNode;
  config: StorefrontConfig | null;
  locale: Locale;
}) {
  const pathname = usePathname();
  const { cartItems } = useExperience();
  const t = copy[locale];
  const base = `/preview/v3-live/${locale}`;
  const otherLocale = locale === "zh" ? "en" : "zh";
  const localeHref = pathname.replace(`/preview/v3-live/${locale}`, `/preview/v3-live/${otherLocale}`);
  const siteName = config?.settings.siteName[locale] ?? (locale === "zh" ? "云桥" : "CloudBridge");
  const nav = [
    { href: base, label: t.home, active: pathname === base || pathname === `${base}/` },
    { href: `${base}/ai-recharge`, label: t.recharge, active: pathname.startsWith(`${base}/ai-recharge`) },
    { href: `${base}/transit-subscriptions`, label: t.transit, active: pathname.startsWith(`${base}/transit-subscriptions`) },
  ];

  return (
    <main className="v3-live-pilot">
      <div className="v3-live-grid" aria-hidden="true" />
      <div className="v3-live-truth"><i />{t.pilot}<code>DEV · LIVE READS</code></div>
      <header className="v3-live-header">
        <Link className="v3-live-brand" href={base}><span>CB</span><strong>{siteName}</strong></Link>
        <nav>{nav.map((item) => <Link aria-current={item.active ? "page" : undefined} className={item.active ? "active" : ""} href={item.href} key={item.href}>{item.label}</Link>)}</nav>
        <div className="v3-live-utils">
          <Link className="v3-live-cart-link" href={`${base}/cart`}><ShoppingBagOpen size={18}/><span>{t.cart}</span>{cartItems.length > 0 && <i>{cartItems.length}</i>}</Link>
          <Link className="v3-live-lang" href={localeHref}>{locale === "zh" ? "EN" : "中"}</Link>
        </div>
      </header>
      {children}
      <footer className="v3-live-footer"><span>CloudBridge · V3 Live Migration Pilot</span><span>READ + LOCAL CART ONLY</span></footer>
      <style jsx global>{styles}</style>
    </main>
  );
}

export function V3LiveCatalogPilot({
  banners,
  categories,
  locale,
  products,
  surface,
}: {
  banners: StorefrontBanner[];
  categories: CategorySummary[];
  locale: Locale;
  products: ProductSummary[];
  surface: ProductSurface;
}) {
  const t = copy[locale];
  const base = `/preview/v3-live/${locale}`;
  const { addCartItem, cartItems } = useExperience();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("ALL");
  const cards = useMemo(() => products.map((product) => toV3LiveProductCard(product, locale)), [locale, products]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((card) => {
      const matchesCategory = category === "ALL" || card.source.categoryId === category;
      const matchesQuery = !q || `${card.name} ${card.kicker} ${card.platformLabel ?? ""}`.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [cards, category, query]);
  const hero = banners[0] ?? null;
  const surfaceLabel = surface === "HOME" ? "HOME" : surface === "AI_RECHARGE" ? "AI RECHARGE" : "TRANSIT SUBSCRIPTIONS";

  return (
    <>
      <section className="v3-live-hero">
        <div className="v3-live-hero-copy">
          <span>{surfaceLabel} / {t.realData}</span>
          <h1>{hero?.title || (locale === "zh" ? "真实数据驱动的 V3 界面。" : "V3, driven by live storefront data.")}</h1>
          <p>{hero?.body || (locale === "zh" ? "当前页面直接读取正式 Storefront API 合同，不使用 V3 静态商品。" : "This page reads the live Storefront API contract directly and uses no V3 static products.")}</p>
          <div className="v3-live-hero-meta"><div><small>{t.source}</small><strong>{t.sourceBody}</strong></div><div><small>{t.categories}</small><strong>{categories.length}</strong></div><div><small>{t.products}</small><strong>{products.length}</strong></div></div>
        </div>
        <div className="v3-live-hero-media">
          {hero?.imageUrl ? <ResilientImage alt="" fallbackLabel={locale === "zh" ? "Banner 图片不可用" : "Banner image unavailable"} fetchPriority="high" height={700} loading="eager" sizes="(max-width: 800px) 100vw, 46vw" src={hero.imageUrl} width={1000}/> : <div className="v3-live-no-banner">{t.noBanner}</div>}
        </div>
      </section>

      <section className="v3-live-toolbar">
        <div className="v3-live-search"><MagnifyingGlass size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search}/></div>
        <div className="v3-live-category-strip">
          <button className={category === "ALL" ? "active" : ""} onClick={() => setCategory("ALL")} type="button">{t.all}</button>
          {categories.map((item) => <button className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)} type="button" key={item.id}>{item.name}</button>)}
        </div>
      </section>

      <section className="v3-live-products">
        {visible.length ? visible.map((card) => {
          const inCart = cartItems.some((item) => item.id === card.id);
          return (
            <article className="v3-live-product" key={card.id}>
              <Link className="v3-live-product-image" href={`${base}/products/${card.slug}`}>
                <ResilientImage alt="" fallbackLabel={locale === "zh" ? "商品图片不可用" : "Product image unavailable"} height={640} sizes="(max-width: 720px) 100vw, 32vw" src={card.imageUrl} width={900}/>
                <span className={`availability ${card.availability}`}>{card.availabilityLabel}</span>
              </Link>
              <div className="v3-live-product-body">
                <div className="v3-live-product-meta"><span>{card.platformLabel ?? card.transitPlanLabel ?? card.kicker}</span>{card.stockLabel && <span>{card.stockLabel}</span>}</div>
                <Link href={`${base}/products/${card.slug}`}><h2>{card.name}</h2></Link>
                <div className="v3-live-price-row"><strong>{card.priceText}</strong>{card.compareAtPriceText && <del>{card.compareAtPriceText}</del>}</div>
                <div className="v3-live-product-actions">
                  <Link href={`${base}/products/${card.slug}`}>{t.view}<ArrowRight size={16}/></Link>
                  <button disabled={!card.canAddToCart || inCart} onClick={() => addCartItem(card.source)} type="button">{inCart ? <Check size={16}/> : <ShoppingBagOpen size={16}/>} {inCart ? t.added : t.add}</button>
                </div>
              </div>
            </article>
          );
        }) : <div className="v3-live-empty"><strong>{t.empty}</strong><p>{t.emptyBody}</p></div>}
      </section>
    </>
  );
}

export function V3LiveProductPilot({ locale, product }: { locale: Locale; product: ProductDetail }) {
  const t = copy[locale];
  const base = `/preview/v3-live/${locale}`;
  const { addCartItem, cartItems } = useExperience();
  const view = toV3LiveProductDetail(product, locale);
  const inCart = cartItems.some((item) => item.id === product.id);
  return (
    <section className="v3-live-detail">
      <div className="v3-live-detail-media">
        <Link className="v3-live-back" href={base}><ArrowLeft size={17}/>{t.back}</Link>
        <div className="v3-live-detail-image"><ResilientImage alt="" fallbackLabel={locale === "zh" ? "商品图片不可用" : "Product image unavailable"} fetchPriority="high" height={900} loading="eager" sizes="(max-width: 900px) 100vw, 55vw" src={view.imageUrl} width={1200}/></div>
      </div>
      <aside className="v3-live-detail-console">
        <span className={`availability ${view.availability}`}>{view.availabilityLabel}</span>
        <small>{t.detail}</small>
        <h1>{view.name}</h1>
        <p>{view.description}</p>
        <div className="v3-live-detail-price"><strong>{view.priceText}</strong>{view.compareAtPriceText && <del>{view.compareAtPriceText}</del>}</div>
        <dl>
          <div><dt>{t.category}</dt><dd>{view.category.name}</dd></div>
          <div><dt>{t.status}</dt><dd>{view.source.status}</dd></div>
          <div><dt>{t.stock}</dt><dd>{view.stockLabel ?? view.source.stockMode}</dd></div>
          {view.platformLabel && <div><dt>{t.platform}</dt><dd>{view.platformLabel}</dd></div>}
          {view.transitPlanLabel && <div><dt>{t.plan}</dt><dd>{view.transitPlanLabel}</dd></div>}
        </dl>
        <button className="v3-live-detail-add" disabled={!view.canAddToCart || inCart} onClick={() => addCartItem(product)} type="button">{inCart ? <Check size={18}/> : <ShoppingBagOpen size={18}/>} {inCart ? t.added : t.add}</button>
        <div className="v3-live-boundary"><small>{t.productionBoundary}</small><p>{t.productionBoundaryBody}</p></div>
      </aside>
    </section>
  );
}

export function V3LiveCartPilot({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const base = `/preview/v3-live/${locale}`;
  const { cartItems, clearCart, currency, removeCartItem } = useExperience();
  const total = decimalTotal(cartItems, currency);
  return (
    <section className="v3-live-cart-page">
      <div className="v3-live-cart-main">
        <span>EXPERIENCE PROVIDER / LIVE PILOT</span>
        <h1>{t.cartTitle}</h1>
        <p>{t.cartBody}</p>
        {cartItems.length ? <div className="v3-live-cart-list">{cartItems.map((item) => {
          const card = toV3LiveProductCard(item, locale);
          return <article key={item.id}><ResilientImage alt="" fallbackLabel="Image unavailable" height={160} sizes="72px" src={item.imageUrl} width={160}/><div><small>{item.kicker}</small><strong>{item.name}</strong><span>{card.priceText}</span></div><button onClick={() => removeCartItem(item.id)} type="button"><Trash size={16}/>{t.remove}</button></article>;
        })}</div> : <div className="v3-live-cart-empty"><ShoppingBagOpen size={36}/><strong>{t.noCart}</strong><p>{t.noCartBody}</p><Link href={base}>{t.back}<ArrowRight size={16}/></Link></div>}
      </div>
      <aside className="v3-live-cart-summary"><span>{t.subtotal}</span><strong>{total} {currency}</strong><button disabled type="button">{locale === "zh" ? "Pilot 中禁止提交真实订单" : "Real order submission disabled in pilot"}</button>{cartItems.length > 0 && <button className="secondary" onClick={clearCart} type="button">{t.clear}</button>}<p>{t.productionBoundaryBody}</p></aside>
    </section>
  );
}

const styles = `
.v3-live-pilot{--bg:#050507;--panel:#0b0d12;--line:rgba(255,255,255,.09);--text:#f7f8fb;--muted:#8f95a3;min-height:100vh;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;position:relative;overflow:hidden}.v3-live-pilot *{box-sizing:border-box}.v3-live-pilot a{color:inherit;text-decoration:none}.v3-live-pilot button,.v3-live-pilot input{font:inherit}.v3-live-grid{position:fixed;inset:0;pointer-events:none;opacity:.1;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:64px 64px;mask-image:linear-gradient(to bottom,black,transparent 78%)}.v3-live-truth{height:31px;display:flex;align-items:center;gap:9px;padding:0 28px;border-bottom:1px solid var(--line);background:rgba(5,5,7,.92);position:relative;z-index:60;color:#9299a7;font-size:10px;letter-spacing:.06em}.v3-live-truth i{width:6px;height:6px;border-radius:50%;background:#6df1c3;box-shadow:0 0 15px rgba(109,241,195,.45)}.v3-live-truth code{margin-left:auto;color:#676e7b;font-size:9px}.v3-live-header{height:72px;position:sticky;top:0;z-index:55;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:42px;padding:0 max(28px,calc((100vw - 1380px)/2));border-bottom:1px solid rgba(255,255,255,.07);background:rgba(6,6,9,.82);backdrop-filter:blur(24px)}.v3-live-brand{display:flex;align-items:center;gap:10px}.v3-live-brand>span{width:30px;height:30px;border:1px solid var(--line);border-radius:9px;display:grid;place-items:center;background:#0e1016;font-size:10px}.v3-live-brand strong{font-size:15px}.v3-live-header nav{display:flex;gap:7px}.v3-live-header nav a{min-height:38px;padding:0 12px;border-radius:10px;display:flex;align-items:center;color:#8f95a3;font-size:12px}.v3-live-header nav a.active{background:rgba(255,255,255,.055);color:#f7f8fb}.v3-live-utils{display:flex;gap:8px;align-items:center}.v3-live-cart-link,.v3-live-lang{height:38px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.035);display:flex;align-items:center;gap:8px;padding:0 11px;font-size:11px}.v3-live-cart-link{position:relative}.v3-live-cart-link i{position:absolute;right:-5px;top:-5px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:#f5f7fa;color:#07080a;font-style:normal;font-size:9px;font-weight:800;display:grid;place-items:center}.v3-live-hero{width:min(1380px,100%);margin:0 auto;padding:92px 34px 72px;display:grid;grid-template-columns:1.02fr .98fr;gap:58px;align-items:center;position:relative;z-index:2}.v3-live-hero-copy>span,.v3-live-cart-main>span{font-size:10px;letter-spacing:.16em;color:#7d8493}.v3-live-hero h1{font-size:clamp(50px,5.5vw,88px);line-height:.94;letter-spacing:-.06em;margin:18px 0 24px;max-width:760px}.v3-live-hero-copy>p{max-width:650px;color:#959caa;font-size:15px;line-height:1.75}.v3-live-hero-meta{margin-top:34px;display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.v3-live-hero-meta>div{padding:17px 15px;border-right:1px solid var(--line)}.v3-live-hero-meta>div:last-child{border-right:0}.v3-live-hero-meta small,.v3-live-hero-meta strong{display:block}.v3-live-hero-meta small{font-size:9px;color:#686f7e;margin-bottom:7px;text-transform:uppercase;letter-spacing:.1em}.v3-live-hero-meta strong{font-size:12px}.v3-live-hero-media{aspect-ratio:1.35;border:1px solid var(--line);border-radius:24px;overflow:hidden;background:#0a0c11;position:relative}.v3-live-hero-media img{width:100%;height:100%;object-fit:cover}.v3-live-no-banner{width:100%;height:100%;display:grid;place-items:center;color:#707786;font-size:12px}.v3-live-toolbar{width:min(1380px,100%);margin:0 auto;padding:0 34px 28px;position:relative;z-index:2}.v3-live-search{height:48px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.03);display:flex;align-items:center;gap:10px;padding:0 14px;max-width:520px}.v3-live-search input{flex:1;border:0;outline:0;background:transparent;color:#fff}.v3-live-category-strip{display:flex;gap:8px;overflow:auto;padding-top:15px;scrollbar-width:none}.v3-live-category-strip button{height:34px;padding:0 12px;border:1px solid var(--line);border-radius:10px;background:#0b0d12;color:#858c9a;white-space:nowrap}.v3-live-category-strip button.active{background:#f4f6fa;color:#08090c;border-color:#f4f6fa}.v3-live-products{width:min(1380px,100%);margin:0 auto;padding:0 34px 120px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;position:relative;z-index:2}.v3-live-product{border:1px solid var(--line);border-radius:20px;background:rgba(255,255,255,.025);overflow:hidden}.v3-live-product-image{display:block;aspect-ratio:1.28;position:relative;background:#0e1015;overflow:hidden}.v3-live-product-image img{width:100%;height:100%;object-fit:cover;transition:transform .35s ease}.v3-live-product:hover .v3-live-product-image img{transform:scale(1.025)}.availability{display:inline-flex;align-items:center;height:25px;padding:0 8px;border-radius:999px;border:1px solid rgba(255,255,255,.1);font-size:9px;background:rgba(7,8,11,.78);color:#b9bfca}.v3-live-product-image>.availability{position:absolute;left:10px;top:10px}.availability.available{color:#79e4b6}.availability.low-stock{color:#ffd27c}.availability.sold-out,.availability.unavailable{color:#ff9b9b}.v3-live-product-body{padding:16px}.v3-live-product-meta{display:flex;justify-content:space-between;gap:12px;color:#707887;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.v3-live-product h2{font-size:20px;letter-spacing:-.03em;margin:9px 0 18px}.v3-live-price-row{display:flex;align-items:baseline;gap:9px}.v3-live-price-row strong{font-size:18px}.v3-live-price-row del{color:#686f7d;font-size:11px}.v3-live-product-actions{margin-top:17px;display:grid;grid-template-columns:1fr auto;gap:8px}.v3-live-product-actions a,.v3-live-product-actions button{height:40px;border:1px solid var(--line);border-radius:11px;display:flex;align-items:center;justify-content:center;gap:7px;font-size:11px}.v3-live-product-actions a{background:rgba(255,255,255,.03)}.v3-live-product-actions button{padding:0 13px;background:#f3f5f8;color:#07080a}.v3-live-product-actions button:disabled{opacity:.42;cursor:not-allowed}.v3-live-empty{grid-column:1/-1;border:1px dashed var(--line);border-radius:20px;padding:58px;text-align:center;color:#8f96a5}.v3-live-empty strong{display:block;color:#eef0f4;margin-bottom:8px}.v3-live-empty p{margin:0}.v3-live-detail{width:min(1380px,100%);margin:0 auto;padding:60px 34px 110px;display:grid;grid-template-columns:1.08fr .92fr;gap:58px;position:relative;z-index:2}.v3-live-back{display:inline-flex;align-items:center;gap:7px;color:#9299a7;font-size:11px;margin-bottom:17px}.v3-live-detail-image{aspect-ratio:1.12;border:1px solid var(--line);border-radius:24px;background:#0b0d12;overflow:hidden}.v3-live-detail-image img{width:100%;height:100%;object-fit:cover}.v3-live-detail-console{position:sticky;top:126px;align-self:start;border-left:1px solid var(--line);padding-left:42px}.v3-live-detail-console>small{display:block;margin-top:18px;color:#747b89;font-size:9px;letter-spacing:.14em;text-transform:uppercase}.v3-live-detail-console h1{font-size:clamp(42px,4.4vw,66px);letter-spacing:-.055em;line-height:.98;margin:10px 0 18px}.v3-live-detail-console>p{color:#939aa8;line-height:1.75;max-width:600px}.v3-live-detail-price{display:flex;gap:12px;align-items:baseline;margin:27px 0}.v3-live-detail-price strong{font-size:30px}.v3-live-detail-price del{color:#656c79}.v3-live-detail-console dl{border-top:1px solid var(--line);margin:0 0 24px}.v3-live-detail-console dl>div{min-height:48px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:20px}.v3-live-detail-console dt{color:#727987;font-size:10px}.v3-live-detail-console dd{margin:0;font-size:11px;text-align:right}.v3-live-detail-add{width:100%;height:49px;border:0;border-radius:12px;background:#f4f6f9;color:#07080a;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700}.v3-live-detail-add:disabled{opacity:.45}.v3-live-boundary{margin-top:15px;border:1px solid var(--line);border-radius:13px;padding:14px;background:rgba(255,255,255,.025)}.v3-live-boundary small{color:#858c9b;font-size:9px;text-transform:uppercase;letter-spacing:.12em}.v3-live-boundary p{color:#757c8a;font-size:10px;line-height:1.6;margin:7px 0 0}.v3-live-cart-page{width:min(1280px,100%);margin:0 auto;padding:76px 34px 120px;display:grid;grid-template-columns:1fr 360px;gap:55px;position:relative;z-index:2}.v3-live-cart-main h1{font-size:58px;letter-spacing:-.055em;margin:12px 0}.v3-live-cart-main>p{color:#898f9d;max-width:700px;line-height:1.65}.v3-live-cart-list{margin-top:34px;border-top:1px solid var(--line)}.v3-live-cart-list article{min-height:96px;border-bottom:1px solid var(--line);display:grid;grid-template-columns:72px 1fr auto;gap:15px;align-items:center;padding:12px 0}.v3-live-cart-list img{width:72px;height:72px;object-fit:cover;border-radius:12px}.v3-live-cart-list article>div{display:flex;flex-direction:column;gap:5px}.v3-live-cart-list small{color:#737a88;font-size:9px}.v3-live-cart-list strong{font-size:14px}.v3-live-cart-list span{color:#9da3ae;font-size:11px}.v3-live-cart-list button{height:36px;border:1px solid var(--line);border-radius:10px;background:#0d0f14;color:#9ca2ae;display:flex;align-items:center;gap:6px;padding:0 10px}.v3-live-cart-empty{margin-top:35px;border:1px dashed var(--line);border-radius:18px;padding:55px;text-align:center}.v3-live-cart-empty svg{color:#727987}.v3-live-cart-empty strong{display:block;margin:13px 0 8px}.v3-live-cart-empty p{color:#7e8593}.v3-live-cart-empty a{display:inline-flex;align-items:center;gap:6px;margin-top:12px}.v3-live-cart-summary{position:sticky;top:126px;align-self:start;border:1px solid var(--line);border-radius:18px;background:#0a0c11;padding:20px}.v3-live-cart-summary>span{color:#767d8b;font-size:9px;text-transform:uppercase;letter-spacing:.14em}.v3-live-cart-summary>strong{display:block;font-size:28px;margin:8px 0 19px}.v3-live-cart-summary button{width:100%;min-height:44px;border:0;border-radius:11px;background:#f4f6f9;color:#07080a;font-weight:700}.v3-live-cart-summary button:disabled{opacity:.42}.v3-live-cart-summary button.secondary{margin-top:8px;background:#101219;color:#b8bdc7;border:1px solid var(--line)}.v3-live-cart-summary p{color:#737a88;font-size:10px;line-height:1.6}.v3-live-footer{height:74px;border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 max(28px,calc((100vw - 1380px)/2));color:#666d7a;font-size:9px;letter-spacing:.1em;position:relative;z-index:2}
@media(max-width:980px){.v3-live-header{grid-template-columns:auto auto;gap:15px}.v3-live-header nav{display:none}.v3-live-utils{justify-self:end}.v3-live-hero,.v3-live-detail,.v3-live-cart-page{grid-template-columns:1fr}.v3-live-hero{padding-top:58px}.v3-live-products{grid-template-columns:repeat(2,1fr)}.v3-live-detail-console,.v3-live-cart-summary{position:relative;top:auto;border-left:0;padding-left:0}.v3-live-cart-summary{max-width:none}}
@media(max-width:680px){.v3-live-truth{padding:0 14px}.v3-live-truth code{display:none}.v3-live-header{height:62px;padding:0 14px}.v3-live-brand strong{display:none}.v3-live-cart-link span{display:none}.v3-live-hero,.v3-live-toolbar,.v3-live-products,.v3-live-detail,.v3-live-cart-page{padding-left:16px;padding-right:16px}.v3-live-hero{padding-top:46px;padding-bottom:48px}.v3-live-hero h1{font-size:44px}.v3-live-hero-meta{grid-template-columns:1fr}.v3-live-hero-meta>div{border-right:0;border-bottom:1px solid var(--line)}.v3-live-hero-meta>div:last-child{border-bottom:0}.v3-live-products{grid-template-columns:1fr;padding-bottom:84px}.v3-live-product-actions{grid-template-columns:1fr 1fr}.v3-live-detail{padding-top:35px}.v3-live-detail-console h1{font-size:42px}.v3-live-cart-page{padding-top:48px}.v3-live-cart-main h1{font-size:44px}.v3-live-cart-list article{grid-template-columns:64px 1fr}.v3-live-cart-list img{width:64px;height:64px}.v3-live-cart-list article>button{grid-column:2;justify-self:start}.v3-live-footer{padding:0 16px}.v3-live-footer span:last-child{display:none}}
@media(prefers-reduced-motion:reduce){.v3-live-product-image img{transition:none!important}.v3-live-product:hover .v3-live-product-image img{transform:none!important}}
`;
