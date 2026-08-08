"use client";

import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{minHeight:"100vh",background:"#050507",color:"#f7f8fb",display:"grid",placeItems:"center",padding:24,fontFamily:"Inter,ui-sans-serif,system-ui,sans-serif"}}>
      <section style={{width:"min(560px,100%)",border:"1px solid rgba(255,255,255,.09)",borderRadius:22,padding:28,background:"#0a0b10"}}>
        <WarningCircle size={28}/>
        <p style={{fontSize:11,letterSpacing:2,color:"#7f8592",marginTop:24}}>V3 / RECOVERY STATE</p>
        <h1 style={{fontSize:"clamp(32px,6vw,54px)",letterSpacing:"-.045em",lineHeight:1,margin:"12px 0 16px"}}>This view could not be loaded.</h1>
        <p style={{color:"#9298a5",lineHeight:1.7}}>The preview keeps the failure contained instead of forcing a full-page refresh. Retry the current view when you are ready.</p>
        <button onClick={reset} style={{height:44,border:0,borderRadius:11,padding:"0 16px",display:"inline-flex",alignItems:"center",gap:8,fontWeight:700,marginTop:18,cursor:"pointer"}}><ArrowClockwise size={17}/>Retry view</button>
      </section>
    </main>
  );
}
