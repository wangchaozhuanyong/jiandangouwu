export default function Loading() {
  return (
    <main style={{minHeight:"100vh",background:"#050507",color:"#f7f8fb",padding:"30px 34px",fontFamily:"Inter,ui-sans-serif,system-ui,sans-serif"}}>
      <div style={{height:30,borderBottom:"1px solid rgba(255,255,255,.09)",display:"flex",alignItems:"center",gap:8,fontSize:11,color:"#8f95a3"}}><span style={{width:6,height:6,borderRadius:99,background:"#6df1c3"}}/>V3 interface loading</div>
      <div style={{maxWidth:1280,margin:"72px auto"}}>
        <div className="v3-loading-line" style={{width:120,height:10}}/>
        <div className="v3-loading-line" style={{width:"62%",height:70,marginTop:24}}/>
        <div className="v3-loading-line" style={{width:"42%",height:16,marginTop:22}}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginTop:70}}>{[0,1,2,3].map(i=><div className="v3-loading-card" key={i}/>)}</div>
      </div>
      <style>{`.v3-loading-line,.v3-loading-card{border-radius:14px;background:rgba(255,255,255,.055);animation:v3pulse 1.7s ease-in-out infinite alternate}.v3-loading-card{height:280px;border:1px solid rgba(255,255,255,.055)}@keyframes v3pulse{from{opacity:.45}to{opacity:.78}}@media(prefers-reduced-motion:reduce){.v3-loading-line,.v3-loading-card{animation:none}}`}</style>
    </main>
  );
}
