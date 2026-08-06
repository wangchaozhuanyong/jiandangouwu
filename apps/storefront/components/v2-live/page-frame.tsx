import type { ReactNode } from "react";

export type V2PageFrameLayout =
  | "commerce"
  | "operation"
  | "reading"
  | "immersive";

function frameClassName(
  prefix: "v2-page-frame" | "v2-content-frame",
  layout: V2PageFrameLayout,
  className?: string,
) {
  return [prefix, `${prefix}--${layout}`, className]
    .filter(Boolean)
    .join(" ");
}

export function V2PageFrame({
  children,
  className,
  layout,
}: {
  children: ReactNode;
  className?: string;
  layout: V2PageFrameLayout;
}) {
  return (
    <main className={frameClassName("v2-page-frame", layout, className)}>
      {children}
    </main>
  );
}

export function V2ContentFrame({
  children,
  className,
  layout,
}: {
  children: ReactNode;
  className?: string;
  layout: V2PageFrameLayout;
}) {
  return (
    <div className={frameClassName("v2-content-frame", layout, className)}>
      {children}
    </div>
  );
}

export function V2HeroFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["v2-hero-frame", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
