"use client";

import type { Locale } from "@cloudbridge/contracts";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const productRoutes: Record<string, string> = {
  "ChatGPT Plus": "chatgpt-plus-assisted",
  "Claude Pro": "claude-pro-assisted",
  "Gemini Advanced": "gemini-advanced-assisted",
  "Cursor Pro": "cursor-pro-assisted",
};

export function V3HomeRouteBridge({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/preview/v3/${locale}`;
  const isHome = pathname === base || pathname === `${base}/`;

  useEffect(() => {
    if (!isHome) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (anchor) {
        const href = anchor.getAttribute("href");
        const routeMap: Record<string, string> = {
          "#recharge": `${base}/ai-recharge`,
          "#transit": `${base}/transit-subscriptions`,
          "#skills": `${base}/skills`,
        };
        const next = href ? routeMap[href] : undefined;
        if (next) {
          event.preventDefault();
          router.push(next);
          return;
        }
      }

      const resultButton = target.closest<HTMLButtonElement>(".palette-results button");
      if (!resultButton) return;
      const name = resultButton.querySelector("strong")?.textContent?.trim();
      const slug = name ? productRoutes[name] : undefined;
      if (!slug) return;
      event.preventDefault();
      router.push(`${base}/products/${slug}`);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [base, isHome, router]);

  return null;
}
