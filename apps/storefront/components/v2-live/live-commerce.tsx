"use client";

import {
  contactChannelTypes,
  type ContactChannelType,
  type Locale,
  type OrderLookupResult,
  type OrderReceipt,
  type ProductSummary,
  type StorefrontConfig,
} from "@cloudbridge/contracts";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Headset,
  Package,
  Plus,
  Receipt,
  ShoppingCartSimple,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApiRequestError,
  createOrder,
  getProducts,
  lookupOrder,
} from "../../lib/api";
import {
  reconcileSelectedItemIds,
  toggleSelectedItemId,
} from "../../lib/cart-selection";
import { isValidOrderContact } from "../../lib/order-validation";
import { ContactChannelPicker } from "../contact-channel-picker";
import { useExperience } from "../experience-provider";
import { ResilientImage } from "../resilient-image";
import { V2PageFrame } from "./page-frame";

const labels = {
  zh: {
    cart: "购物车",
    selected: (n: number) => `已选择 ${n} 项不同服务`,
    backToCatalog: "返回商品目录",
    selectionCount: (selected: number, total: number) =>
      `已选 ${selected} / ${total} 项`,
    selectAll: "全选",
    deselectAll: "取消全选",
    selectItem: (name: string) => `选择 ${name}`,
    deselectItem: (name: string) => `取消选择 ${name}`,
    empty: "购物车还是空的",
    emptyBody: "从商品目录加入不同服务后再提交人工订单。",
    channel: "联系渠道",
    channelUnavailable: "暂未配置可用渠道",
    account: "联系账号",
    accountPlaceholder: "填写对应账号、号码或邮箱",
    remove: "移除",
    subtotal: "小计",
    cartContactTitle: "订单联系方式",
    cartContactBody: "仅用于人工确认本次所选服务。",
    submit: "提交人工订单",
    submitting: "正在安全提交",
    boundary: "人工确认，不含在线支付或自动交付",
    selectionRequired: "请至少选择一项服务后再提交。",
    tooMany: "单次最多可提交 10 项不同服务，请拆分订单。",
    invalid: "请选择有效联系渠道并填写至少 4 个字符。",
    failed: "订单暂时无法提交，请检查信息后重试。",
    success: "订单已经进入人工确认流程",
    save: "请保存订单号，后续可在订单查询中使用。",
    lookup: "前往订单查询",
    recommend: "您可能喜欢",
    recommendBody: "来自当前正式服务目录，不保存浏览记录。",
    add: "加入",
    added: "已加入",
    lookupEyebrow: "订单查询",
    lookupTitle: "选择一种方式，找到你的订单。",
    lookupIntro:
      "本机订单仅保存在当前标签页；联系方式查询需要填写下单时使用的完整信息。",
    modes: { local: "本机订单", contact: "联系方式", number: "订单号" },
    localTitle: "本机订单记录",
    localBody:
      "安全摘要会在当前标签页的刷新和页面切换后恢复，关闭标签页后自动清除。",
    localLoading: "正在读取本机订单记录",
    localCacheNotice: "记录只保存在当前浏览器标签页，不会同步到其他设备。",
    clearLocal: "清除本机记录",
    noLocal: "本机还没有订单记录",
    noLocalBody: "提交人工订单后，安全摘要会保存在这里，方便再次查看。",
    contactTitle: "按下单信息查询",
    contactBody:
      "填写下单时使用的联系渠道、联系账号和完整订单号，三项匹配后才会显示订单摘要。",
    contactChannel: "联系渠道",
    contactAccount: "联系账号",
    contactAccountPlaceholder: "填写下单时使用的账号、号码或邮箱",
    contactMenuTitle: "选择下单时使用的渠道",
    contactLookupAction: "查询订单",
    contactChannelRequired: "请选择下单时使用的联系渠道。",
    contactAccountRequired: "请填写至少 4 个字符的联系账号。",
    contactNumberRequired: "请填写完整订单号。",
    numberTitle: "使用完整订单号查询",
    numberBody: "订单号不会放进网址、浏览历史或查询参数。",
    orderNumber: "订单号",
    placeholder: "填写提交成功后获得的完整订单号",
    lookupAction: "查询订单",
    required: "请填写完整订单号。",
    notFound: "没有找到可显示的订单",
    unavailable: "订单查询暂时不可用",
    limited: "请求次数过多，请稍后再试。",
    copied: "已复制",
    copy: "复制订单号",
    status: "状态",
    amount: "金额",
    contact: "联系方式",
    created: "创建时间",
    updated: "更新时间",
    items: "商品",
  },
  en: {
    cart: "Cart",
    selected: (n: number) => `${n} distinct services selected`,
    backToCatalog: "Back to catalog",
    selectionCount: (selected: number, total: number) =>
      `${selected} of ${total} selected`,
    selectAll: "Select all",
    deselectAll: "Deselect all",
    selectItem: (name: string) => `Select ${name}`,
    deselectItem: (name: string) => `Deselect ${name}`,
    empty: "Your cart is empty",
    emptyBody:
      "Add distinct services from the catalog before submitting a manual order.",
    channel: "Contact channel",
    channelUnavailable: "No contact method configured",
    account: "Contact account",
    accountPlaceholder: "Enter the relevant account, number, or email",
    remove: "Remove",
    subtotal: "Subtotal",
    cartContactTitle: "Purchase contact",
    cartContactBody: "Used only to confirm the selected services manually.",
    submit: "Submit manual order",
    submitting: "Submitting securely",
    boundary: "Human confirmation, no online payment or automatic fulfillment",
    selectionRequired: "Select at least one service before submitting.",
    tooMany: "One order supports up to 10 distinct services. Split this order.",
    invalid:
      "Choose a valid contact channel and enter at least four characters.",
    failed:
      "The order could not be submitted. Check the information and retry.",
    success: "The order is awaiting manual confirmation",
    save: "Save the order number for secure lookup later.",
    lookup: "Go to order lookup",
    recommend: "You may also like",
    recommendBody:
      "From the current live catalog; browsing activity is not saved.",
    add: "Add",
    added: "Added",
    lookupEyebrow: "Order lookup",
    lookupTitle: "Choose the way that fits your order.",
    lookupIntro:
      "Device summaries remain in this tab only; purchase-contact lookup needs the complete details used when ordering.",
    modes: {
      local: "On this device",
      contact: "Purchase contact",
      number: "Order number",
    },
    localTitle: "Orders on this device",
    localBody:
      "Safe summaries restore after refreshes and page changes in this tab. They clear when the tab is closed.",
    localLoading: "Loading orders on this device",
    localCacheNotice:
      "These records remain in this browser tab only and do not sync to another device.",
    clearLocal: "Clear device records",
    noLocal: "No orders saved on this device",
    noLocalBody:
      "A safe summary appears here after a successful manual-order submission.",
    contactTitle: "Look up with purchase details",
    contactBody:
      "Enter the channel, account, and complete order number used when ordering. An order summary appears only when all three match.",
    contactChannel: "Contact channel",
    contactAccount: "Contact account",
    contactAccountPlaceholder:
      "Enter the account, number, or email used when ordering",
    contactMenuTitle: "Choose the channel used when ordering",
    contactLookupAction: "Look up order",
    contactChannelRequired: "Choose the contact channel used when ordering.",
    contactAccountRequired: "Enter at least four characters for the contact account.",
    contactNumberRequired: "Enter the complete order number.",
    numberTitle: "Look up with the complete order number",
    numberBody:
      "The order number is never placed in the URL, browser history, or query parameters.",
    orderNumber: "Order number",
    placeholder: "Enter the complete number shown after submission",
    lookupAction: "Look up order",
    required: "Enter the complete order number.",
    notFound: "No order can be displayed",
    unavailable: "Order lookup is temporarily unavailable",
    limited: "Too many requests. Try again later.",
    copied: "Copied",
    copy: "Copy order number",
    status: "Status",
    amount: "Amount",
    contact: "Contact",
    created: "Created",
    updated: "Updated",
    items: "Products",
  },
} as const;

