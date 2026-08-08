"use client";

import type { Locale } from "@cloudbridge/contracts";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Cube,
  MagnifyingGlass,
  Minus,
  Plus,
  ShoppingBagOpen,
  Sparkle,
  Trash,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { V3_COMMERCE_PRODUCTS, useV3Commerce } from "./v3-commerce-layer";
import { V3FinalShell } from "./v3-final-shell";

type Product = (typeof V3_COMMERCE_PRODUCTS)[number];

const descriptions: Record<string, { zh: string; en: string }> = {
  "chatgpt-plus-assisted": {
    zh: "适合持续使用高级模型、文件分析与多工具工作流的个人用户。",
    en: "For people who need ongoing access to advanced models, file analysis, and multi-tool workflows.",
  },
  "claude-pro-assisted": {
    zh: "适合长文本、研究、代码分析与高上下文工作流。",
    en: "Built for long-form research, code analysis, and high-context workflows.",
  },
  "gemini-advanced-assisted": {
    zh: "适合 Google 生态、多模态任务与日常生产力场景。",
    en: "For Google ecosystem, multimodal work, and everyday productivity.",
  },
  "cursor-pro-assisted": {
    zh: "面向高频 AI 编程、代码库理解与开发协作的工作台。",
    en: "A workspace for high-frequency AI coding, codebase understanding, and developer collaboration.",
  },
  "codex-access": {
    zh: "面向终端、代码仓库与自动化开发任务的 AI 编程入口。",
    en: "AI coding access for terminal, repositories, and automated developer tasks.",
  },
  "midjourney-assisted": {
    zh: "适合概念视觉、创意探索与高质量图像生成工作流。",
    en: "For concept visuals, creative exploration, and high-quality image generation workflows.",
  },
};

const copy = {
  zh: {
    back: "返回服务",
    available: "可办理",
    from: "参考价格",
    add: "加入购物车",
    reviewCart: "查看本地购物车",
    month: "1 个月",
    quarter: "3 个月",
    year: "12 个月",
    standard: "标准",
    recommended: "推荐",
    value: "更长期",
    fulfillment: "办理方式",
    manual: "人工确认",
    response: "预计响应",
    minutes: "约 10–30 分钟",
    boundary: "V3 仅演示购买决策流程，不创建真实订单、支付或服务器记录。",
    detailTitle: "购买信息应该像控制台，而不是参数墙。",
    detailBody: "价格、周期、办理方式和真实性边界集中在同一决策区；视觉内容与购买操作分离，减少滚动中的信息丢失。",
    decision: "清晰决策",
    local: "本地状态",
    safe: "真实性边界",
    choosePlatform: "选择你的 AI 平台",
    chooseBody: "按工作流筛选服务，而不是在一面商品墙里寻找。",
    all: "全部",
    developer: "开发者",
    creative: "创意",
    curated: "精选服务",
    curatedBody: "把高频服务压缩到更少的信息噪音和更明确的下一步。",
    infra: "AI 基础设施",
    infraBody: "把额度、模型路由与团队使用方式拆成更清晰的商业层级。",
    illustrative: "示意状态 · 非实时监控",
    plans: "方案矩阵",
    routing: "路由倍率",
    explore: "查看方案",
    routeTable: "模型路由视图",
    skillsTitle: "Developer Skill Marketplace",
    skillsBody: "不是普通商品列表，而是围绕真实 AI 工作流组织的能力模块。",
    searchSkills: "搜索 Skill、用途或工作流",
    copy: "复制",
    copied: "已复制",
    cart: "购物车",
    localCart: "浏览器本地购物车",
    clear: "清空",
    empty: "还没有添加服务",
    emptyBody: "从 AI 服务目录加入一个项目，体验完整的 V3 本地购物车流程。",
    browse: "浏览服务",
    subtotal: "小计",
    itemCount: "项目数量",
    previewCheckout: "预览环境不开放结算",
    cartNotice: "购物车仅保存在当前浏览器预览状态，不会同步到服务器。",
  },
  en: {
    back: "Back to services",
    available: "Available",
    from: "Reference price",
    add: "Add to cart",
    reviewCart: "Review local cart",
    month: "1 month",
    quarter: "3 months",
    year: "12 months",
    standard: "Standard",
    recommended: "Recommended",
    value: "Longer term",
    fulfillment: "Fulfillment",
    manual: "Human confirmation",
    response: "Response",
    minutes: "About 10–30 minutes",
    boundary: "V3 demonstrates purchase decisions only. No real order, payment, or server record is created.",
    detailTitle: "A purchase console, not a parameter wall.",
    detailBody: "Price, term, fulfillment, and truth boundaries stay in one decision area while visual content remains separate from purchase actions.",
    decision: "Clear decisions",
    local: "Local state",
    safe: "Truth boundary",
    choosePlatform: "Choose your AI platform",
    chooseBody: "Filter by workflow instead of hunting through a wall of products.",
    all: "All",
    developer: "Developer",
    creative: "Creative",
    curated: "Curated services",
    curatedBody: "High-frequency services with less visual noise and a clearer next action.",
    infra: "AI infrastructure",
    infraBody: "Usage, model routing, and team access organized into clearer commercial layers.",
    illustrative: "Illustrative status · Not live monitoring",
    plans: "Plan matrix",
    routing: "Routing multiplier",
    explore: "Explore plan",
    routeTable: "Model routing view",
    skillsTitle: "Developer Skill Marketplace",
    skillsBody: "Not a generic catalog — capability modules organized around real AI workflows.",
    searchSkills: "Search skills, use cases, or workflows",
    copy: "Copy",
    copied: "Copied",
    cart: "Cart",
    localCart: "Browser-local cart",
    clear: "Clear",
    empty: "No services yet",
    emptyBody: "Add a service from the AI catalog to experience the complete local V3 cart flow.",
    browse: "Browse services",
    subtotal: "Subtotal",
    itemCount: "Items",
    previewCheckout: "Checkout is disabled in preview",
    cartNotice: "Cart state is stored only in this browser preview and is never synchronized to a server.",
  },
} as const;

function formatPrice(locale: Locale, value: number) {
  return locale === "zh" ? `¥${value}` : `$${value}`;
}

function description(product: Product, locale: Locale) {
  return descriptions[product.slug]?.[locale] ?? product.kind;
}

