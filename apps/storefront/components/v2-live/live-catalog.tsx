"use client";

import type {
  CategorySummary,
  Locale,
  ProductSummary,
  ProductSurface,
  StorefrontBanner,
  StorefrontConfig,
} from "@cloudbridge/contracts";
import {
  ArrowRight,
  Check,
  MagnifyingGlass,
  Package,
  ShoppingCartSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getProducts } from "../../lib/api";
import { useExperience } from "../experience-provider";
import { ResilientImage } from "../resilient-image";
import { CurrencyPicker } from "../storefront-controls";

const text = {
  zh: {
    search: "搜索商品",
    placeholder: "输入名称或关键词",
    currency: "显示币种",
    clear: "清除筛选",
    allProducts: "全部商品",
    allCategories: "全部分类",
    primary: "一级商品分类",
    secondary: "二级商品分类",
    current: "当前价格",
    reference: "参考换算",
    available: "现货",
    soldOut: "暂时售罄",
    low: (count: number) => `仅余 ${count} 份`,
    view: "查看详情",
    add: "加入购物车",
    added: "已加入购物车",
    empty: "没有找到匹配的商品",
    emptyBody: "请尝试更短的关键词，或切换其他分类。",
    error: "商品目录暂时无法连接",
    errorBody: "当前没有把未知状态显示成空商品，请稍后重试。",
    retry: "重新连接",
    banner: "专题广告",
    slide: (index: number) => `查看第 ${index} 张广告`,
    image: "图片暂时无法显示",
  },
  en: {
    search: "Search products",
    placeholder: "Search by name or keyword",
    currency: "Display currency",
    clear: "Clear filters",
    allProducts: "All products",
    allCategories: "All categories",
    primary: "Primary product categories",
    secondary: "Secondary product categories",
    current: "Current price",
    reference: "Reference",
    available: "Available",
    soldOut: "Sold out",
    low: (count: number) => `Only ${count} left`,
    view: "View details",
    add: "Add to cart",
    added: "Added to cart",
    empty: "No matching products",
    emptyBody: "Try a shorter keyword or choose another category.",
    error: "The catalog is temporarily unavailable",
    errorBody:
      "An unknown state is never presented as an empty catalog. Please retry.",
    retry: "Reconnect",
    banner: "Featured banners",
    slide: (index: number) => `View banner ${index}`,
    image: "Image unavailable",
  },
} as const;

function updateQuery(values: Record<string, string>) {
  const next = new URLSearchParams(window.location.search);
  Object.entries(values).forEach(([key, value]) =>
    value ? next.set(key, value) : next.delete(key),
  );
  const query = next.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
  );
}

function bannerHref(banner: StorefrontBanner, locale: Locale) {
  if (banner.targetType === "PRODUCT" && banner.targetValue)
    return `/${locale}/products/${encodeURIComponent(banner.targetValue)}`;
  if (banner.targetType === "CATEGORY" && banner.targetValue)
    return `/${locale}?secondary=${encodeURIComponent(banner.targetValue)}#catalog`;
  if (banner.targetType === "EXTERNAL_URL" && banner.targetValue) {
    try {
      if (new URL(banner.targetValue).protocol === "https:")
        return banner.targetValue;
    } catch {
      /* fall through */
    }
  }
  return `/${locale}#catalog`;
}