function decimalTotal(items: ProductSummary[], currency: string) {
  const values = items
    .filter((item) => item.price.currency === currency)
    .map((item) => item.price.amount);
  const scale = Math.max(
    0,
    ...values.map((value) => value.split(".")[1]?.length ?? 0),
  );
  const factor = 10n ** BigInt(scale);
  const total = values.reduce((sum, value) => {
    const [whole = "0", fraction = ""] = value.split(".");
    return (
      sum +
      BigInt(whole) * factor +
      BigInt(`${fraction}${"0".repeat(scale)}`.slice(0, scale) || "0")
    );
  }, 0n);
  if (!scale) return total.toString();
  return `${total / factor}.${(total % factor).toString().padStart(scale, "0")}`;
}

function ReceiptCard({
  locale,
  result,
}: {
  locale: Locale;
  result: OrderLookupResult;
}) {
  const t = labels[locale];
  const [copied, setCopied] = useState(false);
  return (
    <article className="v2-preview-lookup-card">
      <header>
        <small>{t.orderNumber}</small>
        <strong>{result.orderNumber}</strong>
      </header>
      <dl>
        <div>
          <dt>{t.status}</dt>
          <dd>{result.status}</dd>
        </div>
        <div>
          <dt>{t.items}</dt>
          <dd>{result.items.map((item) => item.productName).join(" · ")}</dd>
        </div>
        <div>
          <dt>{t.amount}</dt>
          <dd>
            {result.amount.amount} {result.amount.currency}
          </dd>
        </div>
        <div>
          <dt>{t.contact}</dt>
          <dd>{result.maskedContact}</dd>
        </div>
        <div>
          <dt>{t.created}</dt>
          <dd>{result.createdAt}</dd>
        </div>
        <div>
          <dt>{t.updated}</dt>
          <dd>{result.updatedAt}</dd>
        </div>
      </dl>
      <div>
        <button
          onClick={() =>
            void navigator.clipboard
              .writeText(result.orderNumber)
              .then(() => setCopied(true))
          }
          type="button"
        >
          <Copy aria-hidden="true" size={16} />
          {copied ? t.copied : t.copy}
        </button>
      </div>
    </article>
  );
}

