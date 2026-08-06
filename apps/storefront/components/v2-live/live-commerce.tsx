"use client";

import type {
  ContactChannelType,
  Locale,
  OrderLookupResult,
  OrderReceipt,
  ProductSummary,
  StorefrontConfig,
} from "@cloudbridge/contracts";
import {
  ArrowRight,
  Check,
  Copy,
  Headset,
  Package,
  Plus,
  Receipt,
  ShieldCheck,
  ShoppingCartSimple,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiRequestError, createOrder, lookupOrder } from "../../lib/api";
import { isValidOrderContact } from "../../lib/order-validation";
import { ContactChannelPicker } from "../contact-channel-picker";
import { useExperience } from "../experience-provider";
import { ResilientImage } from "../resilient-image";

const labels = {
  zh: {
    cart: "购物车",
    selected: (n: number) => `已选择 ${n} 项不同服务`,
    empty: "购物车还是空的",
    emptyBody: "从商品目录加入不同服务后再提交人工订单。",
    channel: "联系渠道",
    account: "联系账号",
    accountPlaceholder: "填写对应账号、号码或邮箱",
    remove: "移除",
    subtotal: "小计",
    submit: "提交人工订单",
    submitting: "正在安全提交",
    boundary: "人工确认，不含在线支付或自动交付",
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
      "本机摘要只存在于当前页面会话；联系方式查询在完成所有权验证前保持关闭；完整订单号可安全查询精简结果。",
    modes: { local: "本机订单", contact: "联系方式", number: "订单号" },
    localTitle: "当前会话中的订单",
    localBody:
      "这里只显示本次打开网站后成功提交的安全摘要，刷新或关闭页面后不会保留。",
    noLocal: "当前会话还没有订单摘要",
    noLocalBody: "提交人工订单后，安全摘要会出现在这里。",
    contactTitle: "联系方式查询尚未开放",
    contactBody:
      "后端不会在缺少所有权验证的情况下开放单独联系方式查询，避免他人枚举订单。",
    numberTitle: "使用完整订单号查询",
    numberBody: "订单号不会放进网址、浏览历史或查询参数。",
    orderNumber: "订单号",
    placeholder: "填写提交成功后获得的完整订单号",
    lookupAction: "查询订单",
    required: "请填写完整订单号。",
    notFound: "没有找到可显示的订单",
    unavailable: "订单查询暂时不可用",
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
    empty: "Your cart is empty",
    emptyBody:
      "Add distinct services from the catalog before submitting a manual order.",
    channel: "Contact channel",
    account: "Contact account",
    accountPlaceholder: "Enter the relevant account, number, or email",
    remove: "Remove",
    subtotal: "Subtotal",
    submit: "Submit manual order",
    submitting: "Submitting securely",
    boundary: "Human confirmation, no online payment or automatic fulfillment",
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
      "Device summaries exist only in this page session; contact lookup stays closed until ownership verification exists; a complete order number can retrieve a minimal result.",
    modes: {
      local: "On this device",
      contact: "Purchase contact",
      number: "Order number",
    },
    localTitle: "Orders in this session",
    localBody:
      "Only safe summaries from successful submissions in this open website session appear here. They do not persist after refresh or close.",
    noLocal: "No order summaries in this session",
    noLocalBody:
      "A safe summary appears here after a successful manual-order submission.",
    contactTitle: "Contact lookup is not open yet",
    contactBody:
      "The backend will not expose single-contact lookup without ownership verification because that would allow order enumeration.",
    numberTitle: "Look up with the complete order number",
    numberBody:
      "The order number is never placed in the URL, browser history, or query parameters.",
    orderNumber: "Order number",
    placeholder: "Enter the complete number shown after submission",
    lookupAction: "Look up order",
    required: "Enter the complete order number.",
    notFound: "No order can be displayed",
    unavailable: "Order lookup is temporarily unavailable",
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
    clearCart,
    currency,
    rememberOrderReceipt,
    removeCartItem,
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
  const total = useMemo(
    () => decimalTotal(cartItems, currency),
    [cartItems, currency],
  );
  const availableRecommendations = recommendations
    .filter((item) => !cartItems.some((cart) => cart.id === item.id))
    .slice(0, 5);

  useEffect(() => {
    if (!channel && channels[0]) setChannel(channels[0].type);
  }, [channel, channels]);
  const submit = async () => {
    if (
      !config ||
      !cartItems.length ||
      !channel ||
      !isValidOrderContact(contact)
    ) {
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
          items: cartItems.map((item) => ({
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
      clearCart();
      setState("success");
    } catch {
      setState("error");
      setMessage(t.failed);
    }
  };
  return (
    <main className="v2-preview-page v2-preview-cart-page">
      <section className="v2-preview-cart is-page">
        <header>
          <div>
            <span>
              <ShoppingCartSimple aria-hidden="true" size={20} />
            </span>
            <div>
              <h1>{t.cart}</h1>
              <p>{t.selected(cartItems.length)}</p>
            </div>
          </div>
        </header>
        <div className="v2-preview-cart__items">
          {cartItems.length ? (
            cartItems.map((item) => (
              <article key={item.id}>
                <ResilientImage
                  alt=""
                  fallbackLabel="Image unavailable"
                  height={160}
                  sizes="72px"
                  src={item.imageUrl}
                  width={160}
                />
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.price.amount} {item.price.currency}
                  </span>
                </div>
                <button
                  aria-label={`${t.remove} ${item.name}`}
                  onClick={() => removeCartItem(item.id)}
                  type="button"
                >
                  <Trash aria-hidden="true" size={17} />
                  <span>{t.remove}</span>
                </button>
              </article>
            ))
          ) : receipt ? (
            <div className="v2-preview-cart__empty">
              <Check aria-hidden="true" size={28} />
              <strong>{t.success}</strong>
              <p>{t.save}</p>
              <code>{receipt.orderNumber}</code>
              <Link href={`/${locale}/orders/lookup`}>
                {t.lookup}
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
          ) : (
            <div className="v2-preview-cart__empty">
              <ShoppingCartSimple aria-hidden="true" size={28} />
              <strong>{t.empty}</strong>
              <p>{t.emptyBody}</p>
            </div>
          )}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label>
            <span>{t.channel}</span>
            <ContactChannelPicker
              ariaLabel={t.channel}
              channels={channels}
              disabled={!channels.length}
              locale={locale}
              onChange={(value) => {
                setChannel(value);
                setState("idle");
              }}
              value={channel}
            />
          </label>
          <label>
            <span>{t.account}</span>
            <input
              aria-invalid={state === "error"}
              autoComplete="off"
              onChange={(event) => {
                setContact(event.target.value.slice(0, 120));
                setState("idle");
              }}
              placeholder={t.accountPlaceholder}
              type="text"
              value={contact}
            />
          </label>
          {message && (
            <p className="v2-preview-cart__message is-error" role="alert">
              <WarningCircle aria-hidden="true" size={16} />
              {message}
            </p>
          )}
          <div className="v2-preview-cart__dock">
            <div className="v2-preview-cart__summary">
              <span>
                {t.subtotal}（{cartItems.length}）
              </span>
              <strong>
                {total} {currency}
              </strong>
            </div>
            <div className="v2-preview-cart__dock-action">
              <button
                className="v2-preview-cart__submit"
                disabled={!cartItems.length || state === "submitting"}
                type="submit"
              >
                {state === "submitting" ? t.submitting : t.submit}
              </button>
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
                <button onClick={() => addCartItem(item)} type="button">
                  <Plus aria-hidden="true" size={17} />
                  <span>{t.add}</span>
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

type LookupMode = "local" | "contact" | "number";

export function V2LiveOrderLookup({ locale }: { locale: Locale }) {
  const t = labels[locale];
  const { openSupport, orderReceipts } = useExperience();
  const [mode, setMode] = useState<LookupMode>("local");
  const [number, setNumber] = useState("");
  const [state, setState] = useState<
    "idle" | "loading" | "error" | "limited" | "unavailable" | "ready"
  >("idle");
  const [result, setResult] = useState<OrderLookupResult | null>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const modes: LookupMode[] = ["local", "contact", "number"];
  const submit = async () => {
    if (number.trim().length < 16) {
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
          mode: "ORDER_NUMBER",
          orderNumber: number.trim(),
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
    setMode(modes[next] ?? "local");
    tabs.current[next]?.focus();
  };
  return (
    <main className="v2-preview-page v2-preview-lookup-page">
      <header className="v2-preview-lookup-heading">
        <small>{t.lookupEyebrow}</small>
        <h1>{t.lookupTitle}</h1>
        <p>{t.lookupIntro}</p>
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
            onClick={() => {
              setMode(item);
              setState("idle");
              setResult(null);
            }}
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
              <span>{orderReceipts.length}</span>
            </header>
            {orderReceipts.length ? (
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
          </div>
        ) : mode === "contact" ? (
          <div className="v2-preview-lookup-feedback is-warning">
            <ShieldCheck aria-hidden="true" size={29} />
            <h2>{t.contactTitle}</h2>
            <p>{t.contactBody}</p>
            <button onClick={openSupport} type="button">
              {labels[locale].contact}
              <ArrowRight aria-hidden="true" size={16} />
            </button>
          </div>
        ) : (
          <div className="v2-preview-lookup-query">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
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
                    aria-invalid={state === "error"}
                    autoComplete="off"
                    onChange={(event) => {
                      setNumber(event.target.value.slice(0, 48));
                      setState("idle");
                      setResult(null);
                    }}
                    placeholder={t.placeholder}
                    value={number}
                  />
                  {state === "error" && (
                    <small role="alert">
                      {number.trim().length < 16 ? t.required : t.notFound}
                    </small>
                  )}
                </label>
              </div>
              <div className="v2-preview-lookup-actions">
                <button disabled={state === "loading"} type="submit">
                  {t.lookupAction}
                  <ArrowRight aria-hidden="true" size={18} />
                </button>
              </div>
            </form>
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
                  <h2>{t.unavailable}</h2>
                </div>
              ) : state === "unavailable" ? (
                <div className="v2-preview-lookup-feedback is-error">
                  <WarningCircle aria-hidden="true" size={28} />
                  <h2>{t.unavailable}</h2>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
