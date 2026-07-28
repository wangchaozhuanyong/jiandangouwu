import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  Check,
  Clock,
  CreditCard,
  Fingerprint,
  Headset,
  LockKey,
  Receipt,
  ShieldCheck,
  WarningCircle,
  X,
} from "@phosphor-icons/react";

const go = (path) => {
  window.location.hash = path;
};

const paymentStates = [
  "select",
  "redirect",
  "processing",
  "challenge",
  "success",
  "failed",
  "cancelled",
  "expired",
  "duplicate",
  "amount",
];

const labels = {
  zh: {
    select: "选择方式",
    redirect: "安全跳转",
    processing: "处理中",
    challenge: "额外验证",
    success: "支付成功",
    failed: "支付失败",
    cancelled: "已取消",
    expired: "已超时",
    duplicate: "重复支付",
    amount: "金额已变化",
  },
  en: {
    select: "Select method",
    redirect: "Secure redirect",
    processing: "Processing",
    challenge: "Extra verification",
    success: "Payment complete",
    failed: "Payment failed",
    cancelled: "Cancelled",
    expired: "Expired",
    duplicate: "Duplicate payment",
    amount: "Amount changed",
  },
};

function PaymentStateVisual({ state, lang, setState }) {
  const zh = lang === "zh";
  if (state === "select") {
    return (
      <>
        <div className="payment-demo-heading"><small>{zh ? "未来在线支付" : "FUTURE ONLINE PAYMENT"}</small><h1>{zh ? "选择托管支付方式" : "Choose a hosted payment method"}</h1><p>{zh ? "银行卡和钱包信息只在合规支付提供商页面输入，云桥不会收集卡号。" : "Card and wallet details are entered only on a compliant provider page. CloudBridge never collects card numbers."}</p></div>
        <div className="hosted-method-list">
          <button onClick={() => setState("redirect")}><span><CreditCard size={23} /></span><div><strong>{zh ? "银行卡与数字钱包" : "Cards and digital wallets"}</strong><small>Stripe Checkout · USD 21.04</small></div><ArrowRight size={18} /></button>
          <button onClick={() => setState("redirect")}><span><Receipt size={23} /></span><div><strong>PayPal</strong><small>{zh ? "跳转到 PayPal 完成付款" : "Continue on PayPal to complete payment"}</small></div><ArrowRight size={18} /></button>
        </div>
        <div className="payment-trust-note"><ShieldCheck size={20} /><span>{zh ? "支付页面由第三方提供商托管。返回后仍以服务端 Webhook 确认结果。" : "The provider hosts the payment page. The final result is still confirmed by a server-side webhook."}</span></div>
      </>
    );
  }

  const content = {
    redirect: [LockKey, zh ? "正在前往安全支付页" : "Opening the secure payment page", zh ? "请确认地址栏中的支付提供商域名。不要在聊天中发送银行卡或验证码。" : "Confirm the payment-provider domain in the address bar. Never send card details or codes in chat.", zh ? "模拟跳转完成" : "Simulate return", "processing"],
    processing: [ArrowsClockwise, zh ? "正在确认支付结果" : "Confirming the payment result", zh ? "请勿重复付款。页面会等待支付提供商的服务器通知。" : "Do not pay again. This page is waiting for the provider's server notification.", zh ? "模拟支付成功" : "Simulate success", "success"],
    challenge: [Fingerprint, zh ? "需要额外身份验证" : "Additional verification required", zh ? "验证过程由发卡行或钱包提供商完成，云桥不会读取验证码。" : "Your bank or wallet provider completes the challenge. CloudBridge never reads the verification code.", zh ? "返回继续确认" : "Return to confirmation", "processing"],
    success: [Check, zh ? "付款已经确认" : "Payment is confirmed", zh ? "订单已进入交付流程。支付参考号可用于客服核对。" : "The order has entered fulfilment. The payment reference can be used for support.", zh ? "查看订单凭证" : "View order receipt", "select"],
    failed: [WarningCircle, zh ? "支付未完成" : "Payment was not completed", zh ? "没有确认扣款。你可以更换方式或稍后重试。" : "No charge was confirmed. Choose another method or retry later.", zh ? "更换支付方式" : "Choose another method", "select"],
    cancelled: [X, zh ? "你已取消支付" : "Payment was cancelled", zh ? "订单仍保留为待付款，系统不会自动重复扣款。" : "The order remains awaiting payment and will not be charged automatically.", zh ? "返回支付方式" : "Return to methods", "select"],
    expired: [Clock, zh ? "支付会话已超时" : "Payment session expired", zh ? "为保护价格与库存，请刷新订单金额后重新创建支付会话。" : "Refresh the order amount and create a new payment session to protect price and inventory.", zh ? "刷新订单" : "Refresh order", "amount"],
    duplicate: [ShieldCheck, zh ? "检测到已有付款" : "An existing payment was detected", zh ? "系统已阻止重复付款，并正在核对原始交易。" : "A duplicate charge was prevented while the original transaction is reconciled.", zh ? "返回订单凭证" : "Return to receipt", "select"],
    amount: [ArrowsClockwise, zh ? "订单金额已经变化" : "The order amount changed", zh ? "汇率或库存保留已更新。请确认新金额后再进入支付。" : "The exchange rate or inventory reservation changed. Confirm the new amount before continuing.", zh ? "确认新金额" : "Confirm new amount", "select"],
  };
  const [Glyph, title, copy, action, next] = content[state] || content.failed;
  return (
    <div className={`payment-state-card is-${state}`}>
      <span className="payment-state-icon"><Glyph size={32} weight={state === "success" ? "bold" : "regular"} /></span>
      <small>{labels[lang][state]}</small>
      <h1>{title}</h1>
      <p>{copy}</p>
      {state === "success" && <div className="payment-reference"><span>{zh ? "支付参考号" : "Payment reference"}</span><strong>PAY-CB-260727-7D8K</strong></div>}
      <button className="bridge-button" onClick={() => setState(next)}><span>{action}</span><i><ArrowRight size={17} /></i></button>
    </div>
  );
}

