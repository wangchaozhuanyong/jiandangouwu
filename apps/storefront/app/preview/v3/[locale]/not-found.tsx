"use client";

import { ArrowLeft, Command, MagnifyingGlass } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function V3NotFound() {
  const pathname = usePathname();
  const locale = pathname.includes("/preview/v3/en") ? "en" : "zh";
  const base = `/preview/v3/${locale}`;
  const copy = locale === "zh"
    ? { code: "SIGNAL LOST / 404", title: "这个节点不存在。", body: "你访问的 V3 预览路径没有对应内容。返回数字服务中心，或使用 Command Search 重新定位。", back: "返回 V3 首页", search: "⌘K 可在任意 V3 页面搜索" }
    : { code: "SIGNAL LOST / 404", title: "This node does not exist.", body: "There is no V3 preview surface at this path. Return to the commerce layer or use Command Search to relocate.", back: "Back to V3 home", search: "⌘K searches from anywhere in V3" };

  return (
    <main className="v3-404">
      <div className="grid" />
      <section>
        <div className="orb"><span>404</span></div>
        <code>{copy.code}</code>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        <div className="actions">
          <Link href={base}><ArrowLeft size={17} />{copy.back}</Link>
          <span><MagnifyingGlass size={16} />{copy.search}<kbd><Command size={11} />K</kbd></span>
        </div>
      </section>
      <style jsx global>{`
        .v3-404{min-height:100vh;background:#050507;color:#f6f7fa;display:grid;place-items:center;padding:34px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;position:relative;overflow:hidden}.v3-404 .grid{position:absolute;inset:0;opacity:.13;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:64px 64px;mask-image:radial-gradient(circle at 50% 45%,black,transparent 68%)}.v3-404 section{width:min(680px,100%);position:relative;text-align:center}.v3-404 .orb{width:150px;height:150px;margin:0 auto 34px;border:1px solid rgba(255,255,255,.1);border-radius:50%;display:grid;place-items:center;position:relative;background:radial-gradient(circle at 50% 50%,rgba(105,76,255,.18),rgba(8,9,13,.8) 58%)}.v3-404 .orb:before,.v3-404 .orb:after{content:'';position:absolute;border:1px solid rgba(255,255,255,.06);border-radius:50%}.v3-404 .orb:before{width:210px;height:210px}.v3-404 .orb:after{width:280px;height:280px}.v3-404 .orb span{font:700 28px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:-.06em}.v3-404 code{font-size:10px;letter-spacing:.18em;color:#707785}.v3-404 h1{font-size:clamp(46px,7vw,78px);line-height:.96;letter-spacing:-.06em;margin:18px 0}.v3-404 p{max-width:560px;margin:0 auto;color:#8d94a2;line-height:1.75;font-size:14px}.v3-404 .actions{margin-top:32px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap}.v3-404 .actions a,.v3-404 .actions>span{min-height:44px;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:0 14px;display:flex;align-items:center;gap:8px;text-decoration:none;font-size:11px}.v3-404 .actions a{background:#f4f5f7;color:#08090c;font-weight:700}.v3-404 .actions>span{background:#0b0d12;color:#949aa7}.v3-404 kbd{display:flex;align-items:center;gap:2px;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:3px 5px}@media(max-width:620px){.v3-404{padding:20px 16px 100px}.v3-404 .orb{width:118px;height:118px}.v3-404 .orb:before{width:164px;height:164px}.v3-404 .orb:after{width:210px;height:210px}.v3-404 .actions{flex-direction:column}.v3-404 .actions a,.v3-404 .actions>span{justify-content:center}}
      `}</style>
    </main>
  );
}
