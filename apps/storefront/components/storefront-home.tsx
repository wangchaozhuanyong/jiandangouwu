"use client";

import {
  ArrowRight,
  CurrencyCircleDollar,
  GlobeHemisphereEast,
  Headset,
  LinkSimple,
  MagnifyingGlass,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  STOREFRONT_LOW_STOCK_MAX,
  type CategorySummary,
  type Locale,
  type ProductSummary,
} from "@cloudbridge/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getCategories, getConfig, getProducts, type StorefrontConfig } from "../lib/api";
import { copy } from "../lib/copy";
import { storefrontResponsiveImage } from "../lib/responsive-images";
import {
  createListingKey,
  isPendingView,
  resolveAsyncViewState,
  UX_TIMINGS,
  type AsyncViewState,
} from "../lib/experience";
import { useExperience } from "./experience-provider";
import { ResilientImage } from "./resilient-image";
import { CurrencyPicker } from "./storefront-controls";

type HomeData = {
  config: StorefrontConfig;
  categories: CategorySummary[];
  products: ProductSummary[];
};

export function StorefrontHome({
  locale,
  initialData,
  initialCategory,
  initialSearch,
}: {
  locale: Locale;
  initialData: HomeData | null;
  initialCategory: string;
  initialSearch: string;
}) {
  const t = copy[locale];
  const router = useRouter();
  const {
    currency,
    setCurrency,
    rememberListing,
    consumeListingScroll,
  } = useExperience();
  const [config, setConfig] = useState<StorefrontConfig | null>(initialData?.config ?? null);
  const [categories, setCategories] = useState<CategorySummary[]>(initialData?.categories ?? []);
  const [products, setProducts] = useState<ProductSummary[]>(initialData?.products ?? []);
  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [heroIndex, setHeroIndex] = useState(0);
  const [state, setState] = useState<AsyncViewState>(
    initialData ? (initialData.products.length ? "ready" : "empty") : "initial-loading",
  );
  const [slow, setSlow] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const initialKey = createListingKey(locale, initialCategory, initialSearch);
  const lastLoadedKey = useRef(initialData ? `${initialKey}|CNY` : "");
  const inFlightKey = useRef("");
  const heroSwipeStart = useRef<number | null>(null);
  const restoreKey = createListingKey(locale, category, debouncedSearch);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 260);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const query = new URLSearchParams();
    if (category) query.set("category", category);
    if (debouncedSearch) query.set("q", debouncedSearch);
    const next = `/${locale}${query.size ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }, [category, debouncedSearch, locale]);

  useEffect(() => {
    if (!isPendingView(state)) {
      setSlow(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setSlow(true), UX_TIMINGS.slowRequestMs);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (!config || config.heroes.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % config.heroes.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [config]);

  const loadBase = useCallback(async (signal?: AbortSignal) => {
    const hasData = Boolean(config || categories.length || products.length);
    setState(resolveAsyncViewState({ hasData, pending: true, failed: false }));
    try {
      const [nextConfig, nextCategories] = await Promise.all([
        getConfig(locale, signal),
        getCategories(locale, signal),
      ]);
      setConfig(nextConfig);
      setCategories(nextCategories);
      if (!nextConfig.currencies.some((item) => item.code === currency)) {
        setCurrency(nextConfig.currencies[0]?.code ?? "MYR");
      }
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      setState(resolveAsyncViewState({
        hasData,
        pending: false,
        failed: true,
        online: navigator.onLine,
      }));
      return false;
    }
  }, [categories.length, config, currency, locale, products.length, setCurrency]);

  const loadProducts = useCallback(async (signal?: AbortSignal) => {
    const hasData = products.length > 0;
    setState(resolveAsyncViewState({ hasData, pending: true, failed: false }));
    try {
      const result = await getProducts({
        locale,
        currency,
        category: category || undefined,
        search: debouncedSearch || undefined,
        signal,
      });
      setProducts(result.data);
      setState(result.data.length ? "ready" : "empty");
      setAnnouncement(
        locale === "zh"
          ? `商品列表已更新，共 ${result.data.length} 项`
          : `Product list updated, ${result.data.length} items`,
      );
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      setState(resolveAsyncViewState({
        hasData,
        pending: false,
        failed: true,
        online: navigator.onLine,
      }));
      return false;
    }
  }, [category, currency, debouncedSearch, locale, products.length]);

  useEffect(() => {
    const key = `${createListingKey(locale, category, debouncedSearch)}|${currency}`;
    if (lastLoadedKey.current === key || inFlightKey.current === key) return undefined;
    inFlightKey.current = key;
    const controller = new AbortController();
    const run = async () => {
      if (!config || categories.length === 0) {
        const ready = await loadBase(controller.signal);
        if (!ready) return;
      }
      await loadProducts(controller.signal);
    };
    void run().finally(() => {
      if (inFlightKey.current === key) inFlightKey.current = "";
      if (!controller.signal.aborted) lastLoadedKey.current = key;
    });
    return () => {
      controller.abort();
      if (inFlightKey.current === key) inFlightKey.current = "";
    };
  }, [categories.length, category, config, currency, debouncedSearch, loadBase, loadProducts, locale]);

  useEffect(() => {
    if (state !== "ready" && state !== "empty") return;
    const savedScroll = consumeListingScroll(restoreKey);
    if (savedScroll === null) return;
    window.requestAnimationFrame(() => window.scrollTo({ top: savedScroll, left: 0, behavior: "auto" }));
  }, [consumeListingScroll, restoreKey, state]);

  useEffect(() => {
    const onOnline = () => {
      if (state !== "offline") return;
      const controller = new AbortController();
      void loadBase(controller.signal).then((ready) => ready && loadProducts(controller.signal));
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [loadBase, loadProducts, state]);

  const hero = config?.heroes[heroIndex];
  const heroLink = hero?.targetSlug ? `/${locale}/products/${hero.targetSlug}` : `/${locale}#catalog`;
  const moveHero = (direction: number) => {
    const count = config?.heroes.length ?? 0;
    if (count < 2) return;
    setHeroIndex((current) => (current + direction + count) % count);
  };
  const finishHeroSwipe = (endX: number) => {
    const startX = heroSwipeStart.current;
    heroSwipeStart.current = null;
    if (startX === null || Math.abs(endX - startX) < 42) return;
    moveHero(endX < startX ? 1 : -1);
  };
  const stockLabel = useCallback((product: ProductSummary) => {
    if (product.stockMode === "FINITE" && product.stockQuantity === 0) return t.soldOut;
    if (
      product.stockMode === "FINITE"
      && product.stockQuantity !== null
      && product.stockQuantity <= STOREFRONT_LOW_STOCK_MAX
    ) {
      return t.lowStock(product.stockQuantity);
    }
    return t.available;
  }, [t]);
  const capabilities = useMemo(() => [
    { icon: GlobeHemisphereEast, label: t.capabilityGlobal },
    { icon: CurrencyCircleDollar, label: t.capabilityPricing },
    { icon: LinkSimple, label: t.capabilityContact },
    { icon: Headset, label: t.capabilitySupport },
  ], [t]);
  const pending = isPendingView(state);
  const hasProducts = products.length > 0;
  const selectCategory = (next: string, target: HTMLButtonElement) => {
    setCategory(next);
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    target.scrollIntoView({ behavior, block: "nearest", inline: "center" });
  };
  const retry = async () => {
    const controller = new AbortController();
    const baseReady = await loadBase(controller.signal);
    if (baseReady) await loadProducts(controller.signal);
  };
  const rememberCurrentListing = () => {
    rememberListing(createListingKey(locale, category, debouncedSearch), window.scrollY);
  };
  const prefetch = (href: string) => router.prefetch(href);

  return (
    <main>
      <section className="hero-stage" aria-label={locale === "zh" ? "首页轮播" : "Featured stories"}>
        {hero ? (
          <article
            className="hero-card"
            onPointerCancel={() => {
              heroSwipeStart.current = null;
            }}
            onPointerDown={(event) => {
              if (event.pointerType !== "touch") heroSwipeStart.current = event.clientX;
            }}
            onPointerUp={(event) => {
              if (event.pointerType !== "touch") finishHeroSwipe(event.clientX);
            }}
            onTouchCancel={() => {
              heroSwipeStart.current = null;
            }}
            onTouchEnd={(event) => {
              finishHeroSwipe(event.changedTouches[0]?.clientX ?? 0);
            }}
            onTouchStart={(event) => {
              heroSwipeStart.current = event.changedTouches[0]?.clientX ?? null;
            }}
          >
            <ResilientImage
              src={hero.imageUrl}
              alt=""
              width={1240}
              height={570}
              loading="eager"
              fetchPriority="high"
              fallbackLabel={t.imageUnavailable}
              {...storefrontResponsiveImage(hero.imageUrl, "hero")}
            />
            <div className="hero-scrim" />
            <div className="hero-copy">
              <p>{hero.eyebrow}</p>
              <h1>{hero.title.split("\n").map((line) => <span key={line}>{line}</span>)}</h1>
              <div className="hero-footer">
                <p>{hero.body}</p>
                <Link href={heroLink} prefetch={false} onMouseEnter={() => prefetch(heroLink)} onFocus={() => prefetch(heroLink)}>
                  {hero.cta}<ArrowRight size={18} />
                </Link>
              </div>
            </div>
            <div
              className="hero-dots"
              role="group"
              aria-label={locale === "zh" ? "轮播分页" : "Hero pagination"}
            >
              {config.heroes.map((item, dotIndex) => (
                <button
                  aria-current={dotIndex === heroIndex ? "true" : undefined}
                  aria-label={locale === "zh"
                    ? `切换到第 ${dotIndex + 1} 张，共 ${config.heroes.length} 张`
                    : `Show slide ${dotIndex + 1} of ${config.heroes.length}`}
                  className={dotIndex === heroIndex ? "is-active" : ""}
                  key={`${item.imageUrl}-${dotIndex}`}
                  onClick={() => setHeroIndex(dotIndex)}
                  type="button"
                />
              ))}
            </div>
          </article>
        ) : (
          <div className="hero-skeleton" aria-hidden="true" />
        )}
      </section>

      <section className="capability-section">
        <div className="capability-rail">
          {capabilities.map(({ icon: Icon, label }) => (
            <div key={label}>
              <Icon size={21} aria-hidden="true" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="catalog-section" id="catalog" aria-busy={pending}>
        <div className="catalog-heading">
          <h2>{t.catalogTitle}</h2>
          <span aria-hidden="true" />
          <p>{t.catalogSubtitle}</p>
        </div>

        <div className="catalog-tools">
          <label className="search-frame">
            <MagnifyingGlass size={25} aria-hidden="true" />
            <span className="sr-only">{t.searchLabel}</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.searchPlaceholder} />
          </label>
          <CurrencyPicker
            ariaLabel={t.currencyLabel}
            currencies={config?.currencies ?? []}
            onChange={setCurrency}
            value={currency}
          />
        </div>

        <div className="category-row">
          <div role="tablist" aria-label={t.categoryLabel}>
            <button role="tab" aria-selected={!category} className={!category ? "is-active" : ""} onClick={(event) => selectCategory("", event.currentTarget)}>{t.categoryAll}</button>
            {categories.map((item) => (
              <button role="tab" aria-selected={category === item.slug} className={category === item.slug ? "is-active" : ""} onClick={(event) => selectCategory(item.slug, event.currentTarget)} key={item.id}>{item.name}</button>
            ))}
          </div>
        </div>

        {(state === "error" || state === "offline") && hasProducts && (
          <div className="catalog-inline-state" role="alert">
            <WarningCircle size={18} aria-hidden="true" />
            <span>{state === "offline" ? t.offline : t.refreshFailed}</span>
            <button onClick={() => void retry()}>{t.retry}</button>
          </div>
        )}
        {slow && <p className="slow-network" role="status">{t.slowNetwork}</p>}

        {(state === "error" || state === "offline") && !hasProducts ? (
          <div className="catalog-state is-error" role="alert">
            <WarningCircle size={28} aria-hidden="true" />
            <h3>{state === "offline" ? t.offline : t.loadError}</h3>
            <button onClick={() => void retry()}>{t.retry}</button>
          </div>
        ) : state === "initial-loading" && !hasProducts ? (
          <div className="product-grid" aria-label={t.loading}>
            {Array.from({ length: 8 }, (_, index) => <div className="product-skeleton" key={index} />)}
          </div>
        ) : state === "empty" ? (
          <div className="catalog-state" role="status">
            <MagnifyingGlass size={28} aria-hidden="true" />
            <h3>{t.emptyTitle}</h3>
            <p>{t.emptyBody}</p>
          </div>
        ) : (
          <div className={`product-grid ${state === "refreshing" ? "is-updating" : ""}`}>
            {products.map((product) => {
              const href = `/${locale}/products/${product.slug}`;
              return (
                <Link
                  className="product-card"
                  href={href}
                  prefetch={false}
                  onMouseEnter={() => prefetch(href)}
                  onFocus={() => prefetch(href)}
                  onClick={rememberCurrentListing}
                  key={product.id}
                >
                  <div className="product-image">
                    <ResilientImage
                      src={product.imageUrl}
                      alt=""
                      width={720}
                      height={610}
                      fallbackLabel={t.imageUnavailable}
                      {...storefrontResponsiveImage(product.imageUrl, "product")}
                    />
                  </div>
                  <div className="product-copy">
                    <div className="product-identity">
                      <h3>{product.name}</h3>
                    </div>
                    <div className="product-price">
                      <div><small>{t.from}</small><strong>{product.price.amount} <em>{product.price.currency}</em></strong></div>
                      {product.referencePrice && <div><small>{t.dualPrice}</small><span>{product.referencePrice.amount} {product.referencePrice.currency}</span></div>}
                    </div>
                    <div className="product-purchase">
                      <div className="product-meta">
                        <span className={product.stockQuantity === 0 ? "is-sold" : product.stockQuantity !== null && product.stockQuantity <= STOREFRONT_LOW_STOCK_MAX ? "is-low" : ""}>{stockLabel(product)}</span>
                      </div>
                      <span className="product-action">{t.viewProduct}<ArrowRight size={17} /></span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
      </section>
    </main>
  );
}