export function PaymentDemoPage({ lang }) {
  const [state, setState] = useState("select");
  const zh = lang === "zh";
  return (
    <main className="payment-demo-page client-main">
      <button className="back-link" onClick={() => go("/home")}><ArrowLeft size={17} />{zh ? "返回客户端" : "Back to storefront"}</button>
      <section className="payment-demo-banner">
        <span><ShieldCheck size={20} /></span>
        <div><strong>{zh ? "设计状态预览" : "DESIGN-STATE PREVIEW"}</strong><p>{zh ? "当前网站未启用在线支付，下面只用于确认未来完整界面与状态。" : "Online payment is currently disabled. This preview documents the complete future flow and states."}</p></div>
        <button onClick={() => go("/admin/payments")}>{zh ? "返回支付后台" : "Back to payment admin"}</button>
      </section>
      <div className="payment-demo-layout">
        <aside className="payment-demo-order">
          <small>{zh ? "订单摘要" : "ORDER SUMMARY"}</small>
          <div><img src="/assets/product-codex.webp" alt="" /><span><strong>OpenAI Codex Professional</strong><small>{zh ? "人工服务交付" : "Human-assisted delivery"}</small></span></div>
          <dl><div><dt>{zh ? "订单号" : "Order"}</dt><dd>CB-260727-8K3P9M</dd></div><div><dt>{zh ? "支付币种" : "Currency"}</dt><dd>USD</dd></div><div><dt>{zh ? "应付金额" : "Amount due"}</dt><dd>USD 21.04</dd></div><div><dt>{zh ? "库存保留" : "Reservation"}</dt><dd>24:18</dd></div></dl>
          <div className="payment-scope"><LockKey size={18} /><span>{zh ? "本页不包含银行卡输入字段" : "No card-entry fields exist on this page"}</span></div>
        </aside>
        <section className="payment-demo-stage">
          <div className="payment-state-tabs" role="tablist" aria-label={zh ? "支付状态" : "Payment states"}>
            {paymentStates.map((id) => <button type="button" role="tab" aria-selected={state === id} className={state === id ? "is-active" : ""} onClick={() => setState(id)} key={id}>{labels[lang][id]}</button>)}
          </div>
          <PaymentStateVisual state={state} lang={lang} setState={setState} />
        </section>
      </div>
    </main>
  );
}

const storefrontStates = {
  paused: {
    icon: Clock,
    title: { zh: "当前暂停接收新订单", en: "New orders are temporarily paused" },
    copy: { zh: "商品与政策仍可浏览，客服入口保持可用。", en: "Products and policies remain available, and support stays open." },
  },
  inventory: {
    icon: WarningCircle,
    title: { zh: "库存刚刚发生变化", en: "Inventory just changed" },
    copy: { zh: "提交前的库存已经释放，请返回商品页选择其他服务。", en: "The reserved inventory was released. Return to the product page to choose another service." },
  },
  rate: {
    icon: ArrowsClockwise,
    title: { zh: "价格需要重新确认", en: "The price needs confirmation" },
    copy: { zh: "当前汇率已经过期。刷新后才能提交订单。", en: "The displayed exchange rate expired. Refresh before submitting the order." },
  },
  offline: {
    icon: WarningCircle,
    title: { zh: "网络连接已经中断", en: "The connection was interrupted" },
    copy: { zh: "没有创建重复订单。恢复网络后可以安全重试。", en: "No duplicate order was created. Retry safely when the connection returns." },
  },
  risk: {
    icon: ShieldCheck,
    title: { zh: "本次请求需要人工确认", en: "This request needs manual verification" },
    copy: { zh: "系统没有收集额外身份资料。请通过客服完成订单核对。", en: "No additional identity data was collected. Continue with support for order verification." },
  },
};

export function StorefrontStatesPage({ lang }) {
  const [state, setState] = useState("paused");
  const current = storefrontStates[state];
  const Glyph = current.icon;
  const zh = lang === "zh";
  return (
    <main className="storefront-state-page client-main">
      <button className="back-link" onClick={() => go("/home")}><ArrowLeft size={17} />{zh ? "返回首页" : "Back home"}</button>
      <div className="storefront-state-tabs">
        {Object.keys(storefrontStates).map((id) => <button className={state === id ? "is-active" : ""} onClick={() => setState(id)} key={id}>{id === "paused" ? (zh ? "暂停接单" : "Ordering paused") : id === "inventory" ? (zh ? "库存变化" : "Inventory") : id === "rate" ? (zh ? "汇率失效" : "Expired rate") : id === "offline" ? (zh ? "网络中断" : "Offline") : (zh ? "风控确认" : "Risk review")}</button>)}
      </div>
      <section className="storefront-state-card">
        <span><Glyph size={34} /></span>
        <small>{zh ? "云桥 / 服务状态" : "CLOUDBRIDGE / SERVICE STATE"}</small>
        <h1>{current.title[lang]}</h1>
        <p>{current.copy[lang]}</p>
        <div><button className="bridge-button" onClick={() => go("/home")}><span>{zh ? "返回商品列表" : "Back to products"}</span><i><ArrowRight size={17} /></i></button><button className="outline-button"><Headset size={18} />{zh ? "联系客服" : "Contact support"}</button></div>
      </section>
    </main>
  );
}
