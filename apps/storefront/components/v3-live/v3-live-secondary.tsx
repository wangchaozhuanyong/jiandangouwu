"use client";

import type {
  Locale,
  OrderLookupResult,
  SkillCategorySummary,
  SkillDetail,
  SkillSummary,
} from "@cloudbridge/contracts";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  GithubLogo,
  Headset,
  MagnifyingGlass,
  Package,
  Receipt,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ApiRequestError, lookupOrder } from "../../lib/api";
import { useExperience } from "../experience-provider";

const copy = {
  zh: {
    skillsEyebrow: "SKILLS / LIVE DATA",
    skillsTitle: "真实 Skill 目录。",
    skillsBody: "直接读取现有 Skills API，不使用 V3 静态数组。",
    search: "搜索 Skill、维护者或环境",
    all: "全部",
    official: "官方",
    community: "社区",
    verified: "已验证",
    maintainer: "维护者",
    environments: "兼容环境",
    detail: "查看详情",
    empty: "当前筛选没有真实 Skill",
    github: "打开 GitHub",
    docs: "查看文档",
    copyInstall: "复制安装提示",
    copied: "已复制",
    suitable: "适合",
    unsuitable: "不适合",
    license: "License",
    back: "返回 Skills",
    lookupEyebrow: "ORDER LOOKUP / LIVE API",
    lookupTitle: "沿用正式安全语义的订单查询。",
    lookupBody: "完整订单号通过 POST body 查询；联系方式查询在没有所有权验证前保持关闭。",
    local: "本机会话",
    contact: "联系方式",
    number: "订单号",
    localTitle: "当前会话中的订单摘要",
    localBody: "只显示本次打开网站后成功提交并保存到 ExperienceProvider 的安全摘要。",
    noLocal: "当前会话没有订单摘要",
    contactTitle: "联系方式查询保持关闭",
    contactBody: "在缺少所有权验证前，不允许仅凭联系方式枚举订单。",
    support: "联系客服",
    numberTitle: "使用完整订单号",
    numberBody: "订单号不会写进 URL、浏览历史或查询参数。",
    placeholder: "输入完整订单号",
    query: "查询订单",
    querying: "正在查询",
    required: "请输入至少 16 个字符的完整订单号。",
    notFound: "没有找到可显示的订单。",
    limited: "查询过于频繁，请稍后重试。",
    unavailable: "订单服务暂时不可用。",
    status: "状态",
    amount: "金额",
    created: "创建时间",
    updated: "更新时间",
    items: "商品",
    contactMasked: "联系方式",
    copyOrder: "复制订单号",
  },
  en: {
    skillsEyebrow: "SKILLS / LIVE DATA",
    skillsTitle: "A live Skill directory.",
    skillsBody: "Reads the existing Skills API directly, with no V3 static fixture array.",
    search: "Search Skill, maintainer, or environment",
    all: "All",
    official: "Official",
    community: "Community",
    verified: "Verified",
    maintainer: "Maintainer",
    environments: "Environments",
    detail: "View detail",
    empty: "No live Skills match this filter",
    github: "Open GitHub",
    docs: "Documentation",
    copyInstall: "Copy install hint",
    copied: "Copied",
    suitable: "Suitable for",
    unsuitable: "Not suitable for",
    license: "License",
    back: "Back to Skills",
    lookupEyebrow: "ORDER LOOKUP / LIVE API",
    lookupTitle: "Order lookup with the production security semantics intact.",
    lookupBody: "Complete order numbers are sent in a POST body; contact-only lookup stays closed until ownership verification exists.",
    local: "This session",
    contact: "Contact",
    number: "Order number",
    localTitle: "Order summaries in this session",
    localBody: "Shows only safe summaries remembered by ExperienceProvider after successful submissions in this open session.",
    noLocal: "No order summaries in this session",
    contactTitle: "Contact lookup remains closed",
    contactBody: "Without ownership verification, contact details cannot be used to enumerate orders.",
    support: "Contact support",
    numberTitle: "Use the complete order number",
    numberBody: "The order number is never written to the URL, browser history, or query parameters.",
    placeholder: "Enter the complete order number",
    query: "Look up order",
    querying: "Looking up",
    required: "Enter a complete order number with at least 16 characters.",
    notFound: "No order can be displayed.",
    limited: "Too many lookup attempts. Try again later.",
    unavailable: "The order service is temporarily unavailable.",
    status: "Status",
    amount: "Amount",
    created: "Created",
    updated: "Updated",
    items: "Products",
    contactMasked: "Contact",
    copyOrder: "Copy order number",
  },
} as const;

