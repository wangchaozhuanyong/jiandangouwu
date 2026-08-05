"use client";

import type { ContactChannelType, Locale } from "@cloudbridge/contracts";
import {
  Check,
  Plus,
  ShoppingCartSimple,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  PREVIEW_DEMO_CHANNELS,
  PREVIEW_VALIDATION_NOTICE,
  type PreviewProduct,
} from "../../lib/v2-preview-data";
import { ContactChannelPicker } from "../contact-channel-picker";
import { ResilientImage } from "../resilient-image";

function currencyToken(currency: string) {
  if (currency === "CNY") return "CN¥";
  if (currency === "MYR") return "RM";
  if (currency === "USDT") return "₮";
  return currency;
}

function sumDecimalAmounts(products: PreviewProduct[], currency: string) {
  const total = products.reduce((sum, product) => {
    const value = product.price[currency] ?? product.price.CNY ?? "0.00";
    const [whole = "0", fraction = ""] = value.split(".");
    const normalizedFraction = `${fraction}00`.slice(0, 2);
    return sum + (BigInt(whole) * 100n) + BigInt(normalizedFraction);
  }, 0n);
  return `${total / 100n}.${(total % 100n).toString().padStart(2, "0")}`;
}

type PreviewCartContentProps = {
  closeRef?: RefObject<HTMLButtonElement | null>;
  currency: string;
  items: PreviewProduct[];
  locale: Locale;
  onClose?: () => void;
  onRemove: (productId: PreviewProduct["id"]) => void;
  page?: boolean;
};

function PreviewCartContent({
  closeRef,
  currency,
  items,
  locale,
  onClose,
  onRemove,
  page = false,
}: PreviewCartContentProps) {
  const [channel, setChannel] = useState<ContactChannelType | "">("WECHAT");
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const total = useMemo(() => sumDecimalAmounts(items, currency), [currency, items]);
  const token = currencyToken(currency);

  useEffect(() => {
    if (!items.length) setFeedback("");
  }, [items.length]);

  const submit = () => {
    setFeedback("");
    if (!items.length) {
      setError(locale === "zh" ? "请先选择至少一项模拟商品。" : "Add at least one mock product first.");
      return;
    }
    if (!channel || contact.trim().length < 4) {
      setError(locale === "zh" ? "请选择联系渠道，并填写至少 4 个字符。" : "Choose a contact channel and enter at least 4 characters.");
      return;
    }
    setError("");
    setFeedback(PREVIEW_VALIDATION_NOTICE[locale]);
  };

  const Heading = page ? "h1" : "h2";

  return (
      <section className={`v2-preview-cart${page ? " is-page" : ""}`}>
        <header>
          <div>
            <span><ShoppingCartSimple aria-hidden="true" size={20} /></span>
            <div><Heading>{locale === "zh" ? "购物车" : "Cart"}</Heading><p>{locale === "zh" ? `已选择 ${items.length} 项不同服务` : `${items.length} distinct services selected`}</p></div>
          </div>
          {onClose && <button aria-label={locale === "zh" ? "关闭购物车" : "Close cart"} onClick={onClose} ref={closeRef} type="button"><X aria-hidden="true" size={20} /></button>}
        </header>

        <div className="v2-preview-cart__items">
          {items.length ? items.map((product) => (
            <article key={product.id}>
              <ResilientImage alt={product.imageAlt[locale]} fallbackLabel={locale === "zh" ? "图片不可用" : "Image unavailable"} height={160} sizes="72px" src={product.imageUrl} width={160} />
              <div><strong>{product.name[locale]}</strong><span>{token} {product.price[currency] ?? product.price.CNY}</span></div>
              <button aria-label={`${locale === "zh" ? "移除" : "Remove"} ${product.name[locale]}`} onClick={() => onRemove(product.id)} type="button"><Trash aria-hidden="true" size={17} /><span>{locale === "zh" ? "移除" : "Remove"}</span></button>
            </article>
          )) : (
            <div className="v2-preview-cart__empty"><ShoppingCartSimple aria-hidden="true" size={28} /><strong>{locale === "zh" ? "购物车还是空的" : "Your cart is empty"}</strong><p>{locale === "zh" ? "从商品目录加入不同服务后再预览人工下单。" : "Add distinct services from the catalog to preview a manual order."}</p></div>
          )}
        </div>

        <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <label><span>{locale === "zh" ? "联系渠道" : "Contact channel"}</span><ContactChannelPicker ariaLabel={locale === "zh" ? "选择联系渠道" : "Choose contact channel"} channels={PREVIEW_DEMO_CHANNELS} disabled={false} locale={locale} onChange={(value) => { setChannel(value); setError(""); setFeedback(""); }} value={channel} /></label>
          <label><span>{locale === "zh" ? "联系账号" : "Contact account"}</span><input aria-invalid={Boolean(error)} autoComplete="off" onChange={(event) => { setContact(event.target.value.slice(0, 120)); setError(""); setFeedback(""); }} placeholder={locale === "zh" ? "填写模拟账号，请勿输入敏感信息" : "Enter a mock account; no sensitive data"} type="text" value={contact} /></label>
          {error && <p className="v2-preview-cart__message is-error" role="alert"><WarningCircle aria-hidden="true" size={16} />{error}</p>}
          {feedback && <p className="v2-preview-cart__message" role="status"><Check aria-hidden="true" size={16} />{feedback}</p>}
          <div className="v2-preview-cart__dock">
            <div className="v2-preview-cart__summary"><span>{locale === "zh" ? `小计（${items.length} 项）` : `Subtotal (${items.length})`}</span><strong>{token} {total}</strong></div>
            <div className="v2-preview-cart__dock-action">
              <button className="v2-preview-cart__submit" disabled={!items.length} type="submit">{locale === "zh" ? "提交人工订单" : "Submit manual order"}</button>
              <small>{locale === "zh" ? "人工确认，不含在线支付 · 仅完成界面校验" : "Human confirmation, no online payment · Interface validation only"}</small>
            </div>
          </div>
        </form>
      </section>
  );
}

