"use client";

import {
  ArrowRight,
  Command,
  MagnifyingGlass,
  ShoppingBagOpen,
  Sparkle,
  X,
  Lightning,
  Cube,
  BracketsCurly,
  Star,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@cloudbridge/contracts";

const products = [
  { slug: "chatgpt-plus-assisted", name: "ChatGPT Plus", kind: "AI Service", image: "/assets/product-chatgpt.webp", price: { zh: "¥158", en: "$22" }, tag: "Popular" },
  { slug: "claude-pro-assisted", name: "Claude Pro", kind: "AI Service", image: "/assets/product-claude.webp", price: { zh: "¥168", en: "$23" }, tag: "Editor pick" },
  { slug: "gemini-advanced-assisted", name: "Gemini Advanced", kind: "AI Service", image: "/assets/product-gemini.webp", price: { zh: "¥148", en: "$21" }, tag: "Fast" },
  { slug: "cursor-pro-assisted", name: "Cursor Pro", kind: "Developer", image: "/assets/product-cursor.webp", price: { zh: "¥138", en: "$19" }, tag: "Developer" },
  { slug: "codex-access", name: "Codex Access", kind: "Developer", image: "/assets/product-codex.webp", price: { zh: "¥128", en: "$18" }, tag: "New" },
  { slug: "midjourney-assisted", name: "Midjourney", kind: "Creative", image: "/assets/product-midjourney.webp", price: { zh: "¥158", en: "$22" }, tag: "Creative" },
] as const;

const copy = {
  zh: {
    preview: "V3 概念预览 · 模拟交互 · 不修改服务器数据",
    store: "商城",
    recharge: "AI 代充",
    transit: "中转站",
    skills: "Skills",
    orders: "订单",
    heroEyebrow: "AI · SOFTWARE · API · SKILLS",
    heroA: "你的下一代",
    heroB: "AI 数字服务中心。",
    heroBody: "把 AI 服务、开发工具、中转 API 与优质 Skills 整合成一个更快、更清晰、更有质感的数字服务体验。",
    explore: "探索服务",
    search: "搜索全部内容",
    command: "Command Search",
    searchHint: "搜索 ChatGPT、Claude、API、Skill…",
    stack: "Explore your AI stack",
    stackBody: "不是分类列表，而是一套围绕工作流组织的数字能力地图。",
    trending: "Trending now",
    trendingBody: "高频使用的 AI 与开发服务，以更少的信息噪音呈现。",
    all: "查看全部",
    instant: "Instant discovery",
    instantBody: "更快找到需要的服务",
    precise: "Precise interface",
    preciseBody: "减少干扰，强调关键动作",
    adaptive: "Adaptive motion",
    adaptiveBody: "动效服务于理解，不为炫技",
    quiet: "Quiet luxury",
    quietBody: "用克制建立高级感",
    footer: "CloudBridge V3 · Intelligent Commerce Interface",
  },
  en: {
    preview: "V3 concept preview · Mock interactions · Server data will not change",
    store: "Store",
    recharge: "AI Recharge",
    transit: "Transit",
    skills: "Skills",
    orders: "Orders",
    heroEyebrow: "AI · SOFTWARE · API · SKILLS",
    heroA: "Your next-generation",
    heroB: "AI commerce layer.",
    heroBody: "AI services, developer tools, transit APIs and curated Skills — organized into one faster, clearer and more refined digital service experience.",
    explore: "Explore services",
    search: "Search everything",
    command: "Command Search",
    searchHint: "Search ChatGPT, Claude, API, Skill…",
    stack: "Explore your AI stack",
    stackBody: "Not a category wall, but a capability map organized around real workflows.",
    trending: "Trending now",
    trendingBody: "High-frequency AI and developer services with dramatically less visual noise.",
    all: "View all",
    instant: "Instant discovery",
    instantBody: "Reach the right service faster",
    precise: "Precise interface",
    preciseBody: "Less noise, stronger actions",
    adaptive: "Adaptive motion",
    adaptiveBody: "Motion explains, never distracts",
    quiet: "Quiet luxury",
    quietBody: "Premium through restraint",
    footer: "CloudBridge V3 · Intelligent Commerce Interface",
  },
} as const;

export function V3PreviewHome({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const base = `/preview/v3/${locale}`;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value ? products.filter((item) => `${item.name} ${item.kind}`.toLowerCase().includes(value)) : products.slice(0, 4);
  }, [query]);

  return (
    <main className="v3">
      <div className="v3-grid" aria-hidden="true" />
      <div className="v3-aurora v3-aurora-a" aria-hidden="true" />
      <div className="v3-aurora v3-aurora-b" aria-hidden="true" />

      <div className="truth"><span />{t.preview}<code>DEV · V3</code></div>

      <header className="header">
        <Link className="brand" href={base} aria-label="CloudBridge V3">
          <span className="brand-mark"><Image src="/assets/cloudbridge-logo.png" alt="" width={36} height={36} unoptimized /></span>
          <span>CloudBridge</span>
        </Link>
        <nav>
          <a href="#store">{t.store}</a>
          <a href="#recharge">{t.recharge}</a>
          <a href="#transit">{t.transit}</a>
          <a href="#skills">{t.skills}</a>
        </nav>
        <div className="actions">
          <button className="icon" onClick={() => setSearchOpen(true)} aria-label={t.search}><MagnifyingGlass size={19}/></button>
          <button className="cmd" onClick={() => setSearchOpen(true)}><Command size={15}/><span>K</span></button>
          <button className="cart" aria-label="Cart"><ShoppingBagOpen size={19}/><span>{cartCount}</span></button>
          <Link className="lang" href={`/preview/v3/${locale === "zh" ? "en" : "zh"}`}>{locale === "zh" ? "EN" : "中"}</Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkle size={14} weight="fill"/>{t.heroEyebrow}</div>
          <h1>{t.heroA}<br/><span>{t.heroB}</span></h1>
          <p>{t.heroBody}</p>
          <div className="hero-actions">
            <a className="primary" href="#store">{t.explore}<ArrowRight size={17}/></a>
            <button className="secondary" onClick={() => setSearchOpen(true)}><MagnifyingGlass size={17}/>{t.search}<kbd>⌘K</kbd></button>
          </div>
        </div>

        <div className="network" aria-label="AI service network visual">
          <div className="network-core"><span>CB</span><small>CORE</small></div>
          {[
            ["ChatGPT", "n1"], ["Claude", "n2"], ["Gemini", "n3"], ["API", "n4"], ["Skills", "n5"], ["Cursor", "n6"],
          ].map(([label, cls]) => <button key={label} className={`node ${cls}`} onClick={() => setSearchOpen(true)}><i />{label}</button>)}
          <svg viewBox="0 0 600 520" aria-hidden="true">
            <path d="M300 260 L130 110 M300 260 L470 105 M300 260 L505 275 M300 260 L430 420 M300 260 L165 425 M300 260 L90 285" />
            <circle cx="300" cy="260" r="155" />
            <circle cx="300" cy="260" r="210" />
          </svg>
        </div>
      </section>

      <section className="signal-row">
        {[
          [Lightning, t.instant, t.instantBody],
          [Cube, t.precise, t.preciseBody],
          [BracketsCurly, t.adaptive, t.adaptiveBody],
          [Star, t.quiet, t.quietBody],
        ].map(([Icon, title, body]) => {
          const Glyph = Icon as typeof Lightning;
          return <article key={String(title)}><Glyph size={19}/><div><strong>{String(title)}</strong><span>{String(body)}</span></div></article>;
        })}
      </section>

      <section className="section" id="store">
        <div className="section-head"><div><span>01 / STACK</span><h2>{t.stack}</h2></div><p>{t.stackBody}</p></div>
        <div className="stack-grid">
          <a className="stack-card featured" href="#recharge"><span>AI RECHARGE</span><h3>ChatGPT · Claude · Gemini</h3><p>Subscriptions and assisted activation</p><ArrowRight size={20}/></a>
          <a className="stack-card" href="#transit"><span>API / TRANSIT</span><h3>Models without friction</h3><p>Usage packs · routes · teams</p><ArrowRight size={20}/></a>
          <a className="stack-card" href="#skills"><span>SKILLS</span><h3>Extend your AI workflow</h3><p>Coding · design · automation</p><ArrowRight size={20}/></a>
        </div>
      </section>

      <section className="section products" id="recharge">
        <div className="section-head"><div><span>02 / CURATED</span><h2>{t.trending}</h2></div><p>{t.trendingBody}</p></div>
        <div className="product-grid">
          {products.map((product) => (
            <article className="product" key={product.slug}>
              <div className="product-image">
                <Image src={product.image} alt="" fill sizes="(max-width:760px) 42vw, 260px" unoptimized />
                <span className="tag">{product.tag}</span>
              </div>
              <div className="product-meta"><span>{product.kind}</span><span>● Available</span></div>
              <h3>{product.name}</h3>
              <div className="product-bottom"><strong>{product.price[locale]}</strong><button onClick={() => setCartCount((v) => v + 1)} aria-label={`Add ${product.name}`}><ShoppingBagOpen size={17}/></button></div>
            </article>
          ))}
        </div>
        <div className="view-all"><button onClick={() => setSearchOpen(true)}>{t.all}<ArrowRight size={16}/></button></div>
      </section>

      <section className="terminal" id="transit">
        <div><span className="terminal-kicker">03 / INFRASTRUCTURE</span><h2>API infrastructure<br/>for AI builders.</h2><p>Claude · GPT · Gemini · multimodel routing</p></div>
        <div className="status-panel">
          {["Claude", "GPT", "Gemini", "Routing"].map((name, index) => <div key={name}><span>{name}</span><i/><strong>{index === 3 ? "Optimized" : "Operational"}</strong></div>)}
          <footer><span>Network status</span><strong>99.99%</strong></footer>
        </div>
      </section>

      <section className="skills" id="skills">
        <div className="section-head"><div><span>04 / EXTEND</span><h2>Skill marketplace</h2></div><p>Curated building blocks for real AI workflows.</p></div>
        <div className="skill-strip">
          {["frontend-design", "automation", "research", "growth", "agents"].map((skill, i) => <button key={skill} onClick={() => setSearchOpen(true)}><span>0{i+1}</span><strong>{skill}</strong><ArrowRight size={17}/></button>)}
        </div>
      </section>

      <footer className="footer"><span>{t.footer}</span><span>© 2026</span></footer>

      {searchOpen && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setSearchOpen(false)}>
          <div className="palette" role="dialog" aria-modal="true" aria-label={t.command}>
            <div className="palette-search"><MagnifyingGlass size={20}/><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchHint}/><button onClick={() => setSearchOpen(false)}><X size={18}/></button></div>
            <div className="palette-label">{query ? "Results" : "Suggested"}</div>
            <div className="palette-results">
              {results.map((item, index) => <button key={item.slug}><span className="mini"><Image src={item.image} alt="" fill sizes="44px" unoptimized/></span><span><strong>{item.name}</strong><small>{item.kind}</small></span><kbd>{index + 1}</kbd></button>)}
            </div>
            <div className="palette-footer"><span>↑↓ Navigate</span><span>↵ Open</span><span>ESC Close</span></div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .v3{--bg:#050507;--panel:#0b0d12;--line:rgba(255,255,255,.09);--muted:#8b91a0;--text:#f7f8fb;min-height:100vh;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden;position:relative}.v3 *{box-sizing:border-box}.v3 a{color:inherit;text-decoration:none}.v3 button{font:inherit}.v3-grid{position:fixed;inset:0;pointer-events:none;opacity:.16;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:64px 64px;mask-image:linear-gradient(to bottom,black,transparent 70%)}.v3-aurora{position:absolute;width:44vw;height:44vw;border-radius:999px;filter:blur(110px);opacity:.12;pointer-events:none}.v3-aurora-a{top:-20vw;right:-10vw;background:#6237ff}.v3-aurora-b{top:35vw;left:-20vw;background:#00cfff}.truth{height:32px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:center;gap:9px;color:#9da3b2;font-size:11px;letter-spacing:.08em;position:relative;z-index:20}.truth>span{width:6px;height:6px;border-radius:50%;background:#45e39b;box-shadow:0 0 14px #45e39b}.truth code{position:absolute;right:26px;color:#727887}.header{height:74px;max-width:1450px;margin:auto;padding:0 28px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:30;background:linear-gradient(to bottom,rgba(5,5,7,.88),rgba(5,5,7,.58));backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.04)}.brand{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:700;letter-spacing:-.02em}.brand-mark{width:28px;height:28px;border-radius:9px;overflow:hidden;display:grid;place-items:center;background:#0b0d12}.brand-mark img{width:44px;height:44px;object-fit:contain}.header nav{display:flex;gap:28px}.header nav a{font-size:13px;color:#a2a8b6;transition:.16s}.header nav a:hover{color:#fff}.actions{display:flex;align-items:center;gap:8px}.actions button,.lang{height:38px;min-width:38px;border:1px solid var(--line);background:rgba(255,255,255,.035);color:#eef0f5;border-radius:11px;display:grid;place-items:center;cursor:pointer}.cmd{grid-template-columns:auto auto!important;gap:4px;padding:0 9px}.cmd span{font-size:11px;color:#8e94a3}.cart{position:relative}.cart span{position:absolute;right:-5px;top:-5px;background:#fff;color:#050507;min-width:17px;height:17px;border-radius:10px;font-size:10px;display:grid;place-items:center;font-weight:800}.hero{max-width:1400px;margin:0 auto;padding:116px 48px 130px;display:grid;grid-template-columns:1.02fr .98fr;align-items:center;gap:50px;position:relative;z-index:2}.eyebrow{display:flex;align-items:center;gap:8px;color:#9ba2b3;font-size:11px;letter-spacing:.16em;margin-bottom:26px}.eyebrow svg{color:#9f8cff}.hero h1{font-size:clamp(58px,6.4vw,104px);line-height:.91;letter-spacing:-.065em;margin:0;max-width:790px;font-weight:650}.hero h1 span{background:linear-gradient(100deg,#fff 0%,#b8b7ff 45%,#70e7ff 100%);-webkit-background-clip:text;color:transparent}.hero-copy>p{max-width:670px;color:#969dac;font-size:16px;line-height:1.8;margin:30px 0 34px}.hero-actions{display:flex;gap:12px;flex-wrap:wrap}.primary,.secondary{height:48px;border-radius:13px;padding:0 18px;display:inline-flex;align-items:center;gap:10px;border:1px solid var(--line)}.primary{background:#f5f7fb;color:#07080a!important;font-weight:700}.secondary{background:rgba(255,255,255,.04);color:#e9ebf0;cursor:pointer}.secondary kbd{font-size:10px;color:#7f8696;border:1px solid var(--line);padding:3px 5px;border-radius:5px}.network{height:560px;position:relative;max-width:600px;margin-left:auto}.network svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.network svg path,.network svg circle{fill:none;stroke:rgba(138,159,255,.19);stroke-width:1}.network svg path{stroke-dasharray:3 7;animation:dash 18s linear infinite}.network-core{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:104px;height:104px;border:1px solid rgba(255,255,255,.19);border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 25%,rgba(132,110,255,.28),rgba(8,9,14,.96) 60%);box-shadow:0 0 70px rgba(83,75,255,.19);z-index:3}.network-core span{font-size:26px;font-weight:800}.network-core small{position:absolute;bottom:24px;font-size:8px;letter-spacing:.16em;color:#777e8e}.node{position:absolute;z-index:4;border:1px solid var(--line);background:rgba(9,10,15,.82);backdrop-filter:blur(12px);color:#dfe2e8;border-radius:999px;padding:9px 13px;display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;transition:.22s transform,.22s border-color,.22s background}.node:hover{transform:translateY(-4px) scale(1.03);border-color:rgba(167,154,255,.45);background:#11131a}.node i{width:6px;height:6px;border-radius:50%;background:#73e6ff;box-shadow:0 0 12px #73e6ff}.n1{top:12%;left:10%}.n2{top:10%;right:6%}.n3{top:47%;right:-3%}.n4{bottom:11%;right:11%}.n5{bottom:8%;left:15%}.n6{top:50%;left:-1%}@keyframes dash{to{stroke-dashoffset:-200}}.signal-row{max-width:1400px;margin:0 auto;border-top:1px solid var(--line);border-bottom:1px solid var(--line);display:grid;grid-template-columns:repeat(4,1fr);position:relative;z-index:2}.signal-row article{padding:26px 28px;display:flex;gap:14px;align-items:flex-start;border-right:1px solid var(--line)}.signal-row article:last-child{border-right:0}.signal-row svg{color:#a59cff}.signal-row strong,.signal-row span{display:block}.signal-row strong{font-size:13px;margin-bottom:4px}.signal-row span{font-size:11px;color:#7f8695;line-height:1.5}.section,.skills{max-width:1400px;margin:0 auto;padding:128px 48px;position:relative;z-index:2}.section-head{display:grid;grid-template-columns:1fr 420px;align-items:end;gap:40px;margin-bottom:46px}.section-head span,.terminal-kicker{font-size:10px;letter-spacing:.16em;color:#747b8c}.section-head h2{font-size:clamp(38px,4.3vw,68px);letter-spacing:-.055em;margin:10px 0 0;font-weight:630}.section-head p{color:#858c9b;line-height:1.7;font-size:14px;margin:0 0 7px}.stack-grid{display:grid;grid-template-columns:1.45fr 1fr 1fr;gap:14px}.stack-card{min-height:310px;border:1px solid var(--line);border-radius:22px;padding:28px;position:relative;overflow:hidden;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018));transition:.25s transform,.25s border-color}.stack-card:before{content:"";position:absolute;inset:auto -25% -60% 30%;height:230px;background:radial-gradient(circle,#4864ff55,transparent 60%);filter:blur(30px)}.stack-card:hover{transform:translateY(-5px);border-color:rgba(255,255,255,.19)}.stack-card span{font-size:10px;color:#8d94a4;letter-spacing:.15em}.stack-card h3{font-size:27px;line-height:1.12;letter-spacing:-.035em;margin:75px 0 12px;max-width:390px}.stack-card p{font-size:12px;color:#7f8695}.stack-card svg{position:absolute;right:25px;bottom:25px}.featured{background:radial-gradient(circle at 15% 5%,rgba(85,99,255,.22),transparent 38%),linear-gradient(145deg,#10121a,#08090e)}.product-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.product{border:1px solid var(--line);border-radius:20px;padding:10px 10px 17px;background:rgba(255,255,255,.025);transition:.22s transform,.22s border-color}.product:hover{transform:translateY(-5px);border-color:rgba(255,255,255,.19)}.product-image{aspect-ratio:1.28;position:relative;border-radius:14px;overflow:hidden;background:#101217}.product-image img{object-fit:cover;transition:.35s transform}.product:hover img{transform:scale(1.025)}.tag{position:absolute!important;left:10px;top:10px;background:rgba(5,6,10,.74);backdrop-filter:blur(9px);border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:6px 8px;font-size:9px!important;color:#dfe2eb!important}.product-meta{display:flex;justify-content:space-between;margin:14px 4px 0}.product-meta span{font-size:9px;color:#747b8b;letter-spacing:.08em;text-transform:uppercase}.product-meta span:last-child{color:#64cda0}.product h3{font-size:18px;letter-spacing:-.025em;margin:9px 4px 20px}.product-bottom{display:flex;align-items:center;justify-content:space-between;margin:0 4px}.product-bottom strong{font-size:16px}.product-bottom button{width:40px;height:40px;border-radius:11px;border:1px solid var(--line);background:rgba(255,255,255,.05);color:#fff;display:grid;place-items:center;cursor:pointer}.view-all{text-align:center;margin-top:34px}.view-all button{border:0;background:transparent;color:#b8bdc8;display:inline-flex;align-items:center;gap:7px;cursor:pointer}.terminal{max-width:1304px;margin:40px auto 100px;border:1px solid var(--line);border-radius:28px;min-height:460px;padding:54px;display:grid;grid-template-columns:1fr 440px;align-items:center;gap:70px;position:relative;overflow:hidden;background:radial-gradient(circle at 10% 20%,rgba(51,200,255,.12),transparent 38%),#080a0f;z-index:2}.terminal:after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px);background-size:100% 40px;pointer-events:none}.terminal h2{font-size:62px;line-height:.96;letter-spacing:-.055em;margin:16px 0}.terminal p{color:#828999}.status-panel{border:1px solid var(--line);border-radius:17px;background:rgba(3,5,8,.68);padding:8px;position:relative;z-index:2}.status-panel>div{height:57px;border-bottom:1px solid rgba(255,255,255,.065);display:grid;grid-template-columns:1fr auto 90px;align-items:center;padding:0 13px;font-size:12px}.status-panel i{width:7px;height:7px;background:#43d598;border-radius:50%;box-shadow:0 0 12px #43d598;margin-right:10px}.status-panel strong{font-size:10px;color:#8a918f;font-weight:500}.status-panel footer{display:flex;justify-content:space-between;padding:17px 13px 10px;color:#7d8493;font-size:11px}.status-panel footer strong{color:#fff;font-size:13px}.skill-strip{border-top:1px solid var(--line)}.skill-strip button{width:100%;height:78px;background:transparent;border:0;border-bottom:1px solid var(--line);color:#fff;display:grid;grid-template-columns:70px 1fr auto;align-items:center;text-align:left;cursor:pointer;padding:0 8px;transition:.16s background,.16s padding}.skill-strip button:hover{background:rgba(255,255,255,.035);padding-left:18px}.skill-strip span{font-size:10px;color:#666d7c}.skill-strip strong{font-size:18px;font-weight:530;letter-spacing:-.02em}.footer{max-width:1400px;margin:0 auto;padding:30px 48px 46px;border-top:1px solid var(--line);display:flex;justify-content:space-between;color:#6e7583;font-size:10px;letter-spacing:.08em;position:relative;z-index:2}.overlay{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(8px);z-index:100;display:flex;align-items:flex-start;justify-content:center;padding-top:13vh}.palette{width:min(650px,calc(100vw - 28px));border:1px solid rgba(255,255,255,.14);border-radius:20px;background:#0b0d12;box-shadow:0 35px 100px rgba(0,0,0,.55);overflow:hidden}.palette-search{height:65px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:0 18px;border-bottom:1px solid var(--line)}.palette-search input{height:100%;border:0;outline:0;background:transparent;color:#fff;font-size:15px}.palette-search input::placeholder{color:#626978}.palette-search button{border:0;background:transparent;color:#777f8d;cursor:pointer}.palette-label{padding:13px 18px 7px;font-size:9px;color:#656d7c;text-transform:uppercase;letter-spacing:.14em}.palette-results{padding:5px 8px 10px}.palette-results button{width:100%;height:64px;border:0;background:transparent;color:#fff;border-radius:12px;display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:center;text-align:left;padding:0 10px;cursor:pointer}.palette-results button:hover{background:rgba(255,255,255,.055)}.mini{width:42px;height:42px;border-radius:9px;position:relative;overflow:hidden}.mini img{object-fit:cover}.palette-results strong,.palette-results small{display:block}.palette-results strong{font-size:13px}.palette-results small{font-size:10px;color:#747b89;margin-top:4px}.palette-results kbd{font-size:9px;color:#69717f}.palette-footer{height:40px;border-top:1px solid var(--line);display:flex;align-items:center;gap:18px;padding:0 18px;font-size:9px;color:#69717e}@media(max-width:900px){.header nav,.cmd{display:none!important}.hero{grid-template-columns:1fr;padding:82px 28px 90px}.network{height:460px;width:100%;margin:auto}.signal-row{grid-template-columns:repeat(2,1fr)}.stack-grid{grid-template-columns:1fr}.product-grid{grid-template-columns:repeat(2,1fr)}.section-head{grid-template-columns:1fr}.terminal{margin:20px 28px 90px;grid-template-columns:1fr;padding:34px}.terminal h2{font-size:48px}.status-panel{max-width:520px}.section,.skills{padding:100px 28px}}@media(max-width:620px){.truth{justify-content:flex-start;padding-left:14px;font-size:9px}.truth code{display:none}.header{height:64px;padding:0 14px}.brand span:last-child{display:none}.actions{gap:6px}.hero{padding:66px 18px 74px}.hero h1{font-size:50px}.hero-copy>p{font-size:14px;margin-top:24px}.network{height:360px;margin-top:12px}.network-core{width:82px;height:82px}.node{font-size:10px;padding:7px 9px}.signal-row{margin:0 14px;grid-template-columns:1fr}.signal-row article{border-right:0;border-bottom:1px solid var(--line);padding:18px 6px}.section,.skills{padding:82px 18px}.section-head{margin-bottom:28px}.section-head h2{font-size:40px}.stack-card{min-height:240px}.stack-card h3{margin-top:55px}.product-grid{grid-template-columns:1fr 1fr;gap:9px}.product{padding:7px 7px 13px;border-radius:15px}.product-image{border-radius:10px;aspect-ratio:1}.product-meta span:first-child{display:none}.product h3{font-size:14px;margin:7px 3px 13px;min-height:34px}.product-bottom strong{font-size:13px}.product-bottom button{width:35px;height:35px}.terminal{margin:10px 14px 70px;padding:28px 20px;border-radius:21px;min-height:auto}.terminal h2{font-size:40px}.terminal p{font-size:12px}.status-panel>div{grid-template-columns:1fr auto 78px}.footer{padding:25px 18px 38px;display:block}.footer span{display:block;margin-top:7px}.overlay{padding-top:8vh}.palette{border-radius:17px}.secondary kbd{display:none}}@media(prefers-reduced-motion:reduce){.v3 *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
      `}</style>
    </main>
  );
}