export function V3ProductDetailFinal({ locale, slug }: { locale: Locale; slug: string }) {
  const t = copy[locale];
  const base = `/preview/v3/${locale}`;
  const { add, openCart } = useV3Commerce();
  const [plan, setPlan] = useState(1);
  const product = V3_COMMERCE_PRODUCTS.find((item) => item.slug === slug);
  const plans = [
    { label: t.month, note: t.standard },
    { label: t.quarter, note: t.recommended },
    { label: t.year, note: t.value },
  ];

  if (!product) {
    return (
      <V3FinalShell locale={locale}>
        <section className="v3-final-missing">
          <span>PRODUCT / UNKNOWN</span>
          <h1>{locale === "zh" ? "这个预览商品不存在。" : "This preview product does not exist."}</h1>
          <Link href={`${base}/ai-recharge`}>{t.back}<ArrowRight size={17} /></Link>
        </section>
        <FinalPageStyles />
      </V3FinalShell>
    );
  }

  return (
    <V3FinalShell locale={locale}>
      <section className="v3-final-detail">
        <div className="v3-final-detail-media">
          <Link className="v3-final-back" href={`${base}/ai-recharge`}><ArrowLeft size={17} />{t.back}</Link>
          <div className="v3-final-art">
            <div className="v3-final-art-label"><span>{product.kind}</span><small>V3 / CURATED</small></div>
            <Image src={product.image} alt="" fill sizes="(max-width: 900px) 92vw, 58vw" priority unoptimized />
            <div className="v3-final-art-fade" />
          </div>
          <div className="v3-final-spec-row">
            <div><span>01</span><strong>{t.decision}</strong></div>
            <div><span>02</span><strong>{t.local}</strong></div>
            <div><span>03</span><strong>{t.safe}</strong></div>
          </div>
        </div>

        <aside className="v3-final-console">
          <div className="v3-final-state"><i />{t.available}<span>PREVIEW</span></div>
          <div className="v3-final-product-kicker">{product.kind} · CLOUD BRIDGE</div>
          <h1>{product.name}</h1>
          <p className="v3-final-product-desc">{description(product, locale)}</p>

          <div className="v3-final-price-block">
            <span>{t.from}</span>
            <strong>{formatPrice(locale, product.price[locale])}</strong>
            <small>/ {t.month}</small>
          </div>

          <div className="v3-final-plan-label">TERM / 周期</div>
          <div className="v3-final-plan-grid">
            {plans.map((item, index) => (
              <button className={plan === index ? "active" : ""} key={item.label} onClick={() => setPlan(index)} type="button">
                <span>{item.label}</span>
                <small>{item.note}</small>
              </button>
            ))}
          </div>

          <div className="v3-final-facts">
            <div><span>{t.fulfillment}</span><strong>{t.manual}</strong></div>
            <div><span>{t.response}</span><strong>{t.minutes}</strong></div>
          </div>

          <button className="v3-final-primary" onClick={() => add(product.slug)} type="button">
            <ShoppingBagOpen size={18} />{t.add}
          </button>
          <button className="v3-final-secondary" onClick={openCart} type="button">
            {t.reviewCart}<ArrowRight size={18} />
          </button>

          <div className="v3-final-boundary"><Sparkle size={15} />{t.boundary}</div>
        </aside>
      </section>

      <section className="v3-final-notes">
        <span>01 / PURCHASE CONSOLE</span>
        <div>
          <h2>{t.detailTitle}</h2>
          <p>{t.detailBody}</p>
        </div>
        <div className="v3-final-note-grid">
          {[t.decision, t.local, t.safe].map((item, index) => (
            <article key={item}><span>0{index + 1}</span><strong>{item}</strong><p>{index === 0 ? (locale === "zh" ? "价格、周期和下一步集中呈现。" : "Price, term, and next action stay together.") : index === 1 ? (locale === "zh" ? "购物行为只保存在浏览器。" : "Commerce state stays in the browser only.") : t.boundary}</p></article>
          ))}
        </div>
      </section>
      <FinalPageStyles />
    </V3FinalShell>
  );
}

