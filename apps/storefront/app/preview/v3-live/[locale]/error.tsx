"use client";

import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";
import { useParams } from "next/navigation";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale?: string }>();
  const zh = params?.locale !== "en";
  return (
    <section className="v3-live-error" role="alert">
      <WarningCircle size={34} />
      <span>LIVE DATA / RECOVERY</span>
      <h1>{zh ? "真实数据暂时无法读取。" : "Live data is temporarily unavailable."}</h1>
      <p>{zh ? "这不是商品不存在。V3 Live Pilot 会保留当前正式 API 的错误语义，请重试读取。" : "This is not treated as a missing product. The V3 Live Pilot preserves the live API error boundary; retry the read."}</p>
      <button onClick={reset} type="button"><ArrowClockwise size={17}/>{zh ? "重新读取" : "Retry"}</button>
      <style jsx>{`
        .v3-live-error{width:min(900px,calc(100% - 32px));margin:80px auto 130px;padding:56px;border:1px solid rgba(255,255,255,.09);border-radius:24px;background:rgba(255,255,255,.025);color:#f7f8fb}.v3-live-error>svg{color:#ffbf73}.v3-live-error>span{display:block;margin-top:18px;color:#747c8b;font-size:9px;letter-spacing:.16em}.v3-live-error h1{font-size:clamp(38px,5vw,64px);line-height:1;letter-spacing:-.055em;margin:14px 0 18px}.v3-live-error p{max-width:650px;color:#9299a8;line-height:1.7}.v3-live-error button{margin-top:16px;min-height:44px;padding:0 15px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:#f4f6f9;color:#08090c;display:inline-flex;align-items:center;gap:8px;font-weight:700}
      `}</style>
    </section>
  );
}
