export default function Loading() {
  return (
    <section className="v3-live-loading" aria-label="Loading live storefront data">
      <div className="line small" />
      <div className="line title" />
      <div className="line body" />
      <div className="cards"><i/><i/><i/></div>
      <style jsx>{`
        .v3-live-loading{width:min(1380px,100%);margin:0 auto;padding:90px 34px 120px}.line,.cards i{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.045);animation:pulse 1.35s ease-in-out infinite alternate}.line{border-radius:8px}.small{width:160px;height:12px}.title{width:min(720px,82%);height:78px;margin-top:24px;border-radius:14px}.body{width:min(580px,70%);height:18px;margin-top:20px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:70px}.cards i{display:block;aspect-ratio:1.05;border-radius:20px}@keyframes pulse{from{opacity:.48}to{opacity:.92}}@media(max-width:760px){.v3-live-loading{padding:58px 16px 90px}.title{height:54px}.cards{grid-template-columns:1fr;margin-top:50px}}@media(prefers-reduced-motion:reduce){.line,.cards i{animation:none}}
      `}</style>
    </section>
  );
}
