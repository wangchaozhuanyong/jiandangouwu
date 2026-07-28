"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="route-error" role="alert">
          <h1>页面暂时无法打开 / The page could not be opened</h1>
          <button onClick={reset}>重试 / Retry</button>
        </main>
      </body>
    </html>
  );
}
