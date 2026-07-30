type ResponsiveImageProps = {
  srcSet?: string;
  sizes?: string;
};

export function storefrontResponsiveImage(
  src: string,
  kind: "hero" | "product",
): ResponsiveImageProps {
  const match = src.match(
    kind === "hero"
      ? /^\/assets\/(hero-[a-z0-9-]+)\.webp$/u
      : /^\/assets\/(product-[a-z0-9-]+)\.webp$/u,
  );
  if (!match) return {};
  const base = `/assets/responsive/${match[1]}`;
  if (kind === "hero") {
    return {
      srcSet: `${base}-640.webp 640w, ${base}-1280.webp 1280w, ${src} 2048w`,
      sizes: "(max-width: 760px) calc(100vw - 24px), calc(100vw - 48px)",
    };
  }
  return {
    srcSet: `${base}-480.webp 480w, ${base}-720.webp 720w, ${src} 1000w`,
    sizes:
      "(max-width: 760px) calc((100vw - 36px) / 2), (max-width: 1280px) calc((100vw - 72px) / 2), 600px",
  };
}
