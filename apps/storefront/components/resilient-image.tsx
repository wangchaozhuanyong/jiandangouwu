"use client";

import { ImageSquare } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

export function ResilientImage({
  src,
  alt,
  className,
  width,
  height,
  loading = "lazy",
  fetchPriority = "auto",
  fallbackLabel,
  srcSet,
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  width: number;
  height: number;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  fallbackLabel: string;
  srcSet?: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (failed) {
    return (
      <span className={`image-fallback ${className ?? ""}`.trim()} role="img" aria-label={fallbackLabel}>
        <ImageSquare size={30} aria-hidden="true" />
        <small>{fallbackLabel}</small>
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      srcSet={srcSet}
      sizes={sizes}
      onError={() => setFailed(true)}
    />
  );
}