function LiveHero({
  banners,
  locale,
}: {
  banners: StorefrontBanner[];
  locale: Locale;
}) {
  const t = text[locale];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const startX = useRef<number | null>(null);
  const active = banners[index] ?? banners[0];

  useEffect(() => setIndex(0), [banners]);
  useEffect(() => {
    if (
      paused ||
      banners.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return undefined;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % banners.length),
      6200,
    );
    return () => window.clearInterval(timer);
  }, [banners.length, paused]);
  if (!active) return null;
  const href = bannerHref(active, locale);
  const external = href.startsWith("https://");
  return (
    <section
      aria-label={t.banner}
      className="v2-preview-hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={(event) => {
        startX.current = event.clientX;
      }}
      onPointerUp={(event) => {
        if (startX.current === null || banners.length < 2) return;
        const distance = event.clientX - startX.current;
        startX.current = null;
        if (Math.abs(distance) >= 42)
          setIndex(
            (current) =>
              (current + (distance < 0 ? 1 : banners.length - 1)) %
              banners.length,
          );
      }}
    >
      <article>
        <ResilientImage
          alt=""
          fallbackLabel={t.image}
          fetchPriority="high"
          height={720}
          loading="eager"
          sizes="100vw"
          src={active.imageUrl}
          width={1600}
        />
        <span aria-hidden="true" className="v2-preview-hero__scrim" />
        <div className="v2-preview-hero__copy">
          <p>{active.eyebrow}</p>
          <h1>{active.title}</h1>
          <div>
            <span>{active.body}</span>
            <a
              href={href}
              {...(external
                ? { rel: "noopener noreferrer", target: "_blank" }
                : {})}
            >
              {active.cta || (locale === "zh" ? "查看服务" : "View services")}
              <ArrowRight aria-hidden="true" size={18} />
            </a>
          </div>
        </div>
      </article>
      {banners.length > 1 && (
        <div className="v2-preview-hero__dots">
          {banners.map((banner, dot) => (
            <button
              aria-label={t.slide(dot + 1)}
              className={dot === index ? "is-active" : ""}
              key={banner.key}
              onClick={() => setIndex(dot)}
              type="button"
            />
          ))}
        </div>
      )}
    </section>
  );
}

function stockLabel(product: ProductSummary, locale: Locale) {
  const t = text[locale];
  if (product.stockMode === "FINITE" && (product.stockQuantity ?? 0) <= 0)
    return { label: t.soldOut, className: "is-paused", disabled: true };
  if (product.stockMode === "FINITE" && (product.stockQuantity ?? 0) <= 3)
    return {
      label: t.low(product.stockQuantity ?? 0),
      className: "is-low",
      disabled: false,
    };
  return { label: t.available, className: "", disabled: false };
}

