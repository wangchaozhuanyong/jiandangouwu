"use client";

import {
  ArrowLeft,
  CheckCircle,
  Headset,
  LockKey,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Locale, OrderReceipt, ProductDetail } from "@cloudbridge/contracts";
import Link from "next/link";
import {
  useEffect,
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
  const [fieldError, setFieldError] = useState<"contact" | "policy" | "">("");
  const [slow, setSlow] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const lastLoadedCurrency = useRef(initialProduct ? "CNY" : "");
  const contactRef = useRef<HTMLInputElement>(null);
  const policyRef = useRef<HTMLInputElement>(null);

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
    const dirty = Boolean(draft.contact || draft.accepted) && !receipt;
    if (!dirty) return undefined;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [draft.accepted, draft.contact, receipt]);

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
    if (!draft.accepted) {
      setFieldError("policy");
      focusField(policyRef.current);
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
          const policyChanged = nextConfig.settings.policyVersion !== config.settings.policyVersion;
          setConfig(nextConfig);
          setProduct(nextProduct);
          updateOrderDraft(slug, {
            ...(nextChannel ? { channel: nextChannel } : {}),
            ...(policyChanged ? { accepted: false } : {}),
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
  const accepted = draft.accepted;
  const orderAvailability = resolveOrderAvailability(config);
  const canOrder = orderAvailability === "available";

  return (
    <main className="detail-page">
      <Link className="back-link" href={backHref}><ArrowLeft size={17} /> {t.backHome}</Link>
      {!product && viewState === "initial-loading" ? (
        <div className="detail-skeleton" aria-label={t.loading} />
      ) : !product ? (
        <div className="catalog-state is-error" role="alert">
          <WarningCircle aria-hidden="true" />
          <h1>{viewState === "offline" ? t.offline : t.loadError}</h1>
          <button onClick={retryProduct}>{t.retry}</button>
        </div>
      ) : (
        <div className={`detail-grid ${viewState === "refreshing" ? "is-refreshing" : ""}`} aria-busy={viewState === "refreshing"}>
          <section className="detail-visual">
            <ResilientImage src={product.imageUrl} alt="" width={900} height={1100} loading="eager" fetchPriority="high" fallbackLabel={t.imageUnavailable} />
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
                  <select disabled={!canOrder} value={channel} onChange={(event) => updateDraft({ channel: event.target.value as typeof channel })}>
                    {config?.channels.map((item) => <option value={item.type} key={item.type}>{item.label} · {item.serviceHours}</option>)}
                  </select>
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
                <label className="policy-check">
                  <input
                    ref={policyRef}
                    type="checkbox"
                    checked={accepted}
                    onChange={(event) => updateDraft({ accepted: event.target.checked })}
                    aria-invalid={fieldError === "policy"}
                    aria-describedby={fieldError === "policy" ? "policy-error" : undefined}
                    disabled={!canOrder}
                    required
                  />
                  <span>{t.policyAccept}</span>
                </label>
                {fieldError === "policy" && <small className="field-error" id="policy-error">{t.policyError}</small>}
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
    </main>
  );
}