function isSafeHttps(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function V3LiveSkillsPilot({
  categories,
  locale,
  skills,
}: {
  categories: SkillCategorySummary[];
  locale: Locale;
  skills: SkillSummary[];
}) {
  const t = copy[locale];
  const base = `/preview/v3-live/${locale}`;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((skill) => {
      const matchesCategory = category === "ALL" || skill.categoryId === category;
      const haystack = `${skill.name} ${skill.summary} ${skill.maintainer} ${skill.compatibleEnvironments.join(" ")}`.toLowerCase();
      return matchesCategory && (!q || haystack.includes(q));
    });
  }, [category, query, skills]);

  return (
    <section className="v3-secondary-page">
      <header className="v3-secondary-hero">
        <span>{t.skillsEyebrow}</span>
        <h1>{t.skillsTitle}</h1>
        <p>{t.skillsBody}</p>
        <div className="v3-secondary-metrics"><div><small>{locale === "zh" ? "分类" : "Categories"}</small><strong>{categories.length}</strong></div><div><small>{locale === "zh" ? "资源" : "Resources"}</small><strong>{skills.length}</strong></div></div>
      </header>
      <div className="v3-secondary-toolbar">
        <label><MagnifyingGlass size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search}/></label>
        <div><button className={category === "ALL" ? "active" : ""} onClick={() => setCategory("ALL")} type="button">{t.all}</button>{categories.map((item) => <button className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)} type="button" key={item.id}>{item.name}</button>)}</div>
      </div>
      <div className="v3-skill-grid">
        {visible.length ? visible.map((skill) => (
          <article className="v3-skill-card" key={skill.id}>
            <div className="v3-skill-top"><span>{skill.resourceType}</span><span>{skill.sourceLevel === "OFFICIAL" ? t.official : t.community}</span></div>
            <h2>{skill.name}</h2>
            <p>{skill.summary}</p>
            <dl><div><dt>{t.maintainer}</dt><dd>{skill.maintainer}</dd></div><div><dt>{t.environments}</dt><dd>{skill.compatibleEnvironments.slice(0, 3).join(" · ") || "—"}</dd></div><div><dt>{t.verified}</dt><dd>{skill.verifiedAt || "—"}</dd></div></dl>
            <div className="v3-skill-actions"><Link href={`${base}/skills/${skill.slug}`}>{t.detail}<ArrowRight size={16}/></Link>{isSafeHttps(skill.githubUrl) && <a href={skill.githubUrl} target="_blank" rel="noreferrer"><GithubLogo size={16}/>{t.github}</a>}</div>
          </article>
        )) : <div className="v3-secondary-empty">{t.empty}</div>}
      </div>
      <style jsx global>{secondaryStyles}</style>
    </section>
  );
}