export function V3AiRechargeFinal({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const base = `/preview/v3/${locale}`;
  const [active, setActive] = useState("ALL");
  const filters = ["ALL", "ChatGPT", "Claude", "Gemini", "Developer", "Creative"];
  const visible = useMemo(() => V3_COMMERCE_PRODUCTS.filter((product) => {
    if (active === "ALL") return true;
    if (active === "Developer" || active === "Creative") return product.kind === active;
    return product.name.includes(active);
  }), [active]);

  return (
    <V3FinalShell locale={locale}>
      <section className="v3-final-pagehero">
        <div>
          <span>AI RECHARGE / 01</span>
          <h1>{t.choosePlatform}</h1>
          <p>{t.chooseBody}</p>
        </div>
        <div className="v3-final-hero-metric">
          <small>CURATED STACK</small>
          <strong>06</strong>
          <span>{locale === "zh" ? "精选数字服务" : "curated digital services"}</span>
        </div>
      </section>

      <div className="v3-final-tabs" role="tablist" aria-label={t.choosePlatform}>
        {filters.map((filter) => (
          <button aria-selected={active === filter} className={active === filter ? "active" : ""} key={filter} onClick={() => setActive(filter)} role="tab" type="button">
            {filter === "ALL" ? t.all : filter === "Developer" ? t.developer : filter === "Creative" ? t.creative : filter}
          </button>
        ))}
      </div>

      <section className="v3-final-catalog">
        <div className="v3-final-section-head">
          <div><span>02 / CURATED</span><h2>{t.curated}</h2></div>
          <p>{t.curatedBody}</p>
        </div>
        <div className="v3-final-product-grid">
          {visible.map((product) => (
            <Link className="v3-final-product-card" href={`${base}/products/${product.slug}`} key={product.slug}>
              <div className="v3-final-product-image">
                <Image src={product.image} alt="" fill sizes="(max-width:760px) 92vw, 30vw" unoptimized />
                <span>{product.kind}</span>
              </div>
              <div className="v3-final-product-title"><h3>{product.name}</h3><ArrowRight size={18} /></div>
              <p>{description(product, locale)}</p>
              <footer><small>{t.from}</small><strong>{formatPrice(locale, product.price[locale])}</strong></footer>
            </Link>
          ))}
        </div>
      </section>
      <FinalPageStyles />
    </V3FinalShell>
  );
}

export function V3TransitFinal({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const plans = [
    { name: "STARTER", price: "$20", multiplier: "1×", desc: locale === "zh" ? "个人路由与轻量试用" : "Personal routing and lightweight evaluation" },
    { name: "PRO", price: "$100", multiplier: "0.85×", desc: locale === "zh" ? "优先多模型路由与更高额度" : "Priority multimodel routing and higher usage" },
    { name: "TEAM", price: "$500", multiplier: "0.72×", desc: locale === "zh" ? "团队共享工作区与统一管理" : "Shared team workspace and centralized management" },
  ];
  const routes = [
    ["Claude", "Anthropic", "Illustrative"],
    ["GPT", "OpenAI", "Illustrative"],
    ["Gemini", "Google", "Illustrative"],
    ["GLM", "Zhipu", "Illustrative"],
  ];

  return (
    <V3FinalShell locale={locale}>
      <section className="v3-final-infra-hero">
        <div>
          <span>API / TRANSIT / 02</span>
          <h1>{t.infra}</h1>
          <p>{t.infraBody}</p>
          <small>{t.illustrative}</small>
        </div>
        <div className="v3-final-status-card">
          {routes.slice(0, 4).map(([name]) => <div key={name}><span>{name}</span><i /><strong>Operational*</strong></div>)}
          <footer><span>PREVIEW SIGNAL</span><strong>99.99%*</strong></footer>
        </div>
      </section>

      <section className="v3-final-plan-section">
        <div className="v3-final-section-head">
          <div><span>03 / MATRIX</span><h2>{t.plans}</h2></div>
          <p>{t.boundary}</p>
        </div>
        <div className="v3-final-plan-cards">
          {plans.map((plan, index) => (
            <article className={index === 1 ? "featured" : ""} key={plan.name}>
              <span>{index === 1 ? t.recommended : "PLAN"}</span>
              <h3>{plan.name}</h3>
              <strong>{plan.price}</strong>
              <p>{plan.desc}</p>
              <div><small>{t.routing}</small><b>{plan.multiplier}</b></div>
              <button type="button">{t.explore}<ArrowRight size={17} /></button>
            </article>
          ))}
        </div>
      </section>

      <section className="v3-final-route-table">
        <div className="v3-final-section-head compact">
          <div><span>04 / ROUTES</span><h2>{t.routeTable}</h2></div>
          <p>{t.illustrative}</p>
        </div>
        <div className="v3-final-route-grid">
          {routes.map(([model, provider, state]) => (
            <div key={model}><strong>{model}</strong><span>{provider}</span><small><i />{state}</small></div>
          ))}
        </div>
      </section>
      <FinalPageStyles />
    </V3FinalShell>
  );
}

const skills = [
  { name: "frontend-design", category: "DESIGN", desc: { zh: "高质量前端界面、设计系统与交互实现。", en: "High-quality frontend interfaces, design systems, and interaction implementation." } },
  { name: "automation", category: "WORKFLOW", desc: { zh: "把重复流程组织成更可靠的自动化步骤。", en: "Turn repetitive processes into reliable automated steps." } },
  { name: "research", category: "KNOWLEDGE", desc: { zh: "面向资料检索、比较与结构化研究。", en: "For retrieval, comparison, and structured research." } },
  { name: "growth", category: "GROWTH", desc: { zh: "增长实验、内容分析与渠道工作流。", en: "Growth experiments, content analysis, and channel workflows." } },
  { name: "agents", category: "AGENTS", desc: { zh: "构建多步骤智能代理与工具编排。", en: "Build multi-step agents and tool orchestration." } },
  { name: "slides", category: "CREATIVE", desc: { zh: "从结构、叙事到演示文稿生产。", en: "From structure and narrative to presentation production." } },
];

export function V3SkillsFinal({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState("");
  const visible = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return skills;
    return skills.filter((skill) => `${skill.name} ${skill.category} ${skill.desc[locale]}`.toLowerCase().includes(value));
  }, [locale, query]);

  const copyInstall = (name: string) => {
    navigator.clipboard?.writeText(`npx skills add ${name}`);
    setCopied(name);
    window.setTimeout(() => setCopied((value) => value === name ? "" : value), 1600);
  };

  return (
    <V3FinalShell locale={locale}>
      <section className="v3-final-pagehero skills">
        <div>
          <span>SKILLS / 04</span>
          <h1>{t.skillsTitle}</h1>
          <p>{t.skillsBody}</p>
        </div>
        <label className="v3-final-skill-search">
          <MagnifyingGlass size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchSkills} />
          <kbd>{visible.length}</kbd>
        </label>
      </section>

      <section className="v3-final-skill-list">
        {visible.map((skill, index) => (
          <article key={skill.name}>
            <span className="v3-final-skill-index">0{index + 1}</span>
            <div className="v3-final-skill-copy"><small>{skill.category}</small><h3>{skill.name}</h3><p>{skill.desc[locale]}</p></div>
            <code>npx skills add {skill.name}</code>
            <button onClick={() => copyInstall(skill.name)} type="button">
              {copied === skill.name ? <Check size={17} /> : <Copy size={17} />}
              {copied === skill.name ? t.copied : t.copy}
            </button>
          </article>
        ))}
        {!visible.length && <div className="v3-final-skill-empty"><MagnifyingGlass size={26} /><strong>{locale === "zh" ? "没有匹配的 Skill" : "No matching Skill"}</strong></div>}
      </section>
      <FinalPageStyles />
    </V3FinalShell>
  );
}

