import { notFound } from "next/navigation";
import { copy, isLocale } from "../../../../lib/copy";

const policies = {
  terms: {
    zh: {
      title: "服务条款",
      intro: "本页面说明云桥手工确认订单的基本规则。",
      sections: [
        [
          "订单确认",
          "提交订单并不代表付款或服务已自动完成。客服会通过你选择的单一联系方式核对商品、价格和交付条件。",
        ],
        [
          "价格与库存",
          "页面价格和库存以提交时的服务器校验结果为准。汇率变化、库存不足或商品状态变化时，系统会要求重新确认。",
        ],
        [
          "交付与退款",
          "具体交付时效、取消与退款条件会在人工沟通中明确；任何付款都应在确认收款对象后进行。",
        ],
      ],
    },
    en: {
      title: "Terms of service",
      intro:
        "These terms describe the fundamentals of CloudBridge manual-confirmation orders.",
      sections: [
        [
          "Order confirmation",
          "Submitting an order does not complete payment or fulfilment. Support confirms the product, price and delivery terms through the single channel you choose.",
        ],
        [
          "Price and availability",
          "The server validates price and stock at submission. A new confirmation is required if rates, stock or product availability changes.",
        ],
        [
          "Delivery and refunds",
          "Delivery timing, cancellation and refund terms are confirmed during the support conversation. Verify the recipient before making any payment.",
        ],
      ],
    },
  },
  privacy: {
    zh: {
      title: "隐私说明",
      intro: "我们按完成订单所需的最小范围处理信息。",
      sections: [
        [
          "收集的信息",
          "订单仅要求商品、币种、联系方式与已接受的政策版本，不要求创建商城账号。",
        ],
        [
          "保护方式",
          "联系方式在服务端加密保存；运营列表默认只显示脱敏值，查看原文需要单独权限并写入审计记录。",
        ],
        [
          "公开查询",
          "本系统不提供可枚举的公开订单查询入口，订单进度由客服在已确认的联系渠道中同步。",
        ],
      ],
    },
    en: {
      title: "Privacy notice",
      intro:
        "We process only the minimum information needed to handle an order.",
      sections: [
        [
          "Information collected",
          "An order contains the product, currency, contact detail and accepted policy version. A storefront account is not required.",
        ],
        [
          "Protection",
          "Contact details are encrypted on the server. Operations views show masked values by default; revealing a value requires a dedicated permission and audit record.",
        ],
        [
          "No public lookup",
          "There is no enumerable public order-lookup endpoint. Support shares progress through the verified contact channel.",
        ],
      ],
    },
  },
} as const;

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ locale: string; policy: string }>;
}) {
  const { locale, policy } = await params;
  if (!isLocale(locale) || !(policy in policies)) notFound();
  const content = policies[policy as keyof typeof policies][locale];
  const t = copy[locale];
  return (
    <main className="policy-page v2-page-frame v2-page-frame--reading">
      <a className="back-link" href={`/${locale}`}>
        ← {t.backHome}
      </a>
      <p className="section-index">{t.policyLabel}</p>
      <h1>{content.title}</h1>
      <p className="policy-intro">{content.intro}</p>
      <div className="policy-grid">
        {content.sections.map(([title, body], index) => (
          <article className="numbered-policy" key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