export function V3LiveSkillDetailPilot({ locale, skill }: { locale: Locale; skill: SkillDetail }) {
  const t = copy[locale];
  const base = `/preview/v3-live/${locale}`;
  const [copied, setCopied] = useState(false);
  const copyHint = async () => {
    try {
      await navigator.clipboard.writeText(skill.installHint);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section className="v3-secondary-detail">
      <Link className="v3-secondary-back" href={`${base}/skills`}><ArrowLeft size={17}/>{t.back}</Link>
      <div className="v3-secondary-detail-grid">
        <article>
          <span>{skill.resourceType} / {skill.sourceLevel}</span>
          <h1>{skill.name}</h1>
          <p className="lead">{skill.description}</p>
          <div className="v3-install-box"><small>{locale === "zh" ? "安装提示" : "Install hint"}</small><code>{skill.installHint}</code><button onClick={() => void copyHint()} type="button">{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? t.copied : t.copyInstall}</button></div>
          <div className="v3-suitability"><section><h2>{t.suitable}</h2>{skill.suitableFor.map((item) => <p key={item}><Check size={15}/>{item}</p>)}</section><section><h2>{t.unsuitable}</h2>{skill.unsuitableFor.map((item) => <p key={item}><WarningCircle size={15}/>{item}</p>)}</section></div>
        </article>
        <aside>
          <dl><div><dt>{t.maintainer}</dt><dd>{skill.maintainer}</dd></div><div><dt>{t.environments}</dt><dd>{skill.compatibleEnvironments.join(" · ") || "—"}</dd></div><div><dt>{t.verified}</dt><dd>{skill.verifiedAt}</dd></div><div><dt>{t.license}</dt><dd>{skill.license}</dd></div></dl>
          {isSafeHttps(skill.githubUrl) && <a className="primary" href={skill.githubUrl} target="_blank" rel="noreferrer"><GithubLogo size={17}/>{t.github}</a>}
          {isSafeHttps(skill.documentationUrl) && <a href={skill.documentationUrl} target="_blank" rel="noreferrer">{t.docs}<ArrowRight size={16}/></a>}
        </aside>
      </div>
      <style jsx global>{secondaryStyles}</style>
    </section>
  );
}

type LookupMode = "local" | "contact" | "number";
type LookupState = "idle" | "loading" | "error" | "limited" | "unavailable" | "ready";

export function V3LiveOrderLookupPilot({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const { openSupport, orderReceipts } = useExperience();
  const [mode, setMode] = useState<LookupMode>("local");
  const [number, setNumber] = useState("");
  const [state, setState] = useState<LookupState>("idle");
  const [result, setResult] = useState<OrderLookupResult | null>(null);
  const [copied, setCopied] = useState(false);

  const changeMode = (next: LookupMode) => {
    setMode(next);
    setState("idle");
    setResult(null);
  };

  const submit = async () => {
    if (number.trim().length < 16) {
      setState("error");
      setResult(null);
      return;
    }
    setState("loading");
    setResult(null);
    try {
      const next = await lookupOrder({ locale, mode: "ORDER_NUMBER", orderNumber: number.trim() });
      setResult(next);
      setState("ready");
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 429) setState("limited");
      else if (error instanceof ApiRequestError && error.status >= 500) setState("unavailable");
      else setState("error");
    }
  };

  return (
    <section className="v3-secondary-page v3-order-lookup">
      <header className="v3-secondary-hero"><span>{t.lookupEyebrow}</span><h1>{t.lookupTitle}</h1><p>{t.lookupBody}</p></header>
      <div className="v3-lookup-tabs" role="tablist" aria-label={t.lookupEyebrow}>
        <button role="tab" aria-selected={mode === "local"} className={mode === "local" ? "active" : ""} onClick={() => changeMode("local")} type="button"><Package size={18}/>{t.local}</button>
        <button role="tab" aria-selected={mode === "contact"} className={mode === "contact" ? "active" : ""} onClick={() => changeMode("contact")} type="button"><Headset size={18}/>{t.contact}</button>
        <button role="tab" aria-selected={mode === "number"} className={mode === "number" ? "active" : ""} onClick={() => changeMode("number")} type="button"><Receipt size={18}/>{t.number}</button>
      </div>
      <div className="v3-lookup-panel" role="tabpanel">
        {mode === "local" ? <div className="v3-local-orders"><header><div><h2>{t.localTitle}</h2><p>{t.localBody}</p></div><strong>{orderReceipts.length}</strong></header>{orderReceipts.length ? orderReceipts.map((receipt) => <article key={receipt.orderNumber}><div><small>{t.number}</small><strong>{receipt.orderNumber}</strong><p>{receipt.productName}</p></div><span>{receipt.amount.amount} {receipt.amount.currency}</span></article>) : <div className="v3-lookup-feedback"><Receipt size={30}/><strong>{t.noLocal}</strong></div>}</div> : mode === "contact" ? <div className="v3-lookup-feedback warning"><ShieldCheck size={34}/><h2>{t.contactTitle}</h2><p>{t.contactBody}</p><button onClick={openSupport} type="button">{t.support}<ArrowRight size={16}/></button></div> : <div className="v3-number-lookup"><form onSubmit={(event) => { event.preventDefault(); void submit(); }}><h2>{t.numberTitle}</h2><p>{t.numberBody}</p><label><span>{t.number}</span><input autoComplete="off" aria-invalid={state === "error"} value={number} onChange={(event) => { setNumber(event.target.value.slice(0, 48)); setState("idle"); setResult(null); }} placeholder={t.placeholder}/></label>{state === "error" && <small role="alert">{number.trim().length < 16 ? t.required : t.notFound}</small>}<button disabled={state === "loading"} type="submit">{state === "loading" ? t.querying : t.query}<ArrowRight size={17}/></button></form><div className="v3-lookup-result" aria-live="polite">{result ? <article><div className="v3-result-head"><span>{t.number}</span><strong>{result.orderNumber}</strong><button onClick={() => void navigator.clipboard.writeText(result.orderNumber).then(() => setCopied(true)).catch(() => setCopied(false))} type="button"><Copy size={15}/>{copied ? t.copied : t.copyOrder}</button></div><dl><div><dt>{t.status}</dt><dd>{result.status}</dd></div><div><dt>{t.items}</dt><dd>{result.items.map((item) => item.productName).join(" · ")}</dd></div><div><dt>{t.amount}</dt><dd>{result.amount.amount} {result.amount.currency}</dd></div><div><dt>{t.contactMasked}</dt><dd>{result.maskedContact}</dd></div><div><dt>{t.created}</dt><dd>{result.createdAt}</dd></div><div><dt>{t.updated}</dt><dd>{result.updatedAt}</dd></div></dl></article> : state === "limited" ? <div className="v3-lookup-feedback warning"><WarningCircle size={30}/><strong>{t.limited}</strong></div> : state === "unavailable" ? <div className="v3-lookup-feedback"><WarningCircle size={30}/><strong>{t.unavailable}</strong></div> : null}</div></div>}
      </div>
      <style jsx global>{secondaryStyles}</style>
    </section>
  );
}

const secondaryStyles = `
.v3-secondary-page,.v3-secondary-detail{width:min(1320px,100%);margin:0 auto;padding:78px 34px 120px;position:relative;z-index:2;color:#f7f8fb}.v3-secondary-hero>span,.v3-secondary-detail article>span{font-size:9px;letter-spacing:.16em;color:#757d8c}.v3-secondary-hero h1,.v3-secondary-detail h1{font-size:clamp(48px,6vw,78px);line-height:.96;letter-spacing:-.06em;margin:15px 0 19px}.v3-secondary-hero>p{max-width:680px;color:#9299a8;line-height:1.72}.v3-secondary-metrics{display:flex;gap:1px;margin-top:30px;border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;width:max-content}.v3-secondary-metrics>div{min-width:130px;padding:13px 16px;background:rgba(255,255,255,.025)}.v3-secondary-metrics small,.v3-secondary-metrics strong{display:block}.v3-secondary-metrics small{font-size:9px;color:#727987}.v3-secondary-metrics strong{margin-top:5px;font-size:18px}.v3-secondary-toolbar{margin-top:50px;display:grid;gap:12px}.v3-secondary-toolbar label{height:48px;max-width:520px;border:1px solid rgba(255,255,255,.09);border-radius:13px;display:flex;align-items:center;gap:10px;padding:0 14px;background:rgba(255,255,255,.025)}.v3-secondary-toolbar input{flex:1;background:transparent;border:0;outline:0;color:#fff}.v3-secondary-toolbar>div{display:flex;gap:8px;overflow:auto;scrollbar-width:none}.v3-secondary-toolbar button{height:34px;padding:0 12px;border-radius:10px;border:1px solid rgba(255,255,255,.09);background:#0b0d12;color:#858c9a;white-space:nowrap}.v3-secondary-toolbar button.active{background:#f4f6fa;color:#08090c}.v3-skill-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-top:24px}.v3-skill-card{border:1px solid rgba(255,255,255,.09);border-radius:19px;background:rgba(255,255,255,.025);padding:20px}.v3-skill-top{display:flex;justify-content:space-between;color:#727987;font-size:9px;letter-spacing:.1em}.v3-skill-card h2{font-size:22px;letter-spacing:-.035em;margin:15px 0 8px}.v3-skill-card>p{color:#9097a5;line-height:1.65;font-size:12px;min-height:58px}.v3-skill-card dl,.v3-secondary-detail aside dl,.v3-lookup-result dl{margin:18px 0 0;border-top:1px solid rgba(255,255,255,.08)}.v3-skill-card dl>div,.v3-secondary-detail aside dl>div,.v3-lookup-result dl>div{display:flex;justify-content:space-between;gap:18px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.08)}.v3-skill-card dt,.v3-secondary-detail dt,.v3-lookup-result dt{color:#707786;font-size:9px}.v3-skill-card dd,.v3-secondary-detail dd,.v3-lookup-result dd{margin:0;text-align:right;font-size:10px;max-width:65%;word-break:break-word}.v3-skill-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:18px}.v3-skill-actions a,.v3-secondary-detail aside>a{min-height:40px;border:1px solid rgba(255,255,255,.09);border-radius:10px;display:flex;align-items:center;justify-content:center;gap:7px;font-size:10px;background:#0e1015}.v3-secondary-empty{grid-column:1/-1;padding:60px;border:1px dashed rgba(255,255,255,.1);border-radius:18px;text-align:center;color:#858c9a}.v3-secondary-back{display:inline-flex;gap:7px;align-items:center;color:#9299a7;font-size:11px;margin-bottom:28px}.v3-secondary-detail-grid{display:grid;grid-template-columns:1fr 360px;gap:64px}.v3-secondary-detail .lead{color:#949ba9;line-height:1.75;max-width:730px}.v3-install-box{margin-top:32px;padding:18px;border:1px solid rgba(255,255,255,.09);border-radius:15px;background:#0a0c11}.v3-install-box small{display:block;color:#737b89;font-size:9px}.v3-install-box code{display:block;margin:11px 0 14px;padding:13px;border-radius:10px;background:#050607;white-space:pre-wrap;word-break:break-word;color:#d9dde5}.v3-install-box button{min-height:40px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:#f4f6f9;color:#08090c;padding:0 13px;display:flex;align-items:center;gap:7px}.v3-suitability{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px}.v3-suitability section{border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:18px}.v3-suitability h2{font-size:13px;margin:0 0 12px}.v3-suitability p{display:flex;gap:8px;align-items:flex-start;color:#9198a6;font-size:11px;line-height:1.55}.v3-secondary-detail aside{position:sticky;top:126px;align-self:start;border:1px solid rgba(255,255,255,.09);border-radius:17px;padding:18px;background:#0a0c11}.v3-secondary-detail aside>a{margin-top:8px}.v3-secondary-detail aside>a.primary{background:#f4f6f9;color:#08090c}.v3-order-lookup{max-width:1120px}.v3-lookup-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:42px}.v3-lookup-tabs button{min-height:48px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:#0a0c11;color:#8d94a2;display:flex;align-items:center;justify-content:center;gap:8px}.v3-lookup-tabs button.active{background:#f4f6f9;color:#08090c}.v3-lookup-panel{margin-top:12px;border:1px solid rgba(255,255,255,.09);border-radius:20px;background:rgba(255,255,255,.02);min-height:340px;padding:26px}.v3-local-orders>header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.v3-local-orders h2,.v3-number-lookup h2,.v3-lookup-feedback h2{font-size:22px;margin:0 0 8px}.v3-local-orders header p,.v3-number-lookup form>p,.v3-lookup-feedback p{color:#8d94a2;line-height:1.6;max-width:700px;font-size:11px}.v3-local-orders header>strong{font-size:26px}.v3-local-orders article{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:16px 0;border-top:1px solid rgba(255,255,255,.08)}.v3-local-orders article div{display:flex;flex-direction:column;gap:4px}.v3-local-orders article small{color:#6f7684;font-size:9px}.v3-local-orders article strong{font-size:12px}.v3-local-orders article p{margin:0;color:#858c9a;font-size:10px}.v3-local-orders article>span{font-size:11px}.v3-lookup-feedback{min-height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#8f96a4}.v3-lookup-feedback.warning>svg{color:#ffd27c}.v3-lookup-feedback button{min-height:42px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:#f4f6f9;color:#08090c;padding:0 13px;display:flex;align-items:center;gap:7px}.v3-number-lookup{display:grid;grid-template-columns:.85fr 1.15fr;gap:30px}.v3-number-lookup form label{display:block;margin-top:22px}.v3-number-lookup form label>span{display:block;color:#777e8c;font-size:9px;margin-bottom:7px}.v3-number-lookup input{width:100%;height:46px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:#07090d;color:#fff;padding:0 12px;outline:0}.v3-number-lookup form>small{display:block;color:#ff9b9b;font-size:9px;margin-top:7px}.v3-number-lookup form>button{margin-top:12px;min-height:44px;border:0;border-radius:11px;background:#f4f6f9;color:#08090c;padding:0 14px;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700}.v3-number-lookup form>button:disabled{opacity:.5}.v3-lookup-result>article{border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px;background:#090b10}.v3-result-head{display:grid;grid-template-columns:1fr auto;gap:6px}.v3-result-head>span{grid-column:1/-1;color:#717887;font-size:9px}.v3-result-head>strong{font-size:13px;word-break:break-all}.v3-result-head button{min-height:34px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#101219;color:#a7adb8;display:flex;align-items:center;gap:5px;padding:0 9px;font-size:9px}
@media(max-width:920px){.v3-skill-grid{grid-template-columns:repeat(2,1fr)}.v3-secondary-detail-grid,.v3-number-lookup{grid-template-columns:1fr}.v3-secondary-detail aside{position:relative;top:auto}.v3-suitability{grid-template-columns:1fr}}
@media(max-width:620px){.v3-secondary-page,.v3-secondary-detail{padding:52px 16px 88px}.v3-secondary-hero h1,.v3-secondary-detail h1{font-size:44px}.v3-skill-grid{grid-template-columns:1fr}.v3-skill-actions{grid-template-columns:1fr 1fr}.v3-lookup-tabs{grid-template-columns:1fr}.v3-lookup-panel{padding:18px}.v3-local-orders>header{align-items:center}.v3-local-orders article{align-items:flex-start;flex-direction:column}.v3-result-head{grid-template-columns:1fr}.v3-result-head button{justify-self:start}.v3-secondary-metrics{width:100%}.v3-secondary-metrics>div{flex:1;min-width:0}}
`;