export function V3CartFinal({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const base = `/preview/v3/${locale}`;
  const { clear, count, items, remove, setQuantity, total } = useV3Commerce();

  return (
    <V3FinalShell locale={locale}>
      <section className="v3-final-cart-layout">
        <div className="v3-final-cart-main">
          <div className="v3-final-cart-heading">
            <div><span>LOCAL CART / V3</span><h1>{t.cart}</h1><p>{t.localCart}</p></div>
            {!!items.length && <button onClick={clear} type="button"><Trash size={15} />{t.clear}</button>}
          </div>

          {!items.length ? (
            <div className="v3-final-empty-cart">
              <span><Cube size={34} /></span>
              <h2>{t.empty}</h2>
              <p>{t.emptyBody}</p>
              <Link href={`${base}/ai-recharge`}>{t.browse}<ArrowRight size={17} /></Link>
            </div>
          ) : (
            <div className="v3-final-cart-items">
              {items.map(({ product, quantity }) => (
                <article key={product.slug}>
                  <Link className="v3-final-cart-image" href={`${base}/products/${product.slug}`}>
                    <Image src={product.image} alt="" fill sizes="92px" unoptimized />
                  </Link>
                  <div className="v3-final-cart-copy">
                    <small>{product.kind}</small>
                    <Link href={`${base}/products/${product.slug}`}><h3>{product.name}</h3></Link>
                    <p>{description(product, locale)}</p>
                  </div>
                  <div className="v3-final-quantity" aria-label={`${product.name} quantity`}>
                    <button onClick={() => setQuantity(product.slug, quantity - 1)} type="button" aria-label="Decrease"><Minus size={14} /></button>
                    <strong>{quantity}</strong>
                    <button onClick={() => setQuantity(product.slug, quantity + 1)} type="button" aria-label="Increase"><Plus size={14} /></button>
                  </div>
                  <strong className="v3-final-line-price">{formatPrice(locale, product.price[locale] * quantity)}</strong>
                  <button className="v3-final-remove" onClick={() => remove(product.slug)} type="button" aria-label={`Remove ${product.name}`}><Trash size={15} /></button>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="v3-final-summary">
          <span>SUMMARY / PREVIEW</span>
          <div className="v3-final-summary-row"><small>{t.itemCount}</small><strong>{count}</strong></div>
          <div className="v3-final-summary-total"><small>{t.subtotal}</small><strong>{formatPrice(locale, total)}</strong></div>
          <button disabled type="button">{t.previewCheckout}</button>
          <p>{t.cartNotice}</p>
          <Link href={`${base}/ai-recharge`}>{t.browse}<ArrowRight size={16} /></Link>
        </aside>
      </section>
      <FinalPageStyles />
    </V3FinalShell>
  );
}

function FinalPageStyles() {
  return (
    <style jsx global>{`
      .v3-final-detail,
      .v3-final-pagehero,
      .v3-final-infra-hero,
      .v3-final-catalog,
      .v3-final-plan-section,
      .v3-final-route-table,
      .v3-final-skill-list,
      .v3-final-cart-layout,
      .v3-final-notes,
      .v3-final-missing {
        position: relative;
        z-index: 2;
      }
      .v3-final-detail {
        width: min(1360px, calc(100% - 72px));
        margin: 0 auto;
        padding: 58px 0 118px;
        display: grid;
        grid-template-columns: minmax(0, 1.16fr) minmax(380px, .84fr);
        gap: clamp(48px, 6vw, 92px);
        align-items: start;
      }
      .v3-final-detail-media { min-width: 0; }
      .v3-final-back {
        height: 38px;
        margin-bottom: 18px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: #8f96a5;
        font-size: 11px;
      }
      .v3-final-back:hover { color: #fff; }
      .v3-final-art {
        min-height: 560px;
        aspect-ratio: 1.12;
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,.09);
        border-radius: 26px;
        background: #0c0e13;
      }
      .v3-final-art img { object-fit: cover; transform: scale(1.002); }
      .v3-final-art-label {
        position: absolute;
        left: 20px;
        right: 20px;
        top: 18px;
        z-index: 3;
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: #b0b5c0;
        font-size: 9px;
        letter-spacing: .13em;
        text-transform: uppercase;
      }
      .v3-final-art-label span {
        padding: 7px 9px;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 999px;
        background: rgba(5,6,9,.56);
        backdrop-filter: blur(12px);
      }
      .v3-final-art-label small { color: #757c8a; }
      .v3-final-art-fade {
        position: absolute;
        inset: auto 0 0;
        height: 32%;
        background: linear-gradient(to top, rgba(5,6,9,.64), transparent);
        pointer-events: none;
      }
      .v3-final-spec-row {
        margin-top: 14px;
        border-top: 1px solid rgba(255,255,255,.08);
        border-bottom: 1px solid rgba(255,255,255,.08);
        display: grid;
        grid-template-columns: repeat(3, 1fr);
      }
      .v3-final-spec-row > div {
        min-height: 70px;
        padding: 0 18px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-right: 1px solid rgba(255,255,255,.08);
      }
      .v3-final-spec-row > div:last-child { border-right: 0; }
      .v3-final-spec-row span { color: #626a78; font-size: 9px; }
      .v3-final-spec-row strong { color: #aeb4bf; font-size: 11px; font-weight: 550; }
      .v3-final-console {
        position: sticky;
        top: 104px;
        padding-top: 46px;
      }
      .v3-final-state {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: #aeb4bf;
        font-size: 10px;
        letter-spacing: .06em;
      }
      .v3-final-state i { width: 6px; height: 6px; border-radius: 50%; background: #68dfa9; box-shadow: 0 0 14px rgba(104,223,169,.44); }
      .v3-final-state span { margin-left: 5px; color: #686f7d; }
      .v3-final-product-kicker { margin-top: 28px; color: #717887; font-size: 9px; letter-spacing: .15em; }
      .v3-final-console h1 {
        margin: 10px 0 15px;
        font-size: clamp(44px, 4.3vw, 66px);
        line-height: .98;
        letter-spacing: -.055em;
        font-weight: 650;
      }
      .v3-final-product-desc { max-width: 520px; margin: 0; color: #939aa8; font-size: 14px; line-height: 1.75; }
      .v3-final-price-block {
        margin: 31px 0 28px;
        padding: 22px 0;
        border-top: 1px solid rgba(255,255,255,.08);
        border-bottom: 1px solid rgba(255,255,255,.08);
        display: flex;
        align-items: baseline;
        gap: 9px;
      }
      .v3-final-price-block > span { margin-right: auto; color: #747b89; font-size: 10px; }
      .v3-final-price-block strong { font-size: 31px; letter-spacing: -.04em; }
      .v3-final-price-block small { color: #747b89; font-size: 10px; }
      .v3-final-plan-label { margin-bottom: 10px; color: #656c7a; font-size: 9px; letter-spacing: .12em; }
      .v3-final-plan-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .v3-final-plan-grid button {
        min-height: 76px;
        padding: 12px;
        border: 1px solid rgba(255,255,255,.085);
        border-radius: 13px;
        background: rgba(255,255,255,.025);
        color: #dfe2e8;
        cursor: pointer;
        text-align: left;
      }
      .v3-final-plan-grid button span,
      .v3-final-plan-grid button small { display: block; }
      .v3-final-plan-grid button span { font-size: 11px; font-weight: 650; }
      .v3-final-plan-grid button small { margin-top: 7px; color: #69707e; font-size: 9px; }
      .v3-final-plan-grid button.active {
        border-color: rgba(157,143,255,.48);
        background: radial-gradient(circle at 15% 0, rgba(119,96,255,.16), transparent 58%), rgba(255,255,255,.045);
      }
      .v3-final-plan-grid button.active small { color: #a69cf8; }
      .v3-final-facts { margin: 18px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .v3-final-facts > div { padding: 15px; border: 1px solid rgba(255,255,255,.075); border-radius: 12px; background: rgba(255,255,255,.018); }
      .v3-final-facts span, .v3-final-facts strong { display: block; }
      .v3-final-facts span { color: #6f7684; font-size: 9px; }
      .v3-final-facts strong { margin-top: 6px; color: #cdd1da; font-size: 11px; }
      .v3-final-primary,
      .v3-final-secondary {
        width: 100%;
        height: 48px;
        border-radius: 13px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        cursor: pointer;
      }
      .v3-final-primary { border: 1px solid #f4f5f8; background: #f4f5f8; color: #08090c; font-weight: 760; }
      .v3-final-secondary { margin-top: 8px; border: 1px solid rgba(255,255,255,.09); background: rgba(255,255,255,.03); color: #d4d8e0; }
      .v3-final-primary:hover { transform: translateY(-1px); }
      .v3-final-secondary:hover { border-color: rgba(255,255,255,.16); }
      .v3-final-boundary { margin-top: 16px; display: flex; gap: 8px; align-items: flex-start; color: #686f7d; font-size: 9px; line-height: 1.55; }
      .v3-final-boundary svg { flex: 0 0 auto; color: #9186e6; }
      .v3-final-notes {
        width: min(1360px, calc(100% - 72px));
        margin: 0 auto;
        padding: 0 0 128px;
        border-top: 1px solid rgba(255,255,255,.08);
        display: grid;
        grid-template-columns: 180px minmax(0, 1fr);
        gap: 38px;
      }
      .v3-final-notes > span { padding-top: 34px; color: #646b79; font-size: 9px; letter-spacing: .14em; }
      .v3-final-notes > div:nth-child(2) { padding-top: 30px; }
      .v3-final-notes h2 { max-width: 760px; margin: 0; font-size: clamp(34px, 4vw, 58px); line-height: 1; letter-spacing: -.05em; }
      .v3-final-notes > div:nth-child(2) > p { max-width: 720px; color: #858c9a; line-height: 1.75; font-size: 13px; }
      .v3-final-note-grid { grid-column: 2; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
      .v3-final-note-grid article { min-height: 160px; padding: 18px; border: 1px solid rgba(255,255,255,.075); border-radius: 16px; background: rgba(255,255,255,.018); }
      .v3-final-note-grid article > span { color: #5f6674; font-size: 9px; }
      .v3-final-note-grid strong { display: block; margin-top: 34px; font-size: 13px; }
      .v3-final-note-grid p { color: #737a88; font-size: 10px; line-height: 1.55; }
      .v3-final-pagehero,
      .v3-final-infra-hero {
        width: min(1360px, calc(100% - 72px));
        margin: 0 auto;
        padding: 94px 0 66px;
      }
      .v3-final-pagehero { display: grid; grid-template-columns: 1fr auto; gap: 70px; align-items: end; }
      .v3-final-pagehero > div:first-child { max-width: 870px; }
      .v3-final-pagehero > div > span,
      .v3-final-infra-hero > div > span,
      .v3-final-section-head > div > span { color: #6f7684; font-size: 9px; letter-spacing: .15em; }
      .v3-final-pagehero h1,
      .v3-final-infra-hero h1 { margin: 13px 0 18px; max-width: 920px; font-size: clamp(48px, 6.2vw, 88px); line-height: .93; letter-spacing: -.065em; font-weight: 640; }
      .v3-final-pagehero p,
      .v3-final-infra-hero p { max-width: 690px; margin: 0; color: #9097a5; font-size: 14px; line-height: 1.75; }
      .v3-final-hero-metric { width: 190px; padding: 20px; border-left: 1px solid rgba(255,255,255,.09); }
      .v3-final-hero-metric small, .v3-final-hero-metric span { display: block; color: #6f7684; font-size: 9px; }
      .v3-final-hero-metric strong { display: block; margin: 10px 0 7px; font-size: 52px; line-height: .9; letter-spacing: -.06em; }
      .v3-final-tabs {
        width: min(1360px, calc(100% - 72px));
        margin: 0 auto;
        padding: 8px;
        border: 1px solid rgba(255,255,255,.075);
        border-radius: 14px;
        background: rgba(255,255,255,.018);
        display: flex;
        gap: 5px;
        overflow-x: auto;
      }
      .v3-final-tabs button { min-width: max-content; height: 36px; padding: 0 14px; border: 0; border-radius: 9px; background: transparent; color: #777e8c; cursor: pointer; font-size: 10px; }
      .v3-final-tabs button.active { background: rgba(255,255,255,.065); color: #f0f2f6; }
      .v3-final-catalog,
      .v3-final-plan-section,
      .v3-final-route-table { width: min(1360px, calc(100% - 72px)); margin: 0 auto; padding: 84px 0 120px; }
      .v3-final-section-head { margin-bottom: 36px; display: grid; grid-template-columns: 1fr 430px; gap: 42px; align-items: end; }
      .v3-final-section-head h2 { margin: 9px 0 0; font-size: clamp(36px, 4.3vw, 62px); line-height: 1; letter-spacing: -.055em; }
      .v3-final-section-head > p { margin: 0 0 5px; color: #848b99; font-size: 12px; line-height: 1.7; }
      .v3-final-section-head.compact { margin-bottom: 22px; }
      .v3-final-product-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      .v3-final-product-card { padding: 10px 10px 18px; border: 1px solid rgba(255,255,255,.08); border-radius: 19px; background: rgba(255,255,255,.022); overflow: hidden; }
      .v3-final-product-card:hover { transform: translateY(-3px); border-color: rgba(255,255,255,.15); }
      .v3-final-product-image { aspect-ratio: 1.36; position: relative; overflow: hidden; border-radius: 13px; background: #0d0f14; }
      .v3-final-product-image img { object-fit: cover; transition: transform .42s cubic-bezier(.2,.7,.2,1); }
      .v3-final-product-card:hover .v3-final-product-image img { transform: scale(1.025); }
      .v3-final-product-image > span { position: absolute; left: 10px; top: 10px; z-index: 2; padding: 6px 8px; border: 1px solid rgba(255,255,255,.09); border-radius: 999px; background: rgba(5,6,9,.66); backdrop-filter: blur(10px); color: #c7cbd4; font-size: 8px; letter-spacing: .08em; text-transform: uppercase; }
      .v3-final-product-title { margin: 15px 4px 0; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
      .v3-final-product-title h3 { margin: 0; font-size: 18px; letter-spacing: -.03em; }
      .v3-final-product-title svg { color: #7b8290; }
      .v3-final-product-card > p { min-height: 42px; margin: 8px 4px 18px; color: #747b89; font-size: 10px; line-height: 1.55; }
      .v3-final-product-card footer { margin: 0 4px; padding-top: 13px; border-top: 1px solid rgba(255,255,255,.07); display: flex; justify-content: space-between; align-items: baseline; }
      .v3-final-product-card footer small { color: #666d7b; font-size: 9px; }
      .v3-final-product-card footer strong { font-size: 16px; }
      .v3-final-infra-hero { display: grid; grid-template-columns: 1fr 430px; align-items: center; gap: 80px; }
      .v3-final-infra-hero > div:first-child > small { display: block; margin-top: 22px; color: #676e7c; font-size: 9px; }
      .v3-final-status-card { padding: 8px; border: 1px solid rgba(255,255,255,.09); border-radius: 18px; background: rgba(8,10,15,.82); }
      .v3-final-status-card > div { min-height: 54px; padding: 0 12px; display: grid; grid-template-columns: 1fr auto 112px; align-items: center; border-bottom: 1px solid rgba(255,255,255,.065); font-size: 11px; }
      .v3-final-status-card i { width: 6px; height: 6px; border-radius: 50%; background: #63daa7; }
      .v3-final-status-card strong { text-align: right; color: #99a0ad; font-size: 9px; font-weight: 550; }
      .v3-final-status-card footer { min-height: 58px; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; color: #666d7b; font-size: 9px; }
      .v3-final-status-card footer strong { color: #dce0e7; font-size: 14px; }
      .v3-final-plan-section { padding-top: 30px; }
      .v3-final-plan-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .v3-final-plan-cards article { min-height: 420px; padding: 24px; border: 1px solid rgba(255,255,255,.08); border-radius: 19px; background: rgba(255,255,255,.02); display: flex; flex-direction: column; }
      .v3-final-plan-cards article.featured { border-color: rgba(148,134,255,.28); background: radial-gradient(circle at 18% 0, rgba(110,88,255,.14), transparent 42%), rgba(255,255,255,.026); }
      .v3-final-plan-cards article > span { color: #747b89; font-size: 8px; letter-spacing: .14em; }
      .v3-final-plan-cards h3 { margin: 26px 0 5px; font-size: 19px; }
      .v3-final-plan-cards article > strong { font-size: 42px; letter-spacing: -.05em; }
      .v3-final-plan-cards article > p { min-height: 54px; color: #767d8b; font-size: 10px; line-height: 1.6; }
      .v3-final-plan-cards article > div { margin-top: 32px; padding: 15px 0; border-top: 1px solid rgba(255,255,255,.07); border-bottom: 1px solid rgba(255,255,255,.07); display: flex; justify-content: space-between; align-items: center; }
      .v3-final-plan-cards article > div small { color: #666d7b; font-size: 9px; }
      .v3-final-plan-cards article > div b { font-size: 13px; }
      .v3-final-plan-cards button { height: 42px; margin-top: auto; border: 1px solid rgba(255,255,255,.09); border-radius: 11px; background: rgba(255,255,255,.035); color: #d5d9e1; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
      .v3-final-plan-cards button:hover { border-color: rgba(255,255,255,.15); }
      .v3-final-route-table { padding-top: 0; }
      .v3-final-route-grid { border-top: 1px solid rgba(255,255,255,.08); }
      .v3-final-route-grid > div { min-height: 62px; display: grid; grid-template-columns: 1fr 1fr auto; align-items: center; border-bottom: 1px solid rgba(255,255,255,.075); }
      .v3-final-route-grid strong { font-size: 13px; }
      .v3-final-route-grid span { color: #7b8290; font-size: 10px; }
      .v3-final-route-grid small { display: flex; align-items: center; gap: 7px; color: #6f7684; font-size: 9px; }
      .v3-final-route-grid small i { width: 6px; height: 6px; border-radius: 50%; background: #64dba8; }
      .v3-final-pagehero.skills { align-items: end; }
      .v3-final-skill-search { width: min(430px, 100%); height: 46px; padding: 0 12px; border: 1px solid rgba(255,255,255,.09); border-radius: 13px; background: rgba(255,255,255,.025); display: flex; align-items: center; gap: 9px; color: #737a88; }
      .v3-final-skill-search input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: #f1f3f6; font-size: 11px; }
      .v3-final-skill-search kbd { min-width: 24px; height: 22px; border: 1px solid rgba(255,255,255,.08); border-radius: 6px; display: grid; place-items: center; color: #69707e; font-size: 9px; }
      .v3-final-skill-list { width: min(1360px, calc(100% - 72px)); margin: 0 auto; padding: 8px 0 122px; }
      .v3-final-skill-list article { min-height: 116px; display: grid; grid-template-columns: 58px minmax(250px, 1fr) minmax(220px, auto) auto; gap: 22px; align-items: center; border-top: 1px solid rgba(255,255,255,.075); }
      .v3-final-skill-list article:last-of-type { border-bottom: 1px solid rgba(255,255,255,.075); }
      .v3-final-skill-index { color: #5f6674; font-size: 9px; }
      .v3-final-skill-copy small { color: #6f7684; font-size: 8px; letter-spacing: .13em; }
      .v3-final-skill-copy h3 { margin: 5px 0 4px; font-size: 18px; letter-spacing: -.025em; }
      .v3-final-skill-copy p { margin: 0; color: #747b89; font-size: 10px; }
      .v3-final-skill-list code { color: #8d94a2; font-size: 10px; }
      .v3-final-skill-list article > button { min-width: 88px; height: 38px; border: 1px solid rgba(255,255,255,.09); border-radius: 10px; background: rgba(255,255,255,.03); color: #c9cdd6; display: flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; font-size: 10px; }
      .v3-final-skill-empty { min-height: 220px; border-top: 1px solid rgba(255,255,255,.08); border-bottom: 1px solid rgba(255,255,255,.08); display: grid; place-items: center; align-content: center; gap: 10px; color: #6e7583; }
      .v3-final-skill-empty strong { color: #aeb4bf; font-size: 12px; }
      .v3-final-cart-layout { width: min(1360px, calc(100% - 72px)); margin: 0 auto; padding: 78px 0 128px; display: grid; grid-template-columns: minmax(0, 1fr) 350px; gap: 64px; align-items: start; }
      .v3-final-cart-heading { min-height: 118px; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; border-bottom: 1px solid rgba(255,255,255,.08); }
      .v3-final-cart-heading span { color: #666d7b; font-size: 9px; letter-spacing: .14em; }
      .v3-final-cart-heading h1 { margin: 9px 0 3px; font-size: clamp(42px, 5vw, 70px); line-height: .95; letter-spacing: -.06em; }
      .v3-final-cart-heading p { margin: 0; color: #737a88; font-size: 10px; }
      .v3-final-cart-heading > button { height: 36px; padding: 0 10px; border: 1px solid rgba(255,255,255,.08); border-radius: 9px; background: transparent; color: #777e8c; display: flex; align-items: center; gap: 7px; cursor: pointer; font-size: 9px; }
      .v3-final-cart-items article { min-height: 132px; display: grid; grid-template-columns: 84px minmax(220px, 1fr) 102px 90px 36px; gap: 16px; align-items: center; border-bottom: 1px solid rgba(255,255,255,.075); }
      .v3-final-cart-image { width: 84px; height: 84px; position: relative; overflow: hidden; border-radius: 13px; background: #0d0f14; }
      .v3-final-cart-image img { object-fit: cover; }
      .v3-final-cart-copy small { color: #6e7583; font-size: 8px; letter-spacing: .1em; }
      .v3-final-cart-copy h3 { margin: 5px 0 4px; font-size: 16px; }
      .v3-final-cart-copy p { max-width: 470px; margin: 0; color: #6f7684; font-size: 9px; line-height: 1.5; }
      .v3-final-quantity { height: 36px; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; display: grid; grid-template-columns: 32px 1fr 32px; align-items: center; }
      .v3-final-quantity button { height: 100%; border: 0; background: transparent; color: #7b8290; display: grid; place-items: center; cursor: pointer; }
      .v3-final-quantity strong { text-align: center; font-size: 10px; }
      .v3-final-line-price { text-align: right; font-size: 13px; }
      .v3-final-remove { width: 34px; height: 34px; border: 1px solid rgba(255,255,255,.07); border-radius: 9px; background: transparent; color: #6f7684; display: grid; place-items: center; cursor: pointer; }
      .v3-final-summary { position: sticky; top: 112px; padding: 22px; border: 1px solid rgba(255,255,255,.085); border-radius: 18px; background: rgba(10,11,16,.72); backdrop-filter: blur(18px); }
      .v3-final-summary > span { color: #666d7b; font-size: 8px; letter-spacing: .14em; }
      .v3-final-summary-row, .v3-final-summary-total { display: flex; align-items: center; justify-content: space-between; }
      .v3-final-summary-row { margin-top: 26px; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,.07); }
      .v3-final-summary-row small, .v3-final-summary-total small { color: #747b89; font-size: 9px; }
      .v3-final-summary-row strong { font-size: 12px; }
      .v3-final-summary-total { padding: 23px 0; }
      .v3-final-summary-total strong { font-size: 27px; letter-spacing: -.04em; }
      .v3-final-summary > button { width: 100%; min-height: 45px; border: 1px solid rgba(255,255,255,.08); border-radius: 11px; background: rgba(255,255,255,.035); color: #626977; cursor: not-allowed; font-size: 10px; }
      .v3-final-summary > p { color: #666d7b; font-size: 9px; line-height: 1.6; }
      .v3-final-summary > a { margin-top: 18px; min-height: 36px; border-top: 1px solid rgba(255,255,255,.07); padding-top: 16px; display: flex; align-items: center; justify-content: space-between; color: #9da3af; font-size: 10px; }
      .v3-final-empty-cart { min-height: 360px; display: grid; place-items: center; align-content: center; text-align: center; }
      .v3-final-empty-cart > span { width: 68px; height: 68px; border: 1px solid rgba(255,255,255,.08); border-radius: 18px; background: rgba(255,255,255,.025); display: grid; place-items: center; color: #747b89; }
      .v3-final-empty-cart h2 { margin: 20px 0 5px; font-size: 24px; letter-spacing: -.035em; }
      .v3-final-empty-cart p { max-width: 420px; margin: 0; color: #727987; font-size: 10px; line-height: 1.6; }
      .v3-final-empty-cart a { margin-top: 22px; height: 42px; padding: 0 15px; border: 1px solid rgba(255,255,255,.09); border-radius: 11px; display: inline-flex; align-items: center; gap: 8px; color: #d5d9e0; font-size: 10px; }
      .v3-final-missing { width: min(960px, calc(100% - 48px)); min-height: 70vh; margin: 0 auto; display: grid; align-content: center; justify-items: start; }
      .v3-final-missing > span { color: #6d7482; font-size: 9px; letter-spacing: .14em; }
      .v3-final-missing h1 { max-width: 680px; margin: 13px 0 24px; font-size: clamp(42px, 6vw, 74px); line-height: .95; letter-spacing: -.06em; }
      .v3-final-missing a { min-height: 42px; padding: 0 14px; border: 1px solid rgba(255,255,255,.09); border-radius: 11px; display: inline-flex; align-items: center; gap: 8px; font-size: 10px; }
      @media (max-width: 1024px) {
        .v3-final-detail { grid-template-columns: minmax(0, 1fr) 360px; gap: 42px; }
        .v3-final-art { min-height: 470px; }
        .v3-final-product-grid { grid-template-columns: repeat(2, 1fr); }
        .v3-final-plan-cards { grid-template-columns: 1fr 1fr; }
        .v3-final-plan-cards article:last-child { grid-column: 1 / -1; min-height: 330px; }
        .v3-final-cart-layout { grid-template-columns: 1fr 310px; gap: 36px; }
        .v3-final-cart-items article { grid-template-columns: 78px minmax(160px, 1fr) 96px 75px 34px; gap: 12px; }
        .v3-final-skill-list article { grid-template-columns: 48px minmax(220px, 1fr) auto; }
        .v3-final-skill-list code { display: none; }
      }
      @media (max-width: 900px) {
        .v3-final-detail { grid-template-columns: 1fr; width: min(760px, calc(100% - 48px)); }
        .v3-final-console { position: relative; top: auto; padding-top: 0; }
        .v3-final-art { min-height: auto; }
        .v3-final-pagehero,
        .v3-final-infra-hero { grid-template-columns: 1fr; gap: 34px; }
        .v3-final-hero-metric { width: 100%; padding: 18px 0 0; border-left: 0; border-top: 1px solid rgba(255,255,255,.08); display: grid; grid-template-columns: auto 1fr auto; align-items: end; gap: 16px; }
        .v3-final-hero-metric strong { margin: 0; }
        .v3-final-infra-hero { gap: 44px; }
        .v3-final-section-head { grid-template-columns: 1fr; gap: 16px; }
        .v3-final-cart-layout { grid-template-columns: 1fr; }
        .v3-final-summary { position: relative; top: auto; }
        .v3-final-notes { grid-template-columns: 1fr; gap: 0; }
        .v3-final-note-grid { grid-column: 1; }
        .v3-final-notes > span { padding-top: 28px; }
      }
      @media (max-width: 760px) {
        .v3-final-detail,
        .v3-final-pagehero,
        .v3-final-infra-hero,
        .v3-final-catalog,
        .v3-final-plan-section,
        .v3-final-route-table,
        .v3-final-skill-list,
        .v3-final-cart-layout,
        .v3-final-notes { width: calc(100% - 32px); }
        .v3-final-detail { padding: 24px 0 86px; gap: 26px; }
        .v3-final-back { margin-bottom: 10px; }
        .v3-final-art { border-radius: 20px; aspect-ratio: 1.05; }
        .v3-final-spec-row { grid-template-columns: 1fr; }
        .v3-final-spec-row > div { min-height: 48px; border-right: 0; border-bottom: 1px solid rgba(255,255,255,.07); }
        .v3-final-spec-row > div:last-child { border-bottom: 0; }
        .v3-final-console h1 { font-size: 46px; }
        .v3-final-plan-grid { grid-template-columns: 1fr; }
        .v3-final-plan-grid button { min-height: 58px; display: flex; align-items: center; justify-content: space-between; text-align: left; }
        .v3-final-plan-grid button small { margin-top: 0; }
        .v3-final-facts { grid-template-columns: 1fr; }
        .v3-final-notes { padding-bottom: 88px; }
        .v3-final-note-grid { grid-template-columns: 1fr; }
        .v3-final-note-grid article { min-height: 120px; }
        .v3-final-pagehero,
        .v3-final-infra-hero { padding: 58px 0 42px; }
        .v3-final-pagehero h1,
        .v3-final-infra-hero h1 { font-size: 52px; }
        .v3-final-hero-metric { display: none; }
        .v3-final-tabs { width: calc(100% - 32px); }
        .v3-final-catalog,
        .v3-final-plan-section,
        .v3-final-route-table { padding: 60px 0 88px; }
        .v3-final-product-grid,
        .v3-final-plan-cards { grid-template-columns: 1fr; }
        .v3-final-plan-cards article,
        .v3-final-plan-cards article:last-child { grid-column: auto; min-height: 340px; }
        .v3-final-route-grid > div { grid-template-columns: 1fr auto; gap: 8px; }
        .v3-final-route-grid > div > span { display: none; }
        .v3-final-skill-search { margin-top: 4px; }
        .v3-final-pagehero.skills { gap: 24px; }
        .v3-final-skill-list { padding-bottom: 86px; }
        .v3-final-skill-list article { min-height: 132px; grid-template-columns: 36px 1fr auto; gap: 12px; }
        .v3-final-skill-copy p { max-width: 230px; }
        .v3-final-skill-list article > button { min-width: 40px; width: 40px; padding: 0; }
        .v3-final-skill-list article > button:not(:focus) { font-size: 0; gap: 0; }
        .v3-final-cart-layout { padding: 52px 0 88px; gap: 30px; }
        .v3-final-cart-heading { min-height: 105px; }
        .v3-final-cart-items article { min-height: 154px; grid-template-columns: 72px 1fr auto; grid-template-areas: "image copy remove" "image qty price"; align-items: center; }
        .v3-final-cart-image { grid-area: image; width: 72px; height: 72px; }
        .v3-final-cart-copy { grid-area: copy; }
        .v3-final-cart-copy p { display: none; }
        .v3-final-quantity { grid-area: qty; width: 98px; }
        .v3-final-line-price { grid-area: price; }
        .v3-final-remove { grid-area: remove; }
      }
      @media (max-width: 390px) {
        .v3-final-pagehero h1,
        .v3-final-infra-hero h1 { font-size: 46px; }
        .v3-final-console h1 { font-size: 42px; }
        .v3-final-art { aspect-ratio: .98; }
        .v3-final-price-block strong { font-size: 28px; }
        .v3-final-product-card > p { min-height: 0; }
        .v3-final-skill-list article { grid-template-columns: 30px 1fr 38px; }
        .v3-final-skill-copy p { max-width: 190px; }
      }
      @media (max-width: 330px) {
        .v3-final-detail,
        .v3-final-pagehero,
        .v3-final-infra-hero,
        .v3-final-catalog,
        .v3-final-plan-section,
        .v3-final-route-table,
        .v3-final-skill-list,
        .v3-final-cart-layout,
        .v3-final-notes,
        .v3-final-tabs { width: calc(100% - 24px); }
        .v3-final-pagehero h1,
        .v3-final-infra-hero h1,
        .v3-final-console h1 { font-size: 39px; }
        .v3-final-cart-heading h1 { font-size: 45px; }
        .v3-final-cart-heading > button { width: 36px; padding: 0; font-size: 0; justify-content: center; }
        .v3-final-skill-copy p { display: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        .v3-final-product-card,
        .v3-final-product-image img,
        .v3-final-primary { transition: none !important; transform: none !important; }
      }
    `}</style>
  );
}