function LiveProductCard({
  locale,
  product,
}: {
  locale: Locale;
  product: ProductSummary;
}) {
  const t = text[locale];
  const { addCartItem, cartItems } = useExperience();
  const selected = cartItems.some((item) => item.id === product.id);
  const stock = stockLabel(product, locale);
  return (
    <article className="v2-preview-product-card">
      <Link
        aria-label={`${t.view} · ${product.name}`}
        className="v2-live-product-card__hit"
        href={`/${locale}/products/${product.slug}`}
      />
      <div className="v2-preview-product-card__image">
        <ResilientImage
          alt=""
          fallbackLabel={t.image}
          height={520}
          sizes="(max-width:760px) 92px,20vw"
          src={product.imageUrl}
          width={720}
        />
      </div>
      <div className="v2-preview-product-card__body">
        <div className="v2-preview-product-card__identity">
          <h3>{product.name}</h3>
        </div>
        <div className="v2-preview-product-card__price">
          <small>{t.current}</small>
          <strong>
            {product.price.amount} {product.price.currency}
          </strong>
          {product.referencePrice && (
            <span>
              {t.reference} · {product.referencePrice.amount}{" "}
              {product.referencePrice.currency}
            </span>
          )}
        </div>
        <div className="v2-preview-product-card__purchase">
          <span className={stock.className}>
            <i />
            {stock.label}
          </span>
          <div>
            <Link
              aria-disabled={stock.disabled}
              href={`/${locale}/products/${product.slug}`}
            >
              {t.view}
            </Link>
            <button
              aria-label={`${selected ? t.added : t.add} · ${product.name}`}
              disabled={stock.disabled || selected}
              onClick={() => addCartItem(product)}
              type="button"
            >
              {selected ? (
                <Check aria-hidden="true" size={16} />
              ) : (
                <ShoppingCartSimple aria-hidden="true" size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function V2LiveCatalogPage({
  banners,
  categories,
  config,
  initialProducts,
  locale,
  surface,
}: {
  banners: StorefrontBanner[];
  categories: CategorySummary[];
  config: StorefrontConfig | null;
  initialProducts: ProductSummary[];
  locale: Locale;
  surface: ProductSurface;
}) {
  const t = text[locale];
  const { currency, setCurrency } = useExperience();
  const [primary, setPrimary] = useState("all");
  const [secondary, setSecondary] = useState("all");
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState(initialProducts);
  const [state, setState] = useState<"ready" | "loading" | "error">("ready");
  const lastRequest = useRef("");
  const restoredUrlState = useRef(false);
  const currencies = config?.currencies ?? [];
  const secondaryCategories = useMemo(
    () =>
      primary === "all"
        ? categories.flatMap((item) => item.children ?? [])
        : (categories.find((item) => item.slug === primary)?.children ?? []),
    [categories, primary],
  );

  useEffect(() => {
    if (restoredUrlState.current) return;
    restoredUrlState.current = true;
    const params = new URLSearchParams(window.location.search);
    const requestedPrimary = params.get("primary") ?? "all";
    const requestedSecondary = params.get("secondary") ?? "all";
    const nextPrimary = categories.some(
      (item) => item.slug === requestedPrimary,
    )
      ? requestedPrimary
      : "all";
    const nextSecondary = categories
      .flatMap((item) => item.children ?? [])
      .some((item) => item.slug === requestedSecondary)
      ? requestedSecondary
      : "all";
    const validForPrimary =
      nextSecondary === "all" ||
      nextPrimary === "all" ||
      (
        categories.find((item) => item.slug === nextPrimary)?.children ?? []
      ).some((item) => item.slug === nextSecondary);
    setPrimary(nextPrimary);
    setSecondary(validForPrimary ? nextSecondary : "all");
    setQuery(params.get("q")?.slice(0, 120) ?? "");
    if (
      requestedPrimary !== nextPrimary ||
      requestedSecondary !== (validForPrimary ? nextSecondary : "all")
    ) {
      updateQuery({
        primary: nextPrimary === "all" ? "" : nextPrimary,
        secondary:
          validForPrimary && nextSecondary !== "all" ? nextSecondary : "",
      });
    }
  }, [categories]);

  useEffect(() => {
    if (
      secondary === "all" ||
      secondaryCategories.some((item) => item.slug === secondary)
    )
      return;
    setSecondary("all");
    updateQuery({ secondary: "" });
  }, [secondary, secondaryCategories]);

  useEffect(() => {
    if (!currencies.length || currencies.some((item) => item.code === currency))
      return;
    setCurrency(currencies[0]?.code ?? "CNY");
  }, [currencies, currency, setCurrency]);

  useEffect(() => {
    const requestKey = `${surface}:${currency}:${primary}:${secondary}:${query.trim()}`;
    if (
      !lastRequest.current &&
      currency === "CNY" &&
      primary === "all" &&
      secondary === "all" &&
      !query.trim()
    ) {
      lastRequest.current = requestKey;
      return undefined;
    }
    lastRequest.current = requestKey;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState("loading");
      void getProducts({
        locale,
        currency,
        surface,
        category:
          secondary !== "all"
            ? secondary
            : primary !== "all"
              ? primary
              : undefined,
        search: query.trim() || undefined,
        signal: controller.signal,
      })
        .then((result) => {
          setProducts(result.data);
          setState("ready");
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError")
            return;
          setState("error");
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currency, locale, primary, query, secondary, surface]);

  const choosePrimary = (slug: string) => {
    setPrimary(slug);
    setSecondary("all");
    updateQuery({ primary: slug === "all" ? "" : slug, secondary: "" });
  };
  const chooseSecondary = (slug: string) => {
    setSecondary(slug);
    updateQuery({ secondary: slug === "all" ? "" : slug });
  };
  const clear = () => {
    setPrimary("all");
    setSecondary("all");
    setQuery("");
    updateQuery({ primary: "", secondary: "", q: "" });
  };

  return (
    <main
      className={`v2-preview-page ${surface === "HOME" ? "v2-preview-home" : "v2-preview-market-page"}`}
    >
      <LiveHero banners={banners} locale={locale} />
      <section className="v2-preview-catalog" id="catalog">
        <div className="v2-preview-catalog__main">
          <div className="v2-preview-catalog__controls">
            <div className="v2-preview-catalog__toolbar">
              <label className="v2-preview-catalog__search">
                <span className="sr-only">{t.search}</span>
                <MagnifyingGlass aria-hidden="true" size={19} />
                <input
                  aria-label={t.search}
                  onChange={(event) => {
                    const value = event.target.value.slice(0, 120);
                    setQuery(value);
                    updateQuery({ q: value.trim() });
                  }}
                  placeholder={t.placeholder}
                  type="search"
                  value={query}
                />
                {query && (
                  <button
                    aria-label={t.clear}
                    onClick={() => {
                      setQuery("");
                      updateQuery({ q: "" });
                    }}
                    type="button"
                  >
                    <X aria-hidden="true" size={17} />
                  </button>
                )}
              </label>
              <CurrencyPicker
                ariaLabel={t.currency}
                currencies={currencies}
                onChange={setCurrency}
                value={currency}
              />
            </div>
            <nav
              aria-label={t.primary}
              className="v2-preview-primary-categories"
            >
              <button
                aria-pressed={primary === "all"}
                className={primary === "all" ? "is-active" : ""}
                onClick={() => choosePrimary("all")}
                type="button"
              >
                {t.allProducts}
              </button>
              {categories.map((item) => (
                <button
                  aria-pressed={primary === item.slug}
                  className={primary === item.slug ? "is-active" : ""}
                  key={item.id}
                  onClick={() => choosePrimary(item.slug)}
                  type="button"
                >
                  {item.name}
                </button>
              ))}
            </nav>
          </div>
          <nav
            aria-label={t.secondary}
            className="v2-preview-secondary-categories"
          >
            <button
              aria-pressed={secondary === "all"}
              className={secondary === "all" ? "is-active" : ""}
              onClick={() => chooseSecondary("all")}
              type="button"
            >
              {t.allCategories}
            </button>
            {secondaryCategories.map((item) => (
              <button
                aria-pressed={secondary === item.slug}
                className={secondary === item.slug ? "is-active" : ""}
                key={item.id}
                onClick={() => chooseSecondary(item.slug)}
                type="button"
              >
                {item.name}
              </button>
            ))}
          </nav>
          <div
            className="v2-preview-catalog__results"
            aria-busy={state === "loading"}
          >
            {state === "error" ? (
              <div className="v2-preview-state is-error" role="alert">
                <span>
                  <WarningCircle aria-hidden="true" size={25} />
                </span>
                <h3>{t.error}</h3>
                <p>{t.errorBody}</p>
                <button onClick={() => setCurrency(currency)} type="button">
                  {t.retry}
                </button>
              </div>
            ) : products.length ? (
              <div
                className={`v2-preview-product-grid${state === "loading" ? " is-refreshing" : ""}`}
              >
                {products.map((product) => (
                  <LiveProductCard
                    key={product.id}
                    locale={locale}
                    product={product}
                  />
                ))}
              </div>
            ) : (
              <div className="v2-preview-state is-empty">
                <span>
                  <Package aria-hidden="true" size={25} />
                </span>
                <h3>{t.empty}</h3>
                <p>{t.emptyBody}</p>
                <button onClick={clear} type="button">
                  {t.clear}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