function PreviewCartRecommendations({
  cartItemIds,
  currency,
  locale,
  onAdd,
  products,
}: {
  cartItemIds: PreviewProduct["id"][];
  currency: string;
  locale: Locale;
  onAdd: (product: PreviewProduct) => void;
  products: PreviewProduct[];
}) {
  if (!products.length) return null;
  const token = currencyToken(currency);
  const base = `/preview/v2/${locale}`;

  return (
    <section aria-labelledby="v2-preview-cart-recommendations" className="v2-preview-cart-recommendations">
      <header>
        <div><small>{locale === "zh" ? "继续浏览" : "Keep exploring"}</small><h2 id="v2-preview-cart-recommendations">{locale === "zh" ? "您可能喜欢" : "You may also like"}</h2></div>
        <p>{locale === "zh" ? "根据当前服务目录整理的模拟推荐，不会保存浏览记录。" : "Mock suggestions from the current catalog. Browsing activity is not saved."}</p>
      </header>
      <div className="v2-preview-cart-recommendations__list">
        {products.map((product) => {
          const selected = cartItemIds.includes(product.id);
          return (
            <article key={product.id}>
              <Link aria-label={`${locale === "zh" ? "查看" : "View"} ${product.name[locale]}`} href={`${base}/products/${product.slug}`}>
                <ResilientImage alt={product.imageAlt[locale]} fallbackLabel={locale === "zh" ? "图片不可用" : "Image unavailable"} height={180} sizes="84px" src={product.imageUrl} width={180} />
                <div><strong>{product.name[locale]}</strong><span>{token} {product.price[currency] ?? product.price.CNY}</span></div>
              </Link>
              <button aria-label={`${selected ? (locale === "zh" ? "已加入" : "Added") : (locale === "zh" ? "加入购物车" : "Add to cart")} ${product.name[locale]}`} disabled={selected} onClick={() => onAdd(product)} type="button">
                {selected ? <Check aria-hidden="true" size={17} /> : <Plus aria-hidden="true" size={17} />}
                <span>{selected ? (locale === "zh" ? "已加入" : "Added") : (locale === "zh" ? "加入" : "Add")}</span>
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function PreviewCart({
  currency,
  items,
  locale,
  onClose,
  onRemove,
  open,
}: {
  currency: string;
  items: PreviewProduct[];
  locale: Locale;
  onClose: () => void;
  onRemove: (productId: PreviewProduct["id"]) => void;
  open: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const returnFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(layerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocus?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      aria-label={locale === "zh" ? "购物车预览" : "Cart preview"}
      aria-modal="true"
      className="v2-preview-cart-layer"
      onPointerDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      ref={layerRef}
      role="dialog"
    >
      <PreviewCartContent closeRef={closeRef} currency={currency} items={items} locale={locale} onClose={onClose} onRemove={onRemove} />
    </div>
  );
}

export function PreviewCartPage({
  cartItemIds,
  currency,
  items,
  locale,
  onAdd,
  onRemove,
  recommendations,
}: {
  cartItemIds: PreviewProduct["id"][];
  currency: string;
  items: PreviewProduct[];
  locale: Locale;
  onAdd: (product: PreviewProduct) => void;
  onRemove: (productId: PreviewProduct["id"]) => void;
  recommendations: PreviewProduct[];
}) {
  return (
    <main className="v2-preview-page v2-preview-cart-page">
      <PreviewCartContent currency={currency} items={items} locale={locale} onRemove={onRemove} page />
      <PreviewCartRecommendations cartItemIds={cartItemIds} currency={currency} locale={locale} onAdd={onAdd} products={recommendations} />
    </main>
  );
}
