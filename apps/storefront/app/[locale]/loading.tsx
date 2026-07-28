export default function LocaleLoading() {
  return (
    <main className="route-loading-shell" aria-busy="true" aria-label="Loading">
      <div className="route-loading-line" />
      <div className="route-loading-hero" />
      <div className="route-loading-grid">
        {Array.from({ length: 4 }, (_, index) => <div key={index} />)}
      </div>
    </main>
  );
}
