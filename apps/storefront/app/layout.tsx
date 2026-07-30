import type { Metadata } from "next";
import { headers } from "next/headers";
import { ExperienceProvider } from "../components/experience-provider";
import {
  DOCUMENT_LOCALE_HEADER,
  resolveDocumentLanguage,
} from "../lib/document-language";
import {
  DEFAULT_STOREFRONT_THEME,
  STOREFRONT_THEME_STORAGE_KEY,
} from "../lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CloudBridge",
    template: "%s · CloudBridge",
  },
  description: "AI software services with clear local pricing and human support.",
  icons: {
    icon: "/assets/cloudbridge-logo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const documentLanguage = resolveDocumentLanguage(
    requestHeaders.get(DOCUMENT_LOCALE_HEADER),
  );
  const themeBootstrap = `(()=>{try{const saved=window.localStorage.getItem("${STOREFRONT_THEME_STORAGE_KEY}");const theme=saved==="light"?"light":"${DEFAULT_STOREFRONT_THEME}";document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;}catch{document.documentElement.dataset.theme="${DEFAULT_STOREFRONT_THEME}";document.documentElement.style.colorScheme="${DEFAULT_STOREFRONT_THEME}";}})();`;

  return (
    <html
      data-theme={DEFAULT_STOREFRONT_THEME}
      lang={documentLanguage}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body><ExperienceProvider>{children}</ExperienceProvider></body>
    </html>
  );
}