export function V2LiveCart({
  config,
  locale,
  recommendations,
}: {
  config: StorefrontConfig | null;
  locale: Locale;
  recommendations: ProductSummary[];
}) {
  const t = labels[locale];
  const {
    addCartItem,
    cartItems,
    currency,
    getListingHref,
    rememberOrderReceipt,
    removeCartItem,
    removeCartItems,
  } = useExperience();
  const channels = config?.channels ?? [];
  const [channel, setChannel] = useState<ContactChannelType | "">(
    channels[0]?.type ?? "",
  );
  const [contact, setContact] = useState("");
  const [state, setState] = useState<
    "idle" | "submitting" | "error" | "success"
  >("idle");
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [fallbackRecommendations, setFallbackRecommendations] = useState<
    ProductSummary[]
  >([]);
  const knownCartItemIds = useRef(new Set(cartItems.map((item) => item.id)));
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(cartItems.map((item) => item.id)),
  );
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectedItems = useMemo(
    () => cartItems.filter((item) => selectedIds.has(item.id)),
    [cartItems, selectedIds],
  );
  const selectedItemCount = selectedItems.length;
  const isAllSelected =
    cartItems.length > 0 && selectedItemCount === cartItems.length;
  const selectionNotice =
    selectedItemCount === 0
      ? t.selectionRequired
      : selectedItemCount > 10
        ? t.tooMany
        : "";
  const total = useMemo(
    () => decimalTotal(selectedItems, currency),
    [selectedItems, currency],
  );
  const recommendationSource = recommendations.length
    ? recommendations
    : fallbackRecommendations;
  const availableRecommendations = recommendationSource
    .filter((item) => !cartItems.some((cart) => cart.id === item.id))
    .slice(0, 5);

  useEffect(() => {
    if (!channel && channels[0]) setChannel(channels[0].type);
  }, [channel, channels]);
  useEffect(() => {
    const itemIds = cartItems.map((item) => item.id);
    setSelectedIds((current) =>
      reconcileSelectedItemIds(itemIds, knownCartItemIds.current, current),
    );
    knownCartItemIds.current = new Set(itemIds);
  }, [cartItems]);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedItemCount > 0 && selectedItemCount < cartItems.length;
    }
  }, [cartItems.length, selectedItemCount]);
  useEffect(() => {
    if (recommendations.length) {
      setFallbackRecommendations([]);
      return undefined;
    }
    const controller = new AbortController();
    void getProducts({
      locale,
      currency: "CNY",
      surface: "HOME",
      signal: controller.signal,
    })
      .then((result) => setFallbackRecommendations(result.data))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setFallbackRecommendations([]);
      });
    return () => controller.abort();
  }, [locale, recommendations.length]);

  const resetSubmissionState = () => {
    setState("idle");
    setMessage("");
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedIds((current) => toggleSelectedItemId(current, itemId));
    resetSubmissionState();
  };

  const toggleAllSelection = () => {
    setSelectedIds(
      isAllSelected ? new Set() : new Set(cartItems.map((item) => item.id)),
    );
    resetSubmissionState();
  };

  const submit = async () => {
    if (!selectedItems.length) {
      setState("error");
      setMessage(t.selectionRequired);
      return;
    }
    if (selectedItems.length > 10) {
      setState("error");
      setMessage(t.tooMany);
      return;
    }
    if (!config || !channel || !isValidOrderContact(contact)) {
      setState("error");
      setMessage(t.invalid);
      return;
    }
    setState("submitting");
    setMessage("");
    try {
      const next = await createOrder<OrderReceipt>(
        {
          locale,
          items: selectedItems.map((item) => ({
            productId: item.id,
            expectedPrice: item.price,
          })),
          currency,
          contactChannel: channel,
          contactValue: contact.trim(),
          acceptedPolicyVersion: config.settings.policyVersion,
        },
        crypto.randomUUID(),
      );
      setReceipt(next);
      rememberOrderReceipt(next);
      removeCartItems(selectedItems.map((item) => item.id));
      setState("success");
    } catch {
      setState("error");
      setMessage(t.failed);
    }
  };
  return (
    <V2PageFrame
      className="v2-preview-cart-page v2-live-cart-page"
      layout="commerce"
    >
      <section className="v2-preview-cart is-page v2-live-cart">
        <header className="v2-live-cart__heading">
          <div>
            <Link className="v2-live-cart__back v2-action v2-action--tertiary" href={getListingHref(locale)}>
              <ArrowLeft aria-hidden="true" size={17} />
              {t.backToCatalog}
            </Link>
            <div>
              <h1>{t.cart}</h1>
              <p>{t.selectionCount(selectedItemCount, cartItems.length)}</p>
            </div>
          </div>
        </header>
        <div className="v2-preview-cart__items">
          {receipt && (
            <section className="v2-live-cart__receipt" role="status">
              <Check aria-hidden="true" size={20} />
              <div>
                <strong>{t.success}</strong>
                <p>{t.save}</p>
              </div>
              <code>{receipt.orderNumber}</code>
              <Link className="v2-action v2-action--secondary" href={`/${locale}/orders/lookup`}>
                {t.lookup}
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </section>
          )}
          {cartItems.length ? (
            <>
              <div className="v2-live-cart__selection-toolbar">
                <label className="v2-live-cart__all-checkbox">
                  <input
                    aria-label={isAllSelected ? t.deselectAll : t.selectAll}
                    checked={isAllSelected}
                    onChange={toggleAllSelection}
                    ref={selectAllRef}
                    type="checkbox"
                  />
                  <i aria-hidden="true" />
                  <span>{isAllSelected ? t.deselectAll : t.selectAll}</span>
                </label>
                <span aria-live="polite">
                  {t.selectionCount(selectedItemCount, cartItems.length)}
                </span>
              </div>
              <div className="v2-live-cart__list">
                {cartItems.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <article key={item.id}>
                      <label className="v2-live-cart__item-checkbox">
                        <input
                          aria-label={
                            isSelected
                              ? t.deselectItem(item.name)
                              : t.selectItem(item.name)
                          }
                          checked={isSelected}
                          onChange={() => toggleItemSelection(item.id)}
                          type="checkbox"
                        />
                        <span aria-hidden="true" />
                      </label>
                      <ResilientImage
                        alt=""
                        fallbackLabel="Image unavailable"
                        height={160}
                        sizes="92px"
                        src={item.imageUrl}
                        width={160}
                      />
                      <div className="v2-live-cart__item-copy">
                        <strong>{item.name}</strong>
                        <span>
                          {item.price.amount} {item.price.currency}
                        </span>
                      </div>
                      <button
                        aria-label={`${t.remove} ${item.name}`}
                        className="v2-action v2-action--danger"
                        onClick={() => {
                          removeCartItem(item.id);
                          setSelectedIds((current) => {
                            const next = new Set(current);
                            next.delete(item.id);
                            return next;
                          });
                          resetSubmissionState();
                        }}
                        type="button"
                      >
                        <Trash aria-hidden="true" size={17} />
                        <span>{t.remove}</span>
                      </button>
                    </article>
                  );
                })}
              </div>
            </>
          ) : !receipt ? (
            <div className="v2-preview-cart__empty">
              <ShoppingCartSimple aria-hidden="true" size={28} />
              <strong>{t.empty}</strong>
              <p>{t.emptyBody}</p>
            </div>
          ) : null}
        </div>
        <form
          className="v2-live-cart__form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <header className="v2-live-cart__contact-heading">
            <h2>{t.cartContactTitle}</h2>
            <p>{t.cartContactBody}</p>
          </header>
          <div className="v2-preview-cart__contact-field">
            <ContactChannelPicker
              ariaLabel={t.channel}
              channels={channels}
              disabled={!channels.length}
              emptyLabel={t.channelUnavailable}
              locale={locale}
              onChange={(value) => {
                setChannel(value);
                resetSubmissionState();
              }}
              value={channel}
            />
          </div>
          <div className="v2-preview-cart__contact-field">
            <input
              aria-label={t.account}
              aria-invalid={state === "error"}
              autoComplete="off"
              onChange={(event) => {
                setContact(event.target.value.slice(0, 120));
                resetSubmissionState();
              }}
              placeholder={t.accountPlaceholder}
              type="text"
              value={contact}
            />
          </div>
          {message && (
            <p className="v2-preview-cart__message is-error" role="alert">
              <WarningCircle aria-hidden="true" size={16} />
              {message}
            </p>
          )}
          <div className="v2-preview-cart__dock">
            <div className="v2-preview-cart__summary">
              <span>
                {t.subtotal}（{selectedItemCount}）
              </span>
              <strong>
                {total} {currency}
              </strong>
            </div>
            <div className="v2-preview-cart__dock-action">
              <button
                className="v2-preview-cart__submit v2-action v2-action--primary"
                disabled={Boolean(selectionNotice) || state === "submitting"}
                type="submit"
              >
                {state === "submitting" ? t.submitting : t.submit}
              </button>
              {selectionNotice && (
                <small className="v2-live-cart__selection-note" role="status">
                  {selectionNotice}
                </small>
              )}
              <small>{t.boundary}</small>
            </div>
          </div>
        </form>
      </section>
      {availableRecommendations.length > 0 && (
        <section className="v2-preview-cart-recommendations">
          <header>
            <div>
              <small>CloudBridge</small>
              <h2>{t.recommend}</h2>
            </div>
            <p>{t.recommendBody}</p>
          </header>
          <div className="v2-preview-cart-recommendations__list">
            {availableRecommendations.map((item) => (
              <article key={item.id}>
                <Link href={`/${locale}/products/${item.slug}`}>
                  <ResilientImage
                    alt=""
                    fallbackLabel="Image unavailable"
                    height={180}
                    sizes="84px"
                    src={item.imageUrl}
                    width={180}
                  />
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.price.amount} {item.price.currency}
                    </span>
                  </div>
                </Link>
                <button
                  className="v2-action v2-action--primary"
                  onClick={() => {
                    addCartItem(item);
                    resetSubmissionState();
                  }}
                  type="button"
                >
                  <Plus aria-hidden="true" size={17} />
                  <span>{t.add}</span>
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </V2PageFrame>
  );
}

type LookupMode = "local" | "contact" | "number";
type RemoteLookupMode = Exclude<LookupMode, "local">;
type LookupState =
  | "idle"
  | "loading"
  | "error"
  | "limited"
  | "unavailable"
  | "ready";
type LookupValidation = {
  orderNumber: boolean;
  contactChannel: boolean;
  contactValue: boolean;
};

const emptyLookupValidation: LookupValidation = {
  orderNumber: false,
  contactChannel: false,
  contactValue: false,
};

const lookupChannelLabels = {
  zh: {
    WHATSAPP: "WhatsApp",
    EMAIL: "电子邮箱",
    TELEGRAM: "Telegram",
    WECHAT: "微信",
    QQ: "QQ",
  },
  en: {
    WHATSAPP: "WhatsApp",
    EMAIL: "Email",
    TELEGRAM: "Telegram",
    WECHAT: "WeChat",
    QQ: "QQ",
  },
} satisfies Record<Locale, Record<ContactChannelType, string>>;

function LookupResults({
  locale,
  result,
  showNotFound,
  state,
}: {
  locale: Locale;
  result: OrderLookupResult | null;
  showNotFound: boolean;
  state: LookupState;
}) {
  const t = labels[locale];
  return (
    <section aria-live="polite" className="v2-preview-lookup-results">
      {state === "loading" ? (
        <div className="v2-preview-lookup-feedback is-loading">
          <span aria-hidden="true" />
        </div>
      ) : result ? (
        <ReceiptCard locale={locale} result={result} />
      ) : state === "limited" ? (
        <div className="v2-preview-lookup-feedback is-warning">
          <WarningCircle aria-hidden="true" size={28} />
          <h2>{t.limited}</h2>
        </div>
      ) : state === "unavailable" ? (
        <div className="v2-preview-lookup-feedback is-error">
          <WarningCircle aria-hidden="true" size={28} />
          <h2>{t.unavailable}</h2>
        </div>
      ) : showNotFound ? (
        <div className="v2-preview-lookup-feedback is-error">
          <WarningCircle aria-hidden="true" size={28} />
          <h2>{t.notFound}</h2>
        </div>
      ) : null}
    </section>
  );
}

export function V2LiveOrderLookup({ locale }: { locale: Locale }) {
  const t = labels[locale];
  const {
    clearOrderReceipts,
    orderReceipts,
    orderReceiptsReady,
  } = useExperience();
  const [mode, setMode] = useState<LookupMode>("local");
  const [number, setNumber] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [contactChannel, setContactChannel] = useState<ContactChannelType | "">("");
  const [contactValue, setContactValue] = useState("");
  const [state, setState] = useState<LookupState>("idle");
  const [validation, setValidation] = useState<LookupValidation>(
    emptyLookupValidation,
  );
  const [result, setResult] = useState<OrderLookupResult | null>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const modes: LookupMode[] = ["local", "contact", "number"];
  const lookupChannels = useMemo(
    () => contactChannelTypes.map((type) => ({
      type,
      label: lookupChannelLabels[locale][type],
    })),
    [locale],
  );
  const hasValidationError = Object.values(validation).some(Boolean);

  const resetLookupState = () => {
    setState("idle");
    setResult(null);
    setValidation(emptyLookupValidation);
  };

  const submit = async (lookupMode: RemoteLookupMode) => {
    const submittedNumber = (
      lookupMode === "contact" ? contactNumber : number
    ).trim();
    const nextValidation: LookupValidation = {
      orderNumber: submittedNumber.length < 16,
      contactChannel: lookupMode === "contact" && !contactChannel,
      contactValue:
        lookupMode === "contact" && !isValidOrderContact(contactValue),
    };
    setValidation(nextValidation);
    if (Object.values(nextValidation).some(Boolean)) {
      setState("error");
      setResult(null);
      return;
    }
    setState("loading");
    setResult(null);
    try {
      setResult(
        await lookupOrder({
          locale,
          mode: lookupMode === "contact" ? "CONTACT" : "ORDER_NUMBER",
          orderNumber: submittedNumber,
          ...(lookupMode === "contact"
            ? {
                contactChannel: contactChannel as ContactChannelType,
                contactValue: contactValue.trim(),
              }
            : {}),
        }),
      );
      setState("ready");
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 429)
        setState("limited");
      else if (error instanceof ApiRequestError && error.status >= 500)
        setState("unavailable");
      else setState("error");
    }
  };
  const selectMode = (nextMode: LookupMode) => {
    setMode(nextMode);
    resetLookupState();
  };
  const handleKeys = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? 2
          : (index + (event.key === "ArrowRight" ? 1 : 2)) % 3;
    selectMode(modes[next] ?? "local");
    tabs.current[next]?.focus();
  };
  return (
    <V2PageFrame className="v2-preview-lookup-page" layout="operation">
      <header className="v2-preview-lookup-heading">
        <h1>{t.lookupEyebrow}</h1>
      </header>
      <nav
        aria-label={t.lookupEyebrow}
        className="v2-preview-lookup-tabs"
        role="tablist"
      >
        {modes.map((item, index) => (
          <button
            aria-selected={mode === item}
            key={item}
            onClick={() => selectMode(item)}
            onKeyDown={(event) => handleKeys(event, index)}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            role="tab"
            tabIndex={mode === item ? 0 : -1}
            type="button"
          >
            {item === "local" ? (
              <Package aria-hidden="true" size={18} />
            ) : item === "contact" ? (
              <Headset aria-hidden="true" size={18} />
            ) : (
              <Receipt aria-hidden="true" size={18} />
            )}
            <span>{t.modes[item]}</span>
          </button>
        ))}
      </nav>
      <section
        className="v2-preview-lookup-workbench"
        role="tabpanel"
        tabIndex={0}
      >
        {mode === "local" ? (
          <div className="v2-preview-lookup-local">
            <header>
              <div>
                <h2>{t.localTitle}</h2>
                <p>{t.localBody}</p>
              </div>
              <span>{orderReceiptsReady ? orderReceipts.length : ""}</span>
            </header>
            {!orderReceiptsReady ? (
              <div className="v2-preview-lookup-feedback is-loading" role="status">
                <span aria-hidden="true" />
                <p>{t.localLoading}</p>
              </div>
            ) : orderReceipts.length ? (
              <div className="v2-preview-lookup-records">
                {orderReceipts.map((receipt) => (
                  <article
                    className="v2-preview-lookup-record"
                    key={receipt.orderNumber}
                  >
                    <div>
                      <small>{t.orderNumber}</small>
                      <strong>{receipt.orderNumber}</strong>
                      <p>{receipt.productName}</p>
                    </div>
                    <span>
                      {receipt.amount.amount} {receipt.amount.currency}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="v2-preview-lookup-feedback is-empty">
                <Receipt aria-hidden="true" size={28} />
                <h2>{t.noLocal}</h2>
                <p>{t.noLocalBody}</p>
              </div>
            )}
            {orderReceiptsReady && orderReceipts.length > 0 && (
              <footer>
                <p>{t.localCacheNotice}</p>
                <button className="v2-action v2-action--danger" onClick={clearOrderReceipts} type="button">
                  <Trash aria-hidden="true" size={16} />
                  {t.clearLocal}
                </button>
              </footer>
            )}
          </div>
        ) : mode === "contact" ? (
          <div className="v2-preview-lookup-query">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit("contact");
              }}
            >
              <header>
                <h2>{t.contactTitle}</h2>
                <p>{t.contactBody}</p>
              </header>
              <div className="v2-preview-lookup-fields is-contact">
                <label>
                  <span>{t.contactChannel}</span>
                  <ContactChannelPicker
                    ariaLabel={t.contactChannel}
                    channels={lookupChannels}
                    disabled={false}
                    emptyLabel={t.contactChannel}
                    invalid={validation.contactChannel}
                    locale={locale}
                    menuEyebrow={t.contactChannel}
                    menuTitle={t.contactMenuTitle}
                    onChange={(value) => {
                      setContactChannel(value);
                      resetLookupState();
                    }}
                    value={contactChannel}
                  />
                  {validation.contactChannel && (
                    <small role="alert">{t.contactChannelRequired}</small>
                  )}
                </label>
                <label>
                  <span>{t.contactAccount}</span>
                  <input
                    aria-invalid={validation.contactValue}
                    autoComplete="off"
                    onChange={(event) => {
                      setContactValue(event.target.value.slice(0, 240));
                      resetLookupState();
                    }}
                    placeholder={t.contactAccountPlaceholder}
                    type="text"
                    value={contactValue}
                  />
                  {validation.contactValue && (
                    <small role="alert">{t.contactAccountRequired}</small>
                  )}
                </label>
                <label>
                  <span>{t.orderNumber}</span>
                  <input
                    aria-invalid={validation.orderNumber}
                    autoComplete="off"
                    onChange={(event) => {
                      setContactNumber(event.target.value.slice(0, 48));
                      resetLookupState();
                    }}
                    placeholder={t.placeholder}
                    type="text"
                    value={contactNumber}
                  />
                  {validation.orderNumber && (
                    <small role="alert">{t.contactNumberRequired}</small>
                  )}
                </label>
              </div>
              <div className="v2-preview-lookup-actions">
                <button className="v2-action v2-action--primary" disabled={state === "loading"} type="submit">
                  {t.contactLookupAction}
                  <ArrowRight aria-hidden="true" size={18} />
                </button>
              </div>
            </form>
            <LookupResults
              locale={locale}
              result={result}
              showNotFound={state === "error" && !hasValidationError}
              state={state}
            />
          </div>
        ) : (
          <div className="v2-preview-lookup-query">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit("number");
              }}
            >
              <header>
                <h2>{t.numberTitle}</h2>
                <p>{t.numberBody}</p>
              </header>
              <div className="v2-preview-lookup-fields">
                <label>
                  <span>{t.orderNumber}</span>
                  <input
                    aria-invalid={validation.orderNumber}
                    autoComplete="off"
                    onChange={(event) => {
                      setNumber(event.target.value.slice(0, 48));
                      resetLookupState();
                    }}
                    placeholder={t.placeholder}
                    type="text"
                    value={number}
                  />
                  {validation.orderNumber && (
                    <small role="alert">{t.required}</small>
                  )}
                </label>
              </div>
              <div className="v2-preview-lookup-actions">
                <button className="v2-action v2-action--primary" disabled={state === "loading"} type="submit">
                  {t.lookupAction}
                  <ArrowRight aria-hidden="true" size={18} />
                </button>
              </div>
            </form>
            <LookupResults
              locale={locale}
              result={result}
              showNotFound={state === "error" && !hasValidationError}
              state={state}
            />
          </div>
        )}
      </section>
    </V2PageFrame>
  );
}
