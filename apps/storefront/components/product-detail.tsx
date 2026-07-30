"use client";

import {
  ArrowLeft,
  CheckCircle,
  Copy,
  Headset,
  LockKey,
  ShareNetwork,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  DEFAULT_SHARE_TEMPLATE,
  type Locale,
  type OrderReceipt,
  type ProductDetail,
} from "@cloudbridge/contracts";
import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  ApiRequestError,
  createOrder,
  getConfig,
  getProduct,
  type StorefrontConfig,
} from "../lib/api";
import { copy } from "../lib/copy";
import { storefrontResponsiveImage } from "../lib/responsive-images";
import {
  cleanProductUrl,
  copyProductShare,
  renderProductShareTemplate,
  tryNativeProductShare,
} from "../lib/product-share";
import {
  resolveAsyncViewState,
  UX_TIMINGS,
  type AsyncViewState,
  type MutationState,
} from "../lib/experience";
import {
  resolveAvailableContactChannel,
  resolveOrderAvailability,
} from "../lib/order-availability";
import {
  isValidOrderContact,
  MIN_ORDER_CONTACT_LENGTH,
} from "../lib/order-validation";
import { useExperience } from "./experience-provider";
import { ResilientImage } from "./resilient-image";
import { ContactChannelPicker } from "./contact-channel-picker";
import { CurrencyPicker } from "./storefront-controls";

