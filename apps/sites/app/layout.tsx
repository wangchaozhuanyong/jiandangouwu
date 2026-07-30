import type { Metadata } from "next";
import { headers } from "next/headers";
import { ExperienceProvider } from "../../storefront/components/experience-provider";
import {
  DOCUMENT_LOCALE_HEADER,
  resolveDocumentLanguage,
} from "../../storefront/lib/document-language";
import {
  DEFAULT_STOREFRONT_THEME,
  STOREFRONT_THEME_STORAGE_KEY,
} from "../../storefront/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CloudBridge",
    template: "%s · CloudBridge",
  },
  description: "全球 AI 工具、本地币种价格与人工服务，在一座桥上相遇。",
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
