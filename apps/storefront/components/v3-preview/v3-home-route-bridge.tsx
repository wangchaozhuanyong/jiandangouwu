"use client";

import type { Locale } from "@cloudbridge/contracts";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useV3Commerce } from "./v3-commerce-layer";

const productRoutes: Record<string, string> = {
  "ChatGPT Plus": "chatgpt-plus-assisted",
  "Claude Pro": "claude-pro-assisted",
  "Gemini Advanced": "gemini-advanced-assisted",
  "Cursor Pro": "cursor-pro-assisted",
  "Codex Access": "codex-access",
  Midjourney: "midjourney-assisted",
};

export function V3HomeRouteBridge({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useV3Commerce();
  const base = `/preview/v3/${locale}`;
  const isHome = pathname === base || pathname === `${base}/`;

  useEffect(() => {
    const homeCount = document.querySelector<HTMLElement>(".header .cart span");
    if (homeCount) {
      homeCount.textContent = String(count);
      homeCount.style.display = count > 0 ? "grid" : "none";
    }

    const innerCart = document.querySelector<HTMLElement>(`.v3-final-header [data-v3-cart-count]`);
    if (innerCart) innerCart.dataset.v3CartCount = String(count);
  }, [count, pathname]);

  useEffect(() => {
    const previewOnlyButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".v3-final-plan-cards button"));
    previewOnlyButtons.forEach((button) => {
      button.disabled = true;
      button.title = locale === "zh" ? "V3 预览中不执行真实套餐操作" : "Real plan actions are disabled in the V3 preview";
      button.setAttribute("aria-label", button.title);
    });
  }, [locale, pathname]);

  useEffect(() => {
    if (!isHome) return;

    const cards = Array.from(document.querySelectorAll<HTMLElement>(".product"));
    cards.forEach((card) => {
      const name = card.querySelector("h3")?.textContent?.trim();
      if (!name || !productRoutes[name]) return;
      card.tabIndex = 0;
      card.setAttribute("role", "link");
      card.setAttribute("aria-label", locale === "zh" ? `查看 ${name} 详情` : `View ${name} details`);
    });

    const openProductCard = (target: HTMLElement) => {
      const card = target.closest<HTMLElement>(".product");
      if (!card || target.closest("button")) return false;
      const name = card.querySelector("h3")?.textContent?.trim();
      const slug = name ? productRoutes[name] : undefined;
      if (!slug) return false;
      router.push(`${base}/products/${slug}`);
      return true;
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (openProductCard(target)) {
        event.preventDefault();
        return;
      }

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

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target as HTMLElement | null;
      if (!target?.classList.contains("product")) return;
      const name = target.querySelector("h3")?.textContent?.trim();
      const slug = name ? productRoutes[name] : undefined;
      if (!slug) return;
      event.preventDefault();
      router.push(`${base}/products/${slug}`);
    };

    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [base, isHome, locale, router]);

  return (
    <style jsx global>{`
      .v3-command-fab,
      .v3-commerce-fab { display: none !important; }
      .v3 .product[role="link"] { cursor: pointer; }
      .v3 .product[role="link"]:focus-visible {
        outline: 2px solid rgba(137,119,255,.9) !important;
        outline-offset: 4px !important;
      }
      .v3-final-header [data-v3-cart-count]::after {
        content: attr(data-v3-cart-count);
      }
      .v3-final-header [data-v3-cart-count="0"]::after {
        display: none !important;
      }
      .v3-final-plan-cards button:disabled {
        cursor: not-allowed !important;
        opacity: .46;
        transform: none !important;
      }
    `}</style>
  );
}