export function ProductDetailView({
  locale,
  slug,
  initialProduct,
  initialConfig,
}: {
  locale: Locale;
  slug: string;
  initialProduct: ProductDetail | null;
  initialConfig: StorefrontConfig | null;
}) {
  const t = copy[locale];
  const {
    currency,
    setCurrency,
    getOrderDraft,
    updateOrderDraft,
    clearOrderDraft,
    getListingHref,
  } = useExperience();
  const draft = getOrderDraft(slug);
  const [product, setProduct] = useState<ProductDetail | null>(initialProduct);
  const [config, setConfig] = useState<StorefrontConfig | null>(initialConfig);
  const [viewState, setViewState] = useState<AsyncViewState>(initialProduct ? "ready" : "initial-loading");
  const [mutationState, setMutationState] = useState<MutationState>("idle");
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [requestError, setRequestError] = useState("");
  const [fieldError, setFieldError] = useState<"contact" | "">("");
  const [slow, setSlow] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [compactNav, setCompactNav] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const lastLoadedCurrency = useRef(initialProduct ? "CNY" : "");
  const contactRef = useRef<HTMLInputElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!config || config.currencies.some((item) => item.code === currency)) return;
    setCurrency(config.currencies[0]?.code ?? "CNY");
  }, [config, currency, setCurrency]);

  useEffect(() => {
    const controller = new AbortController();
    if (lastLoadedCurrency.current === currency && product && config) return () => controller.abort();
    lastLoadedCurrency.current = currency;
    setViewState(resolveAsyncViewState({
      hasData: Boolean(product),
      pending: true,
      failed: false,
    }));
    Promise.all([
      getProduct(slug, locale, currency, controller.signal),
      config ? Promise.resolve(config) : getConfig(locale, controller.signal),
    ]).then(([nextProduct, nextConfig]) => {
      setProduct(nextProduct);
      setConfig(nextConfig);
      const nextChannel = resolveAvailableContactChannel(nextConfig.channels, draft.channel);
      if (nextChannel && nextChannel !== draft.channel) {
        updateOrderDraft(slug, { channel: nextChannel });
      }
      setViewState("ready");
    }).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setViewState(resolveAsyncViewState({
        hasData: Boolean(product),
        pending: false,
        failed: true,
        online: navigator.onLine,
      }));
    });
    return () => controller.abort();
  }, [config, currency, draft.channel, locale, product, reloadNonce, slug, updateOrderDraft]);

  useEffect(() => {
    if (mutationState !== "submitting") {
      setSlow(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setSlow(true), UX_TIMINGS.slowRequestMs);
    return () => window.clearTimeout(timer);
  }, [mutationState]);

  useEffect(() => {
    const dirty = Boolean(draft.contact) && !receipt;
    if (!dirty) return undefined;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [draft.contact, receipt]);

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setCompactNav(!entry?.isIntersecting),
      { rootMargin: "-1px 0px 0px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const focusField = (field: HTMLInputElement | null) => {
    window.requestAnimationFrame(() => {
      field?.focus();
      field?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center",
      });
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !product
      || !config
      || resolveOrderAvailability(config) !== "available"
      || mutationState === "submitting"
    ) return;
    setFieldError("");
    setRequestError("");
    if (!isValidOrderContact(draft.contact)) {
      setFieldError("contact");
      focusField(contactRef.current);
      return;
    }
    const idempotencyKey = draft.idempotencyKey ?? crypto.randomUUID();
    if (!draft.idempotencyKey) updateOrderDraft(slug, { idempotencyKey });
    setMutationState("submitting");
    try {
      const nextReceipt = await createOrder<OrderReceipt>({
        locale,
        productId: product.id,
        currency: product.price.currency,
        contactChannel: draft.channel,
        contactValue: draft.contact.trim(),
        acceptedPolicyVersion: config.settings.policyVersion,
        expectedPrice: product.price,
      }, idempotencyKey);
      setReceipt(nextReceipt);
      setMutationState("success");
      clearOrderDraft(slug);
    } catch (error) {
      let recoveredConflict = false;
      if (error instanceof ApiRequestError && error.status === 409) {
        setViewState("refreshing");
        try {
          const [nextConfig, nextProduct] = await Promise.all([
            getConfig(locale),
            getProduct(slug, locale, currency),
          ]);
          const nextChannel = resolveAvailableContactChannel(nextConfig.channels, draft.channel);
          setConfig(nextConfig);
          setProduct(nextProduct);
          updateOrderDraft(slug, {
            ...(nextChannel ? { channel: nextChannel } : {}),
          });
          setRequestError(t.orderConfigurationUpdated);
          setViewState("ready");
          recoveredConflict = true;
        } catch {
          setViewState(navigator.onLine ? "error" : "offline");
        }
      }
      if (!recoveredConflict) {
        setRequestError(navigator.onLine ? t.orderFailed : t.offline);
      }
      setMutationState("error");
    }
  };

  const retryProduct = () => {
    lastLoadedCurrency.current = "";
    setViewState("initial-loading");
    setReloadNonce((current) => current + 1);
  };
  const updateDraft = (patch: Partial<typeof draft>) => {
    updateOrderDraft(slug, { ...patch, idempotencyKey: null });
    if (mutationState === "error") {
      setMutationState("idle");
      setRequestError("");
    }
  };
  const backHref = getListingHref(locale);
  const channel = draft.channel;
  const contact = draft.contact;
  const orderAvailability = resolveOrderAvailability(config);
  const canOrder = orderAvailability === "available";
  const shareText = product
    ? renderProductShareTemplate(
      config?.settings.shareTemplate?.[locale] ?? DEFAULT_SHARE_TEMPLATE[locale],
      product.name,
      `${product.price.amount} ${product.price.currency}`,
    )
    : "";
  const shareProduct = async () => {
    if (!product) return;
    const url = cleanProductUrl(window.location.href);
    const result = await tryNativeProductShare(
      typeof navigator.share === "function" ? navigator.share.bind(navigator) : undefined,
      { title: product.name, text: shareText, url },
    );
    if (result === "shared" || result === "cancelled") return;
    setShareOpen(true);
  };

  return (
    <main className="detail-page">
      <div className="detail-top-sentinel" ref={topSentinelRef} aria-hidden="true" />
      {compactNav && (
        <nav className="detail-compact-nav is-visible">
          <Link aria-label={t.backHome} href={backHref}><ArrowLeft aria-hidden="true" size={20} /></Link>
          <strong>{product?.name ?? t.serviceLabel}</strong>
          <button aria-label={locale === "zh" ? "分享商品" : "Share product"} disabled={!product} onClick={() => void shareProduct()} type="button">
            <ShareNetwork aria-hidden="true" size={20} />
          </button>
        </nav>
      )}
      {!product && viewState === "initial-loading" ? (
        <div className="detail-skeleton-wrap">
          <Link className="detail-overlay-button is-back" href={backHref} aria-label={t.backHome}><ArrowLeft size={20} /></Link>
          <div className="detail-skeleton" aria-label={t.loading} />
        </div>
      ) : !product ? (
        <div className="catalog-state is-error" role="alert">
          <Link className="detail-error-back" href={backHref}><ArrowLeft size={17} /> {t.backHome}</Link>
          <WarningCircle aria-hidden="true" />
          <h1>{viewState === "offline" ? t.offline : t.loadError}</h1>
          <button onClick={retryProduct}>{t.retry}</button>
        </div>
      ) : (
        <div className={`detail-grid ${viewState === "refreshing" ? "is-refreshing" : ""}`} aria-busy={viewState === "refreshing"}>
          <section className="detail-visual">
            <ResilientImage
              src={product.imageUrl}
              alt=""
              width={900}
              height={1100}
              loading="eager"
              fetchPriority="high"
              fallbackLabel={t.imageUnavailable}
              {...storefrontResponsiveImage(product.imageUrl, "product")}
            />
            <div className="detail-image-actions">
              <Link className="detail-overlay-button" href={backHref} aria-label={t.backHome}>
                <ArrowLeft aria-hidden="true" size={20} />
              </Link>
              <button
                aria-label={locale === "zh" ? "分享商品" : "Share product"}
                className="detail-overlay-button"
                onClick={() => void shareProduct()}
                type="button"
              >
                <ShareNetwork aria-hidden="true" size={20} />
              </button>
            </div>
          </section>
          <section className="detail-copy">
            <h1>{product.name}</h1>
            <div className="detail-pricing">
              <strong>{product.price.amount} <span>{product.price.currency}</span></strong>
              <CurrencyPicker
                ariaLabel={t.currencyLabel}
                currencies={config?.currencies ?? []}
                onChange={(nextCurrency) => {
                  setCurrency(nextCurrency);
                  updateDraft({});
                }}
                value={currency}
                variant="compact"
              />
              {product.referencePrice && <small>≈ {product.referencePrice.amount} {product.referencePrice.currency}</small>}
            </div>
            {viewState === "error" || viewState === "offline" ? (
              <div className="catalog-inline-state" role="alert">
                <WarningCircle size={18} aria-hidden="true" />
                <span>{viewState === "offline" ? t.offline : t.refreshFailed}</span>
                <button onClick={retryProduct}>{t.retry}</button>
              </div>
            ) : null}
            <div className="service-notes">
              <h2>{t.detailTitle}</h2>
              <p>{product.description}</p>
            </div>

            {receipt ? (
              <div className="order-success" role="status" aria-live="polite">
                <CheckCircle size={34} weight="duotone" aria-hidden="true" />
                <h2>{t.orderSuccess}</h2>
                <p>{t.orderSuccessBody}</p>
                <dl>
                  <div><dt>{t.orderNumber}</dt><dd>{receipt.orderNumber}</dd></div>
                  <div><dt>{t.contactChannel}</dt><dd>{receipt.contactChannel}</dd></div>
                </dl>
              </div>
            ) : (
              <form className="order-panel" onSubmit={submit} noValidate>
                <div className="order-panel-heading">
                  <span><Headset size={21} aria-hidden="true" /></span>
                  <div><h2>{t.orderTitle}</h2><p>{t.orderBody}</p></div>
                </div>
                {orderAvailability === "paused" && (
                  <p className="orders-paused" role="status">
                    <WarningCircle size={17} aria-hidden="true" />{t.ordersPausedBody}
                  </p>
                )}
                {orderAvailability === "no-channels" && (
                  <p className="orders-paused" role="status">
                    <WarningCircle size={17} aria-hidden="true" />{t.contactChannelsUnavailableBody}
                  </p>
                )}
                <label>
                  <span>{t.contactChannel}</span>
                  <ContactChannelPicker
                    ariaLabel={t.contactChannel}
                    channels={config?.channels ?? []}
                    disabled={!canOrder}
                    locale={locale}
                    onChange={(nextChannel) => updateDraft({ channel: nextChannel })}
                    value={channel}
                  />
                </label>
                <label>
                  <span>{t.contactValue}</span>
                  <input
                    ref={contactRef}
                    value={contact}
                    onChange={(event) => updateDraft({ contact: event.target.value })}
                    placeholder={t.contactPlaceholder}
                    minLength={MIN_ORDER_CONTACT_LENGTH}
                    maxLength={240}
                    aria-invalid={fieldError === "contact"}
                    aria-describedby={fieldError === "contact" ? "contact-error" : undefined}
                    disabled={!canOrder}
                    required
                  />
                  {fieldError === "contact" && <small className="field-error" id="contact-error">{t.contactError}</small>}
                </label>
                {requestError && <p className="form-error" role="alert"><WarningCircle size={16} aria-hidden="true" />{requestError}</p>}
                {slow && <p className="slow-network" role="status">{t.slowNetwork}</p>}
                <div className="order-action-dock">
                  <span aria-hidden="true">
                    <small>{t.from}</small>
                    <strong>{product.price.amount} {product.price.currency}</strong>
                  </span>
                  <button className="order-submit" type="submit" disabled={!canOrder || mutationState === "submitting" || product.stockQuantity === 0}>
                    <LockKey size={18} aria-hidden="true" />
                    {orderAvailability === "paused"
                      ? t.ordersPaused
                      : orderAvailability === "no-channels"
                        ? t.contactChannelsUnavailable
                        : mutationState === "submitting"
                          ? t.submitting
                          : product.stockQuantity === 0
                            ? t.soldOut
                            : mutationState === "error"
                              ? t.retryOrder
                              : t.submitOrder}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
      {shareOpen && product && (
        <ProductShareSheet
          locale={locale}
          onClose={() => setShareOpen(false)}
          productName={product.name}
          text={shareText}
          url={cleanProductUrl(window.location.href)}
        />
      )}
    </main>
  );
}

function ProductShareSheet({
  locale,
  onClose,
  productName,
  text,
  url,
}: {
  locale: Locale;
  onClose: () => void;
  productName: string;
  text: string;
  url: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState("");
  const zh = locale === "zh";

  useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeRef.current?.focus());
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(panelRef.current?.querySelectorAll<HTMLButtonElement>(
        "button:not([disabled])",
      ) ?? [])];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keyDown);
    return () => {
      document.removeEventListener("keydown", keyDown);
      document.body.style.overflow = previousOverflow;
      returnFocus?.focus();
    };
  }, [onClose]);

  const copyShare = async () => {
    setStatus("");
    try {
      const copied = await copyProductShare(
        navigator.clipboard?.writeText?.bind(navigator.clipboard),
        text,
        url,
      );
      setStatus(copied
        ? (zh ? "文案与链接已复制。" : "Copy and link copied.")
        : (zh ? "复制失败，请手动选择下方内容。" : "Copy failed. Select the content below manually."));
    } catch {
      setStatus(zh ? "复制失败，请手动选择下方内容。" : "Copy failed. Select the content below manually.");
    }
  };

  return (
    <div
      className="product-share-layer"
      onPointerDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section aria-labelledby={titleId} aria-modal="true" className="product-share-sheet" ref={panelRef} role="dialog">
        <i aria-hidden="true" />
        <header>
          <div>
            <small>{zh ? "分享商品" : "Share product"}</small>
            <h2 id={titleId}>{productName}</h2>
          </div>
          <button aria-label={zh ? "关闭分享" : "Close share"} onClick={onClose} ref={closeRef} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <div className="product-share-preview">
          <p>{text}</p>
          <code>{url}</code>
        </div>
        <button className="product-share-copy" onClick={() => void copyShare()} type="button">
          <Copy aria-hidden="true" size={18} />
          {zh ? "复制文案与链接" : "Copy text and link"}
        </button>
        <span aria-live="polite" role="status">{status}</span>
      </section>
    </div>
  );
}
